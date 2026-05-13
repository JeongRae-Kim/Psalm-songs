/**
 * useMidiPlayer.js v5
 * MIDI 파일 로드/파싱 + SoundFont 피아노 재생 (smplr) + 반복 재생
 *
 * 반복 재생: mid가 본곡 1회분이고, totalLoops만큼 자동 반복
 * - 매 반복 시작 시 currentLoop 카운트 증가 (외부 컴포넌트가 cursor 리셋용)
 * - 마지막 반복 끝나면 자동 정지
 *
 * 필요 패키지: npm install @tonejs/midi smplr
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Midi } from "@tonejs/midi";
import { SplendidGrandPiano, ElectricPiano, Soundfont } from "smplr";
import { getAudioContext } from "./audioContext";

/* ── 악기 인스턴스 생성 헬퍼 ── */
async function createInstrument(ctx, instrumentKey) {
  let inst;
  switch (instrumentKey) {
    case "epiano":
      inst = new ElectricPiano(ctx, { instrument: "CP80" });
      break;
    case "organ":
      inst = new Soundfont(ctx, { instrument: "church_organ" });
      break;
    case "harpsichord":
      inst = new Soundfont(ctx, { instrument: "harpsichord" });
      break;
    case "celesta":
      inst = new Soundfont(ctx, { instrument: "celesta" });
      break;
    case "piano":
    default:
      inst = new SplendidGrandPiano(ctx);
      break;
  }
  await inst.loaded();
  return inst;
}

/* ── 마디 경계 계산 (마지막 음표 보정용) ── */
function computeMeasureBoundaries(midi) {
  const tpb = midi.header.ppq;
  const tsEvents = (midi.header.timeSignatures || [])
    .map((ts) => ({ ticks: ts.ticks, num: ts.timeSignature[0], den: ts.timeSignature[1] }))
    .sort((a, b) => a.ticks - b.ticks);
  if (tsEvents.length === 0) tsEvents.push({ ticks: 0, num: 4, den: 4 });

  let totalTicks = 0;
  midi.tracks.forEach((track) => {
    track.notes.forEach((n) => {
      const endTick = midi.header.secondsToTicks(n.time + n.duration);
      if (endTick > totalTicks) totalTicks = endTick;
    });
  });
  if (totalTicks === 0) totalTicks = midi.header.secondsToTicks(midi.duration);

  const measures = [];
  let currentTick = 0;
  let tsIdx = 0;
  while (currentTick < totalTicks) {
    while (tsIdx < tsEvents.length - 1 && tsEvents[tsIdx + 1].ticks <= currentTick) tsIdx++;
    const { num, den } = tsEvents[tsIdx];
    const measureTicks = Math.round(num * (4 / den) * tpb);
    const nextTsTick = tsIdx < tsEvents.length - 1 ? tsEvents[tsIdx + 1].ticks : totalTicks + 1;
    const endTick = Math.min(currentTick + measureTicks, nextTsTick);
    const actualTicks = endTick - currentTick;
    measures.push({ startTick: currentTick, endTick, num, den, actualTicks, measureTicks });
    currentTick = endTick;
  }

  const validMeasures = measures.filter((m) => m.actualTicks >= m.measureTicks * 0.1);
  const tickToSec = (tick) => midi.header.ticksToSeconds(tick);

  return validMeasures.map((m) => ({
    startSec: tickToSec(m.startTick),
    endSec: tickToSec(m.endTick),
    ts: `${m.num}/${m.den}`,
  }));
}

export default function useMidiPlayer(midiUrl, totalLoops = 1, instrument = "piano", onEnded = null) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [pianoLoading, setPianoLoading] = useState(false);
  const [currentLoop, setCurrentLoop] = useState(0);  // 현재 몇 번째 반복인지 (0부터)
  const [infiniteLoop, setInfiniteLoop] = useState(false);  // 무한 반복 모드

  // onEnded 콜백 ref: 곡 종료 시 외부에 알림 (플레이리스트 자동 이어재생용)
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const pianoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const notesRef = useRef([]);
  const melodyTimesRef = useRef([]);
  const originalBpm = useRef(120);
  const originalDuration = useRef(0);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const scheduledRef = useRef([]);
  const playingRef = useRef(false);
  const currentLoopRef = useRef(0);  // setTimeout 내부에서 최신값 참조용
  const totalLoopsRef = useRef(totalLoops);  // 동일 이유
  const infiniteLoopRef = useRef(false);  // setTimeout 내부에서 최신값 참조용

  // totalLoops가 외부에서 바뀔 때 ref 동기화
  useEffect(() => {
    totalLoopsRef.current = totalLoops;
  }, [totalLoops]);

  // infiniteLoop 동기화
  useEffect(() => {
    infiniteLoopRef.current = infiniteLoop;
  }, [infiniteLoop]);

  const toggleInfiniteLoop = useCallback(() => {
    setInfiniteLoop((prev) => !prev);
  }, []);

  const tempoRatio = useCallback(() => originalBpm.current / tempo, [tempo]);

  // ── MIDI 로드 ──
  useEffect(() => {
    if (!midiUrl) { setReady(false); return; }
    let cancelled = false;
    setLoading(true); setError(null); setReady(false);

    fetch(midiUrl)
      .then((r) => { if (!r.ok) throw new Error("MIDI 로드 실패: " + r.status); return r.arrayBuffer(); })
      .then((buf) => {
        if (cancelled) return;
        const midi = new Midi(buf);
        originalDuration.current = midi.duration;
        setDuration(midi.duration);

        if (midi.header.tempos?.length > 0) {
          originalBpm.current = Math.round(midi.header.tempos[0].bpm);
          setTempo(originalBpm.current);
        }

        const all = [];
        midi.tracks.forEach((t) => t.notes.forEach((n) => {
          all.push({ time: n.time, duration: n.duration, midi: n.midi, velocity: n.velocity });
        }));
        all.sort((a, b) => a.time - b.time);

        // ── 마지막 마디 마지막 beat 음표 duration 보정 ──
        const measures = computeMeasureBoundaries(midi);
        const totalMeasuresCount = measures.length;
        if (totalMeasuresCount >= 2) {
          const lastMIdx = totalMeasuresCount - 1;
          const lastM = measures[lastMIdx];
          const halfIdx = Math.floor(totalMeasuresCount / 2);
          let compIdx = null;
          for (let i = halfIdx - 2; i <= halfIdx + 2; i++) {
            if (i >= 0 && i < lastMIdx && measures[i].ts === lastM.ts) { compIdx = i; break; }
          }
          if (compIdx === null) {
            for (let i = lastMIdx - 1; i >= 0; i--) {
              if (measures[i].ts === lastM.ts) { compIdx = i; break; }
            }
          }
          if (compIdx !== null) {
            const compM = measures[compIdx];
            const lastBeatNotes = all.filter((n) => n.time >= lastM.startSec && n.time < lastM.endSec);
            const compBeatNotes = all.filter((n) => n.time >= compM.startSec && n.time < compM.endSec);
            if (lastBeatNotes.length > 0 && compBeatNotes.length > 0) {
              const lastBeatTick = Math.max(...lastBeatNotes.map((n) => n.time));
              const compBeatTick = Math.max(...compBeatNotes.map((n) => n.time));
              const lastFinal = lastBeatNotes.filter((n) => n.time === lastBeatTick);
              const compFinal = compBeatNotes.filter((n) => n.time === compBeatTick);
              const lastAvgDur = lastFinal.reduce((s, n) => s + n.duration, 0) / lastFinal.length;
              const compAvgDur = compFinal.reduce((s, n) => s + n.duration, 0) / compFinal.length;
              if (compAvgDur > lastAvgDur && (compAvgDur - lastAvgDur) / compAvgDur > 0.15) {
                lastFinal.forEach((n) => {
                  const matchComp = compFinal.find(() => true);
                  if (matchComp) {
                    console.log(`[MIDI] 마지막 음표 보정: note=${n.midi}, ${n.duration.toFixed(3)}s → ${matchComp.duration.toFixed(3)}s`);
                    n.duration = matchComp.duration;
                  }
                });
              }
            }
          }
        }

        notesRef.current = all;

        if (midi.tracks.length > 0) {
          melodyTimesRef.current = midi.tracks[0].notes.map((n) => n.time).sort((a, b) => a - b);
        }

        // 디버그: MIDI 타이밍 분석
        const mTimes = melodyTimesRef.current;
        const firstNote = mTimes.length > 0 ? mTimes[0] : 0;
        const lastNoteStart = mTimes.length > 0 ? mTimes[mTimes.length - 1] : 0;
        // 마지막 멜로디 음표의 끝 시점 (start + duration)
        const melodyNotes = midi.tracks.length > 0 ? midi.tracks[0].notes : [];
        const lastMelodyNote = melodyNotes.length > 0 ? melodyNotes[melodyNotes.length - 1] : null;
        const lastNoteEnd = lastMelodyNote ? (lastMelodyNote.time + lastMelodyNote.duration) : 0;
        console.log(
          `[MIDI] duration=${midi.duration.toFixed(2)}s, BPM=${originalBpm.current}, ` +
          `notes=${all.length}, melodyNotes=${mTimes.length}, ` +
          `firstNote=${firstNote.toFixed(3)}s, lastNoteStart=${lastNoteStart.toFixed(3)}s, ` +
          `lastNoteEnd=${lastNoteEnd.toFixed(3)}s, ` +
          `연주구간=${(lastNoteStart - firstNote).toFixed(3)}s, ` +
          `끝여백=${(midi.duration - lastNoteEnd).toFixed(3)}s`
        );

        setLoading(false); setReady(true);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [midiUrl]);

  // ── 악기 초기화 ──
  const instrumentRef = useRef(instrument);

  const ensurePiano = useCallback(async () => {
    if (pianoRef.current && instrumentRef.current === instrument) return;
    if (pianoRef.current) {
      pianoRef.current.stop();
      pianoRef.current = null;
    }
    setPianoLoading(true);
    // AudioContext는 MiniPlayer의 클릭 핸들러에서 이미 생성+resume됨
    const ctx = getAudioContext();
    audioCtxRef.current = ctx;
    const inst = await createInstrument(ctx, instrument);
    pianoRef.current = inst;
    instrumentRef.current = instrument;
    setPianoLoading(false);
  }, [instrument]);

  // ── 노트 스케줄링 ──
  const scheduleNotes = useCallback((fromTime) => {
    scheduledRef.current.forEach((id) => clearTimeout(id));
    scheduledRef.current = [];

    const piano = pianoRef.current;
    if (!piano) return;

    const r = tempoRatio();

    notesRef.current.forEach((n) => {
      const at = n.time * r;
      const dur = n.duration * r;
      const ft = fromTime * r;
      if (at >= ft) {
        const delay = (at - ft) * 1000;
        const id = setTimeout(() => {
          if (!playingRef.current) return;
          piano.start({ note: n.midi, velocity: Math.round(n.velocity * 127), duration: dur });
        }, delay);
        scheduledRef.current.push(id);
      }
    });

    // 곡 끝 도달 시 처리: 다음 loop가 있으면 재생 계속, 없으면 정지
    // 단, 무한 반복 모드면 마지막 절 후 다시 첫 절로 돌아가서 계속 재생
    const endDelay = (originalDuration.current - fromTime) * r * 1000;
    const endId = setTimeout(() => {
      if (!playingRef.current) return;

      const nextLoop = currentLoopRef.current + 1;
      if (nextLoop < totalLoopsRef.current) {
        // 다음 반복으로: cursor 리셋 신호 + 처음부터 재생 계속
        currentLoopRef.current = nextLoop;
        setCurrentLoop(nextLoop);
        pausedAtRef.current = 0;
        setCurrentTime(0);
        const ctx = audioCtxRef.current;
        if (ctx) startedAtRef.current = ctx.currentTime;
        scheduleNotesRef.current(0);  // 다음 loop 스케줄
      } else if (infiniteLoopRef.current) {
        // 무한 반복 모드: 첫 절로 리셋 후 계속 재생
        currentLoopRef.current = 0;
        setCurrentLoop(0);
        pausedAtRef.current = 0;
        setCurrentTime(0);
        const ctx = audioCtxRef.current;
        if (ctx) startedAtRef.current = ctx.currentTime;
        scheduleNotesRef.current(0);
      } else {
        // 마지막 반복 종료 → 정지
        currentLoopRef.current = 0;
        setCurrentLoop(0);
        stopRef.current?.();
        // 외부에 곡 종료 알림 (플레이리스트 자동 이어재생 등)
        if (onEndedRef.current) {
          try { onEndedRef.current(); } catch (e) { console.warn("[useMidiPlayer] onEnded 콜백 오류:", e); }
        }
      }
    }, endDelay + 100);
    scheduledRef.current.push(endId);
  }, [tempoRatio]);

  // scheduleNotes를 ref에 저장 (자기 자신을 setTimeout 안에서 호출하기 위함)
  const scheduleNotesRef = useRef(null);
  useEffect(() => {
    scheduleNotesRef.current = scheduleNotes;
  }, [scheduleNotes]);

  // stop도 ref로 저장 (scheduleNotes 안에서 호출하기 위함, 호이스팅 회피)
  const stopRef = useRef(null);

  // ── tick ──
  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = ctx.currentTime - startedAtRef.current;
    setCurrentTime(pausedAtRef.current + elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── 재생 ──
  const play = useCallback(async () => {
    if (!ready) return;
    await ensurePiano();
    const ctx = audioCtxRef.current;

    // 마지막 loop 끝난 후 재생 시 처음부터
    if (currentLoopRef.current >= totalLoopsRef.current) {
      currentLoopRef.current = 0;
      setCurrentLoop(0);
      pausedAtRef.current = 0;
      setCurrentTime(0);
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
    currentLoopRef.current = 0;
    setCurrentLoop(0);
    cancelAnimationFrame(rafRef.current);
  }, []);

  // stop을 ref에 동기화
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // ── 탐색 ──
  const seekTo = useCallback((fraction) => {
    const r = tempoRatio();
    const t = fraction * originalDuration.current;
    if (playingRef.current) {
      pause();
      pausedAtRef.current = t;
      setTimeout(() => play(), 50);
    } else {
      pausedAtRef.current = t;
      setCurrentTime(t);
    }
  }, [pause, play, tempoRatio]);

  // ── 템포 변경 ──
  const changeTempo = useCallback((newTempo) => {
    setTempo(newTempo);
    const r = originalBpm.current / newTempo;
    setDuration(originalDuration.current * r);

    if (playingRef.current) {
      const ctx = audioCtxRef.current;
      const elapsed = ctx ? ctx.currentTime - startedAtRef.current : 0;
      const t = pausedAtRef.current + elapsed;
      pause();
      pausedAtRef.current = t;
      setTimeout(() => play(), 50);
    }
  }, [pause, play]);

  // ── 계산값 ──
  const r = tempoRatio();
  const adjustedDuration = originalDuration.current * r;
  const adjustedCurrentTime = currentTime * r;
  const progress = adjustedDuration > 0 ? Math.min(1, currentTime / originalDuration.current) : 0;

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      scheduledRef.current.forEach((id) => clearTimeout(id));
      pianoRef.current?.stop();
    };
  }, []);

  return {
    loading: loading || pianoLoading,
    ready, error, playing,
    currentTime,                    // 원본 시간 (초) — 커서 동기화용
    originalTime: currentTime,      // 별칭
    originalDuration: originalDuration.current, // MIDI 원본 길이 (초) — 커서 스케일 보정용
    duration: adjustedDuration,     // 템포 적용 후 총 길이 (프로그레스 바)
    displayTime: adjustedCurrentTime, // 템포 적용 후 현재 시간 (표시용)
    progress,                       // 0~1
    tempo,
    melodyTimes: melodyTimesRef.current,
    currentLoop,                    // 현재 몇 번째 반복 (0부터)
    totalLoops,                     // 총 반복 횟수
    infiniteLoop,                   // 무한 반복 모드 여부
    toggleInfiniteLoop,             // 무한 반복 토글
    play, pause, stop, seekTo, changeTempo,
  };
}
