/**
 * useMxlPlayer.js v1
 * MXL 파일에서 직접 음표 추출 → smplr SplendidGrandPiano 재생 + 커서 동기화
 *
 * 설계 명세: MXL_단일재생_설계명세_v1.md
 * 검증 데이터: 시편 23편/6편/40편/42-6편 4곡 OSMD API 검증 결과 반영
 *
 * 동작 흐름:
 * 1. mxlUrl 로드 → 화면 밖 임시 OSMD 인스턴스로 파싱
 * 2. cursor 순회로 notesData 수집:
 *    [{ stepIdx, midi: halfTone + 12, timeBeat, durationBeat }, ...]
 * 3. BPM = midiBpm prop (Phase 1: MIDI BPM 차용, Phase 4에서 독립)
 * 4. originalDuration = (마지막 음표.timeBeat + .durationBeat) × 240 / BPM
 * 5. play(): notesData를 setTimeout으로 스케줄 + tick()으로 currentStepIdx 진행
 * 6. OsmdViewMxl이 currentStepIdx를 받아 직접 cursor 이동 (매핑 함수 없음)
 *
 * 검증 결과 반영 사항:
 * - halfTone + 12 = MIDI 번호
 * - isRest()는 함수 호출 (곡에 따라 0~8개)
 * - 빈 공간 무시 (OSMD는 timeBeat=0부터 시작)
 * - 다성부 모두 재생 (NotesUnderCursor 결과 그대로)
 * - velocity = 80 고정 (Phase 1)
 *
 * 인터페이스: useMidiPlayer와 drop-in 호환 + currentStepIdx 신규 필드
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { SplendidGrandPiano } from "smplr";

const FIXED_VELOCITY = 80;       // Phase 1: 고정 velocity
const DEFAULT_BPM = 120;         // Fallback (실제로는 midiBpm prop 사용)

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

  // 추출된 곡 정보 (불변)
  const notesDataRef = useRef([]);             // [{stepIdx, midi, timeBeat, durationBeat}, ...]
  const totalStepsRef = useRef(0);
  const originalBpmRef = useRef(DEFAULT_BPM);
  const originalDurationRef = useRef(0);
  const melodyTimesRef = useRef([]);           // 호환용 (notesData에서 timeBeat→sec 추출)

  // 재생 상태
  const pianoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const scheduledRef = useRef([]);
  const playingRef = useRef(false);
  const currentLoopRef = useRef(0);
  const totalLoopsRef = useRef(totalLoops);

  // ── totalLoops ref 동기화 ──
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

    const osmd = new OpenSheetMusicDisplay(tempContainer, {
      autoResize: false,
      drawTitle: false,
      drawComposer: false,
      drawLyricist: false,
    });

    fetch(mxlUrl)
      .then((r) => {
        if (!r.ok) throw new Error("MXL 로드 실패: " + r.status);
        return r.arrayBuffer();
      })
      .then(async (buf) => {
        if (cancelled) return;

        try {
          await osmd.load(buf);
        } catch (e1) {
          await osmd.load(mxlUrl);
        }

        if (cancelled) return;

        // ── notesData 수집 ──
        const notesData = [];
        osmd.cursor.reset();
        let stepIdx = 0;

        while (!osmd.cursor.iterator.endReached) {
          const ts = osmd.cursor.iterator.currentTimeStamp;
          const timeBeat = ts ? ts.realValue : null;
          const ns = osmd.cursor.NotesUnderCursor() || [];

          if (timeBeat !== null) {
            ns.forEach((n) => {
              // 쉼표 필터링 (검증: isRest는 함수)
              let isRest = false;
              try {
                isRest = typeof n.isRest === "function" ? n.isRest() : !!n.isRest;
              } catch (e) {
                isRest = false;
              }
              if (isRest) return;

              // halfTone 안전 검사
              if (typeof n.halfTone !== "number") return;

              // 길이 (없으면 4분음표 기본값)
              const durationBeat = n.length?.realValue || 0.25;

              notesData.push({
                stepIdx,
                midi: n.halfTone + 12,        // ⭐ 검증된 변환식
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

        // ── BPM 결정: MIDI prop 차용 (Phase 1) ──
        const detectedBpm = midiBpm > 0
          ? midiBpm
          : (osmd.Sheet?.DefaultStartTempoInBpm || DEFAULT_BPM);

        originalBpmRef.current = detectedBpm;
        setTempo(detectedBpm);

        // ── originalDuration 계산 ──
        let origDuration = 0;
        if (notesData.length > 0) {
          const lastNote = notesData[notesData.length - 1];
          const endBeat = lastNote.timeBeat + lastNote.durationBeat;
          origDuration = endBeat * 240 / detectedBpm;
        }
        originalDurationRef.current = origDuration;
        setDuration(origDuration);

        // ── melodyTimes 호환용 (notesData에서 unique timeBeat 추출 → sec 변환) ──
        const uniqueBeats = [...new Set(notesData.map(n => n.timeBeat))].sort((a, b) => a - b);
        melodyTimesRef.current = uniqueBeats.map(b => b * 240 / detectedBpm);

        console.log(
          `[MXL] 음표=${notesData.length}, totalSteps=${totalSteps}, ` +
          `BPM=${detectedBpm}(${midiBpm > 0 ? "MIDI차용" : "MXL/기본"}), ` +
          `originalDuration=${origDuration.toFixed(2)}초, ` +
          `halfTone범위=${Math.min(...notesData.map(n=>n.midi-12))}~${Math.max(...notesData.map(n=>n.midi-12))}`
        );

        setLoading(false);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      })
      .finally(() => {
        // 임시 컨테이너 정리
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
      const startSec = n.timeBeat * 240 / bpm;          // 원본 BPM 기준 (초)
      const durSec = n.durationBeat * 240 / bpm;
      const at = startSec * r;                           // 현재 BPM 적용
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

    // 곡 끝 도달 시 처리: 다음 loop가 있으면 재생 계속, 없으면 정지
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

    // currentStepIdx 계산: 현재 시점 이하의 마지막 음표 stepIdx
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
  }, [ready, ensurePiano, scheduleNotes, tick]);

  // ── 일시정지 ──
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

  // ── 정지 ──
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

  // ── 탐색 ──
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

  // ── 템포 변경 ──
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

  // ── 정리 ──
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
    currentTime,                              // 원본 시간 (초)
    originalTime: currentTime,                // 호환 별칭
    originalDuration: originalDurationRef.current,
    duration: adjustedDuration,               // 템포 적용 후
    displayTime: adjustedCurrentTime,
    progress,
    tempo,
    melodyTimes: melodyTimesRef.current,      // 호환용 (사용 안 함)
    currentStepIdx,                           // ⭐ OsmdViewMxl이 사용
    totalSteps: totalStepsRef.current,
    currentLoop,
    totalLoops,
    play, pause, stop, seekTo, changeTempo,
  };
}
