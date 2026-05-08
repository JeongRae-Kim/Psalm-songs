/**
 * useMxlPlayer.js v1.2
 * MXL 파일에서 직접 음표 추출 → smplr SplendidGrandPiano 재생 + 커서 동기화
 *
 * v1.2 수정 (v1.1 진단 결과 반영):
 * - osmd.render() 호출 추가 (cursor 사용을 위해 필수)
 * - midiBpm > 0 가드 추가 (MIDI 로드 전 무의미한 실행 회피)
 * - 진단 로그는 유지 (검증용)
 *
 * 진단 결과 분석:
 * - v1.1에서 "TypeError: Cannot read properties of undefined (reading 'reset')" 발견
 * - 원인: osmd.load 후 render() 호출 누락 → cursor가 초기화 안 됨
 * - 부수 발견: midiBpm 변경으로 useEffect가 두 번 실행됨 (120 → 110)
 *
 * 검증 후 v1.3에서 진단 로그 정리 예정
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { SplendidGrandPiano } from "smplr";

const FIXED_VELOCITY = 80;
const DEFAULT_BPM = 120;

export default function useMxlPlayer(mxlUrl, totalLoops = 1, midiBpm = 0) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(DEFAULT_BPM);
  const [pianoLoading, setPianoLoading] = useState(false);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const notesDataRef = useRef([]);
  const totalStepsRef = useRef(0);
  const originalBpmRef = useRef(DEFAULT_BPM);
  const originalDurationRef = useRef(0);
  const melodyTimesRef = useRef([]);

  const pianoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const scheduledRef = useRef([]);
  const playingRef = useRef(false);
  const currentLoopRef = useRef(0);
  const totalLoopsRef = useRef(totalLoops);

  useEffect(() => {
    totalLoopsRef.current = totalLoops;
  }, [totalLoops]);

  const tempoRatio = useCallback(() => originalBpmRef.current / tempo, [tempo]);

  // ── MXL 로드 + 음표 추출 ──
  useEffect(() => {
    if (!mxlUrl) {
      console.log("[MXL] mxlUrl 없음, 종료");
      setReady(false);
      return;
    }

    // ⭐ v1.2: midiBpm 가드 — MIDI BPM 안정화 후에만 실행
    if (midiBpm <= 0) {
      console.log(`[MXL] midiBpm=${midiBpm} 대기 중 (MIDI 로드 후 자동 재시작)`);
      return;
    }

    console.log(`[MXL] === 시작: mxlUrl=${mxlUrl}, midiBpm=${midiBpm} ===`);

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-99999px";
    tempContainer.style.width = "100px";
    tempContainer.style.height = "100px";
    document.body.appendChild(tempContainer);
    console.log("[MXL] 1) 임시 컨테이너 생성 OK");

    let osmd;
    try {
      osmd = new OpenSheetMusicDisplay(tempContainer, {
        autoResize: false,
        drawTitle: false,
        drawComposer: false,
        drawLyricist: false,
      });
      console.log("[MXL] 2) OSMD 인스턴스 생성 OK");
    } catch (e) {
      console.error("[MXL] 2) OSMD 인스턴스 생성 실패:", e);
      setError(`OSMD 생성 실패: ${e.message}`);
      setReady(true);
      setLoading(false);
      return () => {
        try {
          if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
        } catch (e) {}
      };
    }

    fetch(mxlUrl)
      .then((r) => {
        console.log(`[MXL] 3) fetch 응답 status=${r.status}`);
        if (!r.ok) throw new Error(`MXL 로드 실패 status=${r.status}`);
        return r.arrayBuffer();
      })
      .then(async (buf) => {
        if (cancelled) {
          console.log("[MXL] cancelled, fetch 후 종료");
          return;
        }
        console.log(`[MXL] 4) ArrayBuffer 수신, 크기=${buf.byteLength} bytes`);

        let osmdLoaded = false;
        try {
          await osmd.load(buf);
          osmdLoaded = true;
          console.log("[MXL] 5a) osmd.load(ArrayBuffer) 성공");
        } catch (e1) {
          console.warn(`[MXL] 5a) osmd.load(ArrayBuffer) 실패: ${e1.message}`);
          console.log("[MXL] 5b) osmd.load(URL) 시도");
          try {
            await osmd.load(mxlUrl);
            osmdLoaded = true;
            console.log("[MXL] 5b) osmd.load(URL) 성공");
          } catch (e2) {
            console.error(`[MXL] 5b) osmd.load(URL) 실패: ${e2.message}`);
            throw new Error(`OSMD 로드 완전 실패: ArrayBuffer=${e1.message}, URL=${e2.message}`);
          }
        }

        if (cancelled) {
          console.log("[MXL] cancelled, OSMD 로드 후 종료");
          return;
        }

        // ⭐ v1.2: render() 호출 추가 (cursor 사용 가능하게)
        try {
          osmd.render();
          console.log("[MXL] 5c) osmd.render() 성공");
        } catch (e) {
          console.error(`[MXL] 5c) osmd.render() 실패: ${e.message}`);
          throw new Error(`OSMD render 실패: ${e.message}`);
        }

        if (cancelled) {
          console.log("[MXL] cancelled, render 후 종료");
          return;
        }

        console.log("[MXL] 6) cursor 순회 시작");
        const notesData = [];

        // ⭐ v1.2: cursor 안전 검사
        if (!osmd.cursor) {
          throw new Error("osmd.cursor가 undefined (render 누락 가능)");
        }

        osmd.cursor.reset();
        let stepIdx = 0;
        let totalNotesEncountered = 0;
        let totalRestsEncountered = 0;

        try {
          while (!osmd.cursor.iterator.endReached) {
            const ts = osmd.cursor.iterator.currentTimeStamp;
            const timeBeat = ts ? ts.realValue : null;
            const ns = osmd.cursor.NotesUnderCursor() || [];

            if (timeBeat !== null) {
              ns.forEach((n) => {
                let isRest = false;
                try {
                  isRest = typeof n.isRest === "function" ? n.isRest() : !!n.isRest;
                } catch (e) {
                  isRest = false;
                }
                if (isRest) {
                  totalRestsEncountered++;
                  return;
                }

                if (typeof n.halfTone !== "number") {
                  return;
                }

                totalNotesEncountered++;
                const durationBeat = n.length?.realValue || 0.25;

                notesData.push({
                  stepIdx,
                  midi: n.halfTone + 12,
                  timeBeat,
                  durationBeat,
                });
              });
            }

            osmd.cursor.next();
            stepIdx++;
          }
        } catch (e) {
          console.error(`[MXL] 6) cursor 순회 중 에러 (stepIdx=${stepIdx}):`, e);
          throw new Error(`cursor 순회 실패: ${e.message}`);
        }

        const totalSteps = stepIdx;
        notesDataRef.current = notesData;
        totalStepsRef.current = totalSteps;
        console.log(`[MXL] 6) cursor 순회 완료: totalSteps=${totalSteps}, 음표=${totalNotesEncountered}, 쉼표=${totalRestsEncountered}`);

        if (notesData.length === 0) {
          console.warn("[MXL] ⚠️ 음표 0개! useMxlPlayer ready=true로 두지만 재생 시 무음");
        }

        const detectedBpm = midiBpm > 0
          ? midiBpm
          : (osmd.Sheet?.DefaultStartTempoInBpm || DEFAULT_BPM);
        originalBpmRef.current = detectedBpm;
        setTempo(detectedBpm);
        console.log(`[MXL] 7) BPM 결정: ${detectedBpm} (midiBpm prop=${midiBpm})`);

        let origDuration = 0;
        if (notesData.length > 0) {
          const lastNote = notesData[notesData.length - 1];
          const endBeat = lastNote.timeBeat + lastNote.durationBeat;
          origDuration = endBeat * 240 / detectedBpm;
        }
        originalDurationRef.current = origDuration;
        setDuration(origDuration);
        console.log(`[MXL] 8) originalDuration=${origDuration.toFixed(2)}초`);

        const uniqueBeats = [...new Set(notesData.map(n => n.timeBeat))].sort((a, b) => a - b);
        melodyTimesRef.current = uniqueBeats.map(b => b * 240 / detectedBpm);

        const halfTones = notesData.map(n => n.midi - 12);
        const minHt = halfTones.length > 0 ? Math.min(...halfTones) : 0;
        const maxHt = halfTones.length > 0 ? Math.max(...halfTones) : 0;
        console.log(
          `[MXL] === 완료: 음표=${notesData.length}, totalSteps=${totalSteps}, ` +
          `BPM=${detectedBpm}(${midiBpm > 0 ? "MIDI차용" : "MXL/기본"}), ` +
          `originalDuration=${origDuration.toFixed(2)}초, halfTone범위=${minHt}~${maxHt} ===`
        );

        setLoading(false);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(`[MXL] ❌ 최종 실패:`, e);
          setError(e.message);
          setReady(true);  // 디버깅용
          setLoading(false);
        }
      })
      .finally(() => {
        try {
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
        } catch (e) { /* 무시 */ }
        console.log("[MXL] cleanup: 임시 컨테이너 제거");
      });

    return () => {
      cancelled = true;
      try {
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      } catch (e) { /* 무시 */ }
    };
  }, [mxlUrl, midiBpm]);

  const ensurePiano = useCallback(async () => {
    if (pianoRef.current) return;
    setPianoLoading(true);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const piano = new SplendidGrandPiano(ctx);
    await piano.loaded();
    pianoRef.current = piano;
    setPianoLoading(false);
  }, []);

  const scheduleNotes = useCallback((fromTime) => {
    scheduledRef.current.forEach((id) => clearTimeout(id));
    scheduledRef.current = [];

    const piano = pianoRef.current;
    if (!piano) return;

    const r = tempoRatio();
    const bpm = originalBpmRef.current;

    notesDataRef.current.forEach((n) => {
      const startSec = n.timeBeat * 240 / bpm;
      const durSec = n.durationBeat * 240 / bpm;
      const at = startSec * r;
      const dur = durSec * r;
      const ft = fromTime * r;

      if (at >= ft) {
        const delay = (at - ft) * 1000;
        const id = setTimeout(() => {
          if (!playingRef.current) return;
          piano.start({
            note: n.midi,
            velocity: FIXED_VELOCITY,
            duration: dur,
          });
        }, delay);
        scheduledRef.current.push(id);
      }
    });

    const endDelay = (originalDurationRef.current - fromTime) * r * 1000;
    const endId = setTimeout(() => {
      if (!playingRef.current) return;

      const nextLoop = currentLoopRef.current + 1;
      if (nextLoop < totalLoopsRef.current) {
        currentLoopRef.current = nextLoop;
        setCurrentLoop(nextLoop);
        pausedAtRef.current = 0;
        setCurrentTime(0);
        setCurrentStepIdx(0);
        const ctx = audioCtxRef.current;
        if (ctx) startedAtRef.current = ctx.currentTime;
        scheduleNotesRef.current(0);
      } else {
        currentLoopRef.current = 0;
        setCurrentLoop(0);
        stopRef.current?.();
      }
    }, endDelay + 100);
    scheduledRef.current.push(endId);
  }, [tempoRatio]);

  const scheduleNotesRef = useRef(null);
  useEffect(() => {
    scheduleNotesRef.current = scheduleNotes;
  }, [scheduleNotes]);

  const stopRef = useRef(null);

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const elapsed = ctx.currentTime - startedAtRef.current;
    const t = pausedAtRef.current + elapsed;
    setCurrentTime(t);

    const bpm = originalBpmRef.current;
    const notesData = notesDataRef.current;
    let target = 0;
    for (let i = notesData.length - 1; i >= 0; i--) {
      const noteSec = notesData[i].timeBeat * 240 / bpm;
      if (noteSec <= t + 0.01) {
        target = notesData[i].stepIdx;
        break;
      }
    }
    setCurrentStepIdx(target);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    if (!ready) {
      console.warn("[MXL] play: ready=false, 무시");
      return;
    }
    if (notesDataRef.current.length === 0) {
      console.warn("[MXL] play: 음표 0개, 재생 무시. error=", error);
      alert(`MXL 재생 실패: ${error || "음표 추출 실패"}`);
      return;
    }
    await ensurePiano();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    if (currentLoopRef.current >= totalLoopsRef.current) {
      currentLoopRef.current = 0;
      setCurrentLoop(0);
      pausedAtRef.current = 0;
      setCurrentTime(0);
      setCurrentStepIdx(0);
    }

    scheduleNotes(pausedAtRef.current);
    playingRef.current = true;
    setPlaying(true);
    startedAtRef.current = ctx.currentTime;
    rafRef.current = requestAnimationFrame(tick);
  }, [ready, ensurePiano, scheduleNotes, tick, error]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) pausedAtRef.current += ctx.currentTime - startedAtRef.current;
    scheduledRef.current.forEach((id) => clearTimeout(id));
    scheduledRef.current = [];
    pianoRef.current?.stop();
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const stop = useCallback(() => {
    scheduledRef.current.forEach((id) => clearTimeout(id));
    scheduledRef.current = [];
    pianoRef.current?.stop();
    pausedAtRef.current = 0;
    playingRef.current = false;
    setPlaying(false);
    setCurrentTime(0);
    setCurrentStepIdx(0);
    currentLoopRef.current = 0;
    setCurrentLoop(0);
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const seekTo = useCallback((fraction) => {
    const t = Math.max(0, Math.min(1, fraction)) * originalDurationRef.current;
    if (playingRef.current) {
      pause();
      pausedAtRef.current = t;
      setTimeout(() => play(), 50);
    } else {
      pausedAtRef.current = t;
      setCurrentTime(t);
    }
  }, [pause, play]);

  const changeTempo = useCallback((newTempo) => {
    setTempo(newTempo);
    const r = originalBpmRef.current / newTempo;
    setDuration(originalDurationRef.current * r);

    if (playingRef.current) {
      const ctx = audioCtxRef.current;
      const elapsed = ctx ? ctx.currentTime - startedAtRef.current : 0;
      const t = pausedAtRef.current + elapsed;
      pause();
      pausedAtRef.current = t;
      setTimeout(() => play(), 50);
    }
  }, [pause, play]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      scheduledRef.current.forEach((id) => clearTimeout(id));
      pianoRef.current?.stop();
    };
  }, []);

  const r = tempoRatio();
  const adjustedDuration = originalDurationRef.current * r;
  const adjustedCurrentTime = currentTime * r;
  const progress = originalDurationRef.current > 0
    ? Math.min(1, currentTime / originalDurationRef.current)
    : 0;

  return {
    loading: loading || pianoLoading,
    ready,
    error,
    playing,
    currentTime,
    originalTime: currentTime,
    originalDuration: originalDurationRef.current,
    duration: adjustedDuration,
    displayTime: adjustedCurrentTime,
    progress,
    tempo,
    melodyTimes: melodyTimesRef.current,
    currentStepIdx,
    totalSteps: totalStepsRef.current,
    currentLoop,
    totalLoops,
    play, pause, stop, seekTo, changeTempo,
  };
}
