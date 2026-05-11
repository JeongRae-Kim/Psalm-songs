/**
 * useAccompanistPlayer.js v1.0
 *
 * "반주기" 탭 전용 훅 — PDF 악보 + MIDI 구간 재생
 *
 * 재생 흐름:
 *   [전주: 마지막 introMeasures 마디] → [본곡 × totalLoops절] → [아멘(있으면)]
 *
 * 구조:
 *   - MIDI 파싱: @tonejs/midi (노트 + 박자표 + 템포)
 *   - 마디 경계 계산: timeSignature 이벤트 기반 tick→초 변환
 *   - 구간 산출: intro / body / amen 각 구간의 시작·끝(초)
 *   - 재생: SplendidGrandPiano (smplr) — useMidiPlayer와 동일
 *   - 시퀀스 제어: phase 상태머신 (intro → body × N → amen → done)
 *
 * 필요 패키지: npm install @tonejs/midi smplr
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Midi } from "@tonejs/midi";
import { SplendidGrandPiano, ElectricPiano, Soundfont } from "smplr";
import { getAudioContext } from "./audioContext";

/* ─────────────────────────────────────────────────
   헬퍼: 악기 인스턴스 생성
   ───────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────
   헬퍼: MIDI에서 마디 경계(초) 배열 계산
   ───────────────────────────────────────────────── */
function computeMeasureBoundaries(midi) {
  const tpb = midi.header.ppq; // ticks per beat

  // 1. 박자표 이벤트 수집 (tick 순)
  const tsEvents = (midi.header.timeSignatures || [])
    .map((ts) => ({
      ticks: ts.ticks,
      num: ts.timeSignature[0],
      den: ts.timeSignature[1],
    }))
    .sort((a, b) => a.ticks - b.ticks);

  if (tsEvents.length === 0) {
    tsEvents.push({ ticks: 0, num: 4, den: 4 });
  }

  // 2. 템포 이벤트 수집 (tick 순) — tick→초 변환용
  const tempoEvents = (midi.header.tempos || [])
    .map((t) => ({ ticks: t.ticks, bpm: t.bpm }))
    .sort((a, b) => a.ticks - b.ticks);

  if (tempoEvents.length === 0) {
    tempoEvents.push({ ticks: 0, bpm: 120 });
  }

  // 3. 총 tick 수 계산
  let totalTicks = 0;
  midi.tracks.forEach((track) => {
    track.notes.forEach((n) => {
      const endTick = midi.header.secondsToTicks(n.time + n.duration);
      if (endTick > totalTicks) totalTicks = endTick;
    });
  });
  // controlChanges, 기타 이벤트의 끝도 고려
  if (totalTicks === 0) {
    totalTicks = midi.header.secondsToTicks(midi.duration);
  }

  // 4. 마디 경계를 tick 단위로 계산
  const measures = []; // { startTick, endTick, num, den }
  let currentTick = 0;
  let tsIdx = 0;

  while (currentTick < totalTicks) {
    // 현재 tick에서의 박자표 결정
    while (tsIdx < tsEvents.length - 1 && tsEvents[tsIdx + 1].ticks <= currentTick) {
      tsIdx++;
    }
    const { num, den } = tsEvents[tsIdx];
    const measureTicks = Math.round(num * (4 / den) * tpb);

    // 다음 박자표 변경 지점
    const nextTsTick =
      tsIdx < tsEvents.length - 1 ? tsEvents[tsIdx + 1].ticks : totalTicks + 1;
    const endTick = Math.min(currentTick + measureTicks, nextTsTick);
    const actualTicks = endTick - currentTick;

    measures.push({ startTick: currentTick, endTick, num, den, actualTicks, measureTicks });
    currentTick = endTick;
  }

  // 5. 불완전 마디(유령 마디) 필터링: 예상 길이의 10% 미만
  const validMeasures = measures.filter((m) => m.actualTicks >= m.measureTicks * 0.1);

  // 6. tick → 초 변환
  const tickToSec = (tick) => midi.header.ticksToSeconds(tick);

  return validMeasures.map((m) => ({
    startSec: tickToSec(m.startTick),
    endSec: tickToSec(m.endTick),
    ts: `${m.num}/${m.den}`,
  }));
}

/* ─────────────────────────────────────────────────
   메인 훅
   ───────────────────────────────────────────────── */
export default function useAccompanistPlayer(
  midiUrl,
  totalLoops = 1,
  introMeasures = 4,
  hasAmen = false,
  instrument = "piano"
) {
  // ── 상태 ──
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pianoLoading, setPianoLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | intro | body | amen | done

  // ── refs ──
  const pianoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const notesRef = useRef([]);           // 전체 MIDI 노트 배열
  const measuresRef = useRef([]);        // 마디 경계 배열
  const originalBpm = useRef(120);
  const originalDuration = useRef(0);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);        // AudioContext.currentTime 기준
  const phaseStartRef = useRef(0);       // 현재 phase 시작 시점의 누적 시간
  const elapsedBeforePhaseRef = useRef(0); // 이전 phase들의 누적 재생 시간
  const scheduledRef = useRef([]);
  const playingRef = useRef(false);
  const currentLoopRef = useRef(0);
  const phaseRef = useRef("idle");
  const totalLoopsRef = useRef(totalLoops);

  // 구간 정보
  const introRangeRef = useRef({ start: 0, end: 0 });   // 전주 구간(초)
  const bodyRangeRef = useRef({ start: 0, end: 0 });     // 본곡 구간(초)
  const amenRangeRef = useRef({ start: 0, end: 0 });     // 아멘 구간(초)
  const totalPlayDurationRef = useRef(0);                 // 전체 재생 길이(초)

  const introMeasuresRef = useRef(introMeasures);
  const hasAmenRef = useRef(hasAmen);

  // 외부 값 동기화
  useEffect(() => { totalLoopsRef.current = totalLoops; }, [totalLoops]);
  useEffect(() => { introMeasuresRef.current = introMeasures; }, [introMeasures]);
  useEffect(() => { hasAmenRef.current = hasAmen; }, [hasAmen]);

  const tempoRatio = useCallback(() => originalBpm.current / tempo, [tempo]);

  // ── MIDI 로드 및 구간 산출 ──
  useEffect(() => {
    if (!midiUrl) { setReady(false); return; }
    let cancelled = false;
    setLoading(true); setError(null); setReady(false);
    setPhase("idle"); phaseRef.current = "idle";

    fetch(midiUrl)
      .then((r) => { if (!r.ok) throw new Error("MIDI 로드 실패: " + r.status); return r.arrayBuffer(); })
      .then((buf) => {
        if (cancelled) return;
        const midi = new Midi(buf);
        originalDuration.current = midi.duration;

        if (midi.header.tempos?.length > 0) {
          originalBpm.current = Math.round(midi.header.tempos[0].bpm);
          setTempo(originalBpm.current);
        }

        // 전체 노트 수집
        const all = [];
        midi.tracks.forEach((t) =>
          t.notes.forEach((n) => {
            all.push({ time: n.time, duration: n.duration, midi: n.midi, velocity: n.velocity });
          })
        );
        all.sort((a, b) => a.time - b.time);

        // 마디 경계 계산
        const measures = computeMeasureBoundaries(midi);
        measuresRef.current = measures;

        // ── 마지막 마디 마지막 beat 음표 duration 보정 ──
        // 본곡 마지막 마디의 마지막 beat 음표들이 대응 마디보다 짧으면 보정
        const totalMeasuresCount = measures.length;
        if (totalMeasuresCount >= 2) {
          const lastMIdx = totalMeasuresCount - 1;
          const lastM = measures[lastMIdx];

          // 같은 박자의 대응 마디 찾기 (절반 위치 근처)
          const halfIdx = Math.floor(totalMeasuresCount / 2);
          let compIdx = null;
          for (let i = halfIdx - 2; i <= halfIdx + 2; i++) {
            if (i >= 0 && i < lastMIdx && measures[i].ts === lastM.ts) {
              compIdx = i;
              break;
            }
          }
          if (compIdx === null) {
            for (let i = lastMIdx - 1; i >= 0; i--) {
              if (measures[i].ts === lastM.ts) { compIdx = i; break; }
            }
          }

          if (compIdx !== null) {
            const compM = measures[compIdx];
            // 각 마디의 마지막 beat 음표들
            const lastBeatNotes = all.filter(
              (n) => n.time >= lastM.startSec && n.time < lastM.endSec
            );
            const compBeatNotes = all.filter(
              (n) => n.time >= compM.startSec && n.time < compM.endSec
            );

            if (lastBeatNotes.length > 0 && compBeatNotes.length > 0) {
              const lastBeatTick = Math.max(...lastBeatNotes.map((n) => n.time));
              const compBeatTick = Math.max(...compBeatNotes.map((n) => n.time));

              const lastFinal = lastBeatNotes.filter((n) => n.time === lastBeatTick);
              const compFinal = compBeatNotes.filter((n) => n.time === compBeatTick);

              const lastAvgDur = lastFinal.reduce((s, n) => s + n.duration, 0) / lastFinal.length;
              const compAvgDur = compFinal.reduce((s, n) => s + n.duration, 0) / compFinal.length;

              if (compAvgDur > lastAvgDur && (compAvgDur - lastAvgDur) / compAvgDur > 0.15) {
                // 15% 이상 짧으면 보정
                lastFinal.forEach((n) => {
                  const matchComp = compFinal.find((c) => true); // 대표 duration 사용
                  if (matchComp) {
                    console.log(
                      `[반주기] 마지막 음표 보정: note=${n.midi}, ` +
                      `${n.duration.toFixed(3)}s → ${matchComp.duration.toFixed(3)}s`
                    );
                    n.duration = matchComp.duration;
                  }
                });
              }
            }
          }
        }

        notesRef.current = all;

        // 첫 음표 시작 시간 (앞 공백)
        const firstNoteTime = all.length > 0 ? all[0].time : 0;

        // ── 구간 산출 ──
        const totalMeasures = measures.length;
        const introCount = Math.min(introMeasuresRef.current, totalMeasures);

        if (hasAmenRef.current) {
          // 아멘 = 마지막 1마디, 전주 = 그 앞에서 introCount 마디
          const amenIdx = totalMeasures - 1;
          const amenStart = measures[amenIdx].startSec;
          const amenEnd = measures[amenIdx].endSec;
          amenRangeRef.current = { start: amenStart, end: amenEnd };

          // 전주: 아멘 직전에서 introCount 마디
          const introStartIdx = Math.max(0, amenIdx - introCount);
          const introStart = measures[introStartIdx].startSec;
          const introEnd = amenStart; // 아멘 시작 전까지
          introRangeRef.current = { start: introStart, end: introEnd };

          // 본곡: MIDI 처음부터 ~ 아멘 시작 전 (못갖춘마디 준비 박자 유지)
          bodyRangeRef.current = { start: 0, end: amenStart };
        } else {
          // 아멘 없음
          amenRangeRef.current = { start: 0, end: 0 };

          // 전주: 마지막 introCount 마디
          const introStartIdx = Math.max(0, totalMeasures - introCount);
          const introStart = measures[introStartIdx].startSec;
          const introEnd = measures[totalMeasures - 1].endSec;
          introRangeRef.current = { start: introStart, end: introEnd };

          // 본곡: MIDI 처음부터 ~ MIDI 끝 (못갖춘마디 준비 박자 유지)
          bodyRangeRef.current = { start: 0, end: midi.duration };
        }

        // 전체 재생 시간 계산
        const introLen = introRangeRef.current.end - introRangeRef.current.start;
        const bodyLen = bodyRangeRef.current.end - bodyRangeRef.current.start;
        const amenLen = hasAmenRef.current
          ? amenRangeRef.current.end - amenRangeRef.current.start
          : 0;
        const totalPlayDur = introLen + bodyLen * totalLoopsRef.current + amenLen;
        totalPlayDurationRef.current = totalPlayDur;
        setDuration(totalPlayDur);

        console.log(
          `[반주기] MIDI 로드 완료: duration=${midi.duration.toFixed(2)}s, ` +
          `BPM=${originalBpm.current}, notes=${all.length}, measures=${totalMeasures}\n` +
          `  전주: ${introRangeRef.current.start.toFixed(2)}s ~ ${introRangeRef.current.end.toFixed(2)}s (${introLen.toFixed(2)}s)\n` +
          `  본곡: ${bodyRangeRef.current.start.toFixed(2)}s ~ ${bodyRangeRef.current.end.toFixed(2)}s (${bodyLen.toFixed(2)}s) × ${totalLoopsRef.current}절\n` +
          `  아멘: ${hasAmenRef.current ? `${amenRangeRef.current.start.toFixed(2)}s ~ ${amenRangeRef.current.end.toFixed(2)}s (${amenLen.toFixed(2)}s)` : "없음"}\n` +
          `  총 재생: ${totalPlayDur.toFixed(2)}s`
        );

        setLoading(false);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

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

  // ── 구간 내 노트 스케줄링 ──
  const scheduleRange = useCallback(
    (rangeStart, rangeEnd, timeOffset) => {
      // rangeStart~rangeEnd(원본 초) 구간의 노트를, timeOffset(재생 경과 초)부터 스케줄
      const piano = pianoRef.current;
      if (!piano) return;

      const r = tempoRatio();

      notesRef.current.forEach((n) => {
        if (n.time < rangeStart || n.time >= rangeEnd) return;
        const relativeTime = n.time - rangeStart; // 구간 내 상대 시간
        const dur = n.duration * r;
        const delay = relativeTime * r * 1000;

        const id = setTimeout(() => {
          if (!playingRef.current) return;
          piano.start({ note: n.midi, velocity: Math.round(n.velocity * 127), duration: dur });
        }, delay);
        scheduledRef.current.push(id);
      });

      // 구간 끝 도달 시 다음 phase로 전환
      const rangeDuration = (rangeEnd - rangeStart) * r;
      const endId = setTimeout(() => {
        if (!playingRef.current) return;
        advancePhaseRef.current();
      }, rangeDuration * 1000 + 50);
      scheduledRef.current.push(endId);
    },
    [tempoRatio]
  );

  // ── phase 전환 ──
  const advancePhase = useCallback(() => {
    const r = tempoRatio();
    const intro = introRangeRef.current;
    const body = bodyRangeRef.current;
    const amen = amenRangeRef.current;

    const currentPhase = phaseRef.current;

    // 이전 phase까지의 누적 시간 계산
    const introLen = (intro.end - intro.start) * r;
    const bodyLen = (body.end - body.start) * r;
    const amenLen = hasAmenRef.current ? (amen.end - amen.start) * r : 0;

    if (currentPhase === "intro") {
      // → body (1절)
      phaseRef.current = "body";
      setPhase("body");
      currentLoopRef.current = 0;
      setCurrentLoop(0);
      elapsedBeforePhaseRef.current = introLen;

      const ctx = audioCtxRef.current;
      if (ctx) startedAtRef.current = ctx.currentTime;
      scheduleRange(body.start, body.end, 0);

      console.log(`[반주기] phase: intro → body (1절)`);
    } else if (currentPhase === "body") {
      const nextLoop = currentLoopRef.current + 1;
      if (nextLoop < totalLoopsRef.current) {
        // → body (다음 절)
        currentLoopRef.current = nextLoop;
        setCurrentLoop(nextLoop);
        elapsedBeforePhaseRef.current = introLen + bodyLen * nextLoop;

        const ctx = audioCtxRef.current;
        if (ctx) startedAtRef.current = ctx.currentTime;
        scheduleRange(body.start, body.end, 0);

        console.log(`[반주기] phase: body → body (${nextLoop + 1}절)`);
      } else if (hasAmenRef.current) {
        // → amen
        phaseRef.current = "amen";
        setPhase("amen");
        elapsedBeforePhaseRef.current = introLen + bodyLen * totalLoopsRef.current;

        const ctx = audioCtxRef.current;
        if (ctx) startedAtRef.current = ctx.currentTime;
        scheduleRange(amen.start, amen.end, 0);

        console.log(`[반주기] phase: body → amen`);
      } else {
        // → done (아멘 없음)
        phaseRef.current = "done";
        setPhase("done");
        stopInternal();
        console.log(`[반주기] phase: body → done`);
      }
    } else if (currentPhase === "amen") {
      // → done
      phaseRef.current = "done";
      setPhase("done");
      stopInternal();
      console.log(`[반주기] phase: amen → done`);
    }
  }, [tempoRatio, scheduleRange]);

  const advancePhaseRef = useRef(advancePhase);
  useEffect(() => { advancePhaseRef.current = advancePhase; }, [advancePhase]);

  // ── tick (프로그레스 업데이트) ──
  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = ctx.currentTime - startedAtRef.current;
    const totalElapsed = elapsedBeforePhaseRef.current + elapsed;
    setCurrentTime(totalElapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── 재생 ──
  const play = useCallback(async () => {
    if (!ready) return;
    await ensurePiano();
    const ctx = audioCtxRef.current;

    // 처음부터 시작 (resume 기능은 추후 확장)
    clearScheduled();

    phaseRef.current = "intro";
    setPhase("intro");
    currentLoopRef.current = 0;
    setCurrentLoop(0);
    elapsedBeforePhaseRef.current = 0;
    setCurrentTime(0);

    const r = tempoRatio();
    const totalPlayDur =
      (introRangeRef.current.end - introRangeRef.current.start) * r +
      (bodyRangeRef.current.end - bodyRangeRef.current.start) * r * totalLoopsRef.current +
      (hasAmenRef.current ? (amenRangeRef.current.end - amenRangeRef.current.start) * r : 0);
    setDuration(totalPlayDur);

    startedAtRef.current = ctx.currentTime;
    playingRef.current = true;
    setPlaying(true);

    // 전주 구간 스케줄
    const intro = introRangeRef.current;
    scheduleRange(intro.start, intro.end, 0);

    rafRef.current = requestAnimationFrame(tick);
    console.log(`[반주기] play: 전주 시작`);
  }, [ready, ensurePiano, tempoRatio, scheduleRange, tick]);

  // ── 스케줄 정리 ──
  const clearScheduled = useCallback(() => {
    scheduledRef.current.forEach((id) => clearTimeout(id));
    scheduledRef.current = [];
  }, []);

  // ── 일시정지 ──
  const pause = useCallback(() => {
    clearScheduled();
    pianoRef.current?.stop();
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, [clearScheduled]);

  // ── 정지 (내부용, phase를 done으로 바꾸지 않음) ──
  const stopInternal = useCallback(() => {
    clearScheduled();
    pianoRef.current?.stop();
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, [clearScheduled]);

  // ── 정지 (외부 호출용) ──
  const stop = useCallback(() => {
    stopInternal();
    setCurrentTime(0);
    currentLoopRef.current = 0;
    setCurrentLoop(0);
    elapsedBeforePhaseRef.current = 0;
    phaseRef.current = "idle";
    setPhase("idle");
  }, [stopInternal]);

  // ── 템포 변경 ──
  const changeTempo = useCallback((newTempo) => {
    setTempo(newTempo);
    const r = originalBpm.current / newTempo;

    // 총 재생 시간 재계산
    const introLen = (introRangeRef.current.end - introRangeRef.current.start) * r;
    const bodyLen = (bodyRangeRef.current.end - bodyRangeRef.current.start) * r;
    const amenLen = hasAmenRef.current
      ? (amenRangeRef.current.end - amenRangeRef.current.start) * r
      : 0;
    setDuration(introLen + bodyLen * totalLoopsRef.current + amenLen);

    // 재생 중이면 정지 후 처음부터 (구간 중간 resume은 복잡하므로 v1에서는 미지원)
    if (playingRef.current) {
      stop();
    }
  }, [stop]);

  // ── 프로그레스 ──
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // ── phase 라벨 (UI 표시용) ──
  const phaseLabel =
    phase === "intro" ? "전주" :
    phase === "body" ? `${currentLoop + 1}절` :
    phase === "amen" ? "아멘" :
    phase === "done" ? "완료" : "";

  // ── cleanup ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      scheduledRef.current.forEach((id) => clearTimeout(id));
      pianoRef.current?.stop();
    };
  }, []);

  return {
    // 상태
    loading: loading || pianoLoading,
    ready,
    error,
    playing,

    // 시간
    currentTime,
    duration,
    progress,
    displayTime: currentTime,

    // phase & loop
    phase,
    phaseLabel,
    currentLoop,
    totalLoops,

    // 템포
    tempo,

    // 컨트롤
    play,
    pause,
    stop,
    changeTempo,
  };
}
