/**
 * useMxlPlayer.js v1.3
 * MXL 파일에서 직접 음표 추출 → smplr SplendidGrandPiano 재생 + 커서 동기화
 *
 * 설계 명세: MXL_단일재생_설계명세_v1.md
 *
 * 핵심 동작:
 * 1. mxlUrl 로드 → 화면 밖 임시 OSMD 인스턴스로 파싱 + render
 * 2. cursor 순회로 notesData 수집:
 *    [{ stepIdx, midi: halfTone + 12, timeBeat, durationBeat }, ...]
 * 3. BPM = midiBpm prop (Phase 1: MIDI BPM 차용, Phase 4에서 song.bpm으로 전환 예정)
 * 4. play(): notesData를 setTimeout으로 스케줄
 * 5. tick(): currentTime → currentStepIdx 갱신
 * 6. OsmdViewMxl이 currentStepIdx로 직접 cursor 이동
 *
 * 검증 데이터 반영 (M1):
 * - midi = halfTone + 12 (검증 v2)
 * - isRest()는 함수 호출 (곡에 따라 0~8개)
 * - 빈 공간 무시 (OSMD timeBeat=0부터 시작)
 * - 다성부 모두 재생 (NotesUnderCursor 결과 그대로)
 *
 * v1.3 변경 (v1.2 → v1.3):
 * - 단계별 진단 로그 [MXL] 1) 2) 3) ... 제거
 * - 한 줄 완료 로그만 유지
 * - 안전장치 (render 가드, cursor 검사, 음표 0개 alert) 유지
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
      setReady(false);
      return;
    }

    // midiBpm 가드: MIDI BPM 안정화 후에만 실행 (Phase 1 옵션 c)
    if (midiBpm <= 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);

    // 화면 밖 임시 OSMD 컨테이너
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-99999px";
    tempContainer.style.width = "100px";
    tempContainer.style.height = "100px";
    document.body.appendChild(tempContainer);

    let osmd;
    try {
      osmd = new OpenSheetMusicDisplay(tempContainer, {
        autoResize: false,
        drawTitle: false,
        drawComposer: false,
        drawLyricist: false,
      });
    } catch (e) {
      console.error("[MXL] OSMD 인스턴스 생성 실패:", e);
      setError(`OSMD 생성 실패: ${e.message}`);
      setReady(true);
      setLoading(false);
      return () => {
        try { tempContainer.parentNode?.removeChild(tempContainer); } catch (e) {}
      };
    }

    fetch(mxlUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`MXL 로드 실패 status=${r.status}`);
        return r.arrayBuffer();
      })
      .then(async (buf) => {
        if (cancelled) return;

        // OSMD 로드 (ArrayBuffer 우선, 실패 시 URL fallback)
        try {
          await osmd.load(buf);
        } catch (e1) {
          try {
            await osmd.load(mxlUrl);
          } catch (e2) {
            throw new Error(`OSMD 로드 실패: ${e2.message}`);
          }
        }

        if (cancelled) return;

        // render 호출 (cursor 사용을 위해 필수)
        try {
          osmd.render();
        } catch (e) {
          throw new Error(`OSMD render 실패: ${e.message}`);
        }

        if (cancelled) return;

        // cursor 안전 검사
        if (!osmd.cursor) {
          throw new Error("osmd.cursor가 undefined (render 누락 가능)");
        }

        // notesData 수집
        const notesData = [];
        osmd.cursor.reset();
        let stepIdx = 0;

        while (!osmd.cursor.iterator.endReached) {
          const ts = osmd.cursor.iterator.currentTimeStamp;
          const timeBeat = ts ? ts.realValue : null;
          const ns = osmd.cursor.NotesUnderCursor() || [];

          if (timeBeat !== null) {
            ns.forEach((n) => {
              // 쉼표 필터링 (isRest는 함수)
              let isRest = false;
              try {
                isRest = typeof n.isRest === "function" ? n.isRest() : !!n.isRest;
              } catch (e) {
                isRest = false;
              }
              if (isRest) return;

              if (typeof n.halfTone !== "number") return;

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

        const totalSteps = stepIdx;
        notesDataRef.current = notesData;
        totalStepsRef.current = totalSteps;

        // BPM 결정 (MIDI 차용, Phase 4에서 song.bpm으로 전환 예정)
        const detectedBpm = midiBpm > 0
          ? midiBpm
          : (osmd.Sheet?.DefaultStartTempoInBpm || DEFAULT_BPM);
        originalBpmRef.current = detectedBpm;
        setTempo(detectedBpm);

        // originalDuration 계산
        let origDuration = 0;
        if (notesData.length > 0) {
          const lastNote = notesData[notesData.length - 1];
          const endBeat = lastNote.timeBeat + lastNote.durationBeat;
          origDuration = endBeat * 240 / detectedBpm;
        }
        originalDurationRef.current = origDuration;
        setDuration(origDuration);

        // melodyTimes 호환 (사용 안 하지만 인터페이스 유지)
        const uniqueBeats = [...new Set(notesData.map(n => n.timeBeat))].sort((a, b) => a - b);
        melodyTimesRef.current = uniqueBeats.map(b => b * 240 / detectedBpm);

        // 한 줄 완료 로그만 유지
        console.log(
          `[MXL] 음표=${notesData.length}, totalSteps=${totalSteps}, ` +
          `BPM=${detectedBpm}, originalDuration=${origDuration.toFixed(2)}초`
        );

        setLoading(false);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(`[MXL] 로드 실패:`, e.message);
          setError(e.message);
          setReady(true);  // 미니 플레이어 노출용 (재생 시도 시 alert)
          setLoading(false);
        }
      })
      .finally(() => {
        try {
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
        } catch (e) { /* 무시 */ }
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

  // ── 피아노 초기화 ──
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

  // ── 노트 스케줄링 ──
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

    // 곡 끝 도달 시: 다음 loop 또는 정지
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

  // ── tick: currentTime + currentStepIdx 갱신 ──
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

  // ── 재생 ──
  const play = useCallback(async () => {
    if (!ready) return;
    if (notesDataRef.current.length === 0) {
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

  // ── 계산값 ──
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
    currentStepIdx,                           // OsmdViewMxl이 사용
    totalSteps: totalStepsRef.current,
    currentLoop,
    totalLoops,
    play, pause, stop, seekTo, changeTempo,
  };
}
