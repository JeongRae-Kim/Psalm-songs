/**
 * useMetronomePlayer.js v1
 * MXL 파일에서 박자/템포 추출 → 메트로놈 클릭 + cursor 동기화 가상 시간 진행
 *
 * useMidiPlayer와 동일한 인터페이스를 제공하여 OsmdView를 그대로 재사용 가능.
 * mid 파일이 없어도 동작 (박자 연습 모드).
 *
 * 핵심 동작:
 * 1. mxl 로드 → OSMD 임시 인스턴스로 파싱 (렌더링은 안 함)
 * 2. 박자(time signature), 템포(BPM), 총 박자 수 추출
 * 3. 합성 melodyTimes 생성 (각 박자 시점)
 * 4. Web Audio API 정확한 스케줄러로 메트로놈 클릭 + 가상 시간 진행
 *
 * 메트로놈 클릭:
 * - 강박 (1박): 1000Hz, 0.05초
 * - 약박: 600Hz, 0.05초
 * - 사운드 OFF 시 cursor만 진행
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

const DEFAULT_BPM = 110;
const SCHEDULER_INTERVAL_MS = 25;       // 스케줄러 호출 주기
const SCHEDULER_LOOKAHEAD_SEC = 0.1;    // 미리 스케줄할 시간 윈도우
const CLICK_DURATION_SEC = 0.05;        // 메트로놈 클릭 길이
const STRONG_BEAT_FREQ = 1000;          // 강박 주파수 (Hz)
const WEAK_BEAT_FREQ = 600;             // 약박 주파수 (Hz)

export default function useMetronomePlayer(mxlUrl, totalLoops = 1) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(DEFAULT_BPM);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 추출된 곡 정보 (불변)
  const originalBpmRef = useRef(DEFAULT_BPM);
  const beatsPerMeasureRef = useRef(4);
  const totalBeatsRef = useRef(0);
  const beatTimesRef = useRef([]);          // 합성 박자별 시간 배열 (멜로디 타이밍 대용)
  const oneCycleDurationRef = useRef(0);    // 1회 재생 길이 (초, 원본 BPM 기준)

  // 재생 상태
  const audioCtxRef = useRef(null);
  const playingRef = useRef(false);
  const totalLoopsRef = useRef(totalLoops);
  const currentLoopRef = useRef(0);
  const tempoRef = useRef(DEFAULT_BPM);
  const soundEnabledRef = useRef(true);

  // 스케줄러
  const nextBeatIdxRef = useRef(0);              // 다음 스케줄할 박자 인덱스 (0부터)
  const nextBeatTimeRef = useRef(0);             // 다음 박자 audioContext 시간 (초)
  const playStartCtxTimeRef = useRef(0);         // 재생 시작 시점의 audioContext.currentTime
  const playStartVirtualTimeRef = useRef(0);     // 재생 시작 시점의 가상 시간 (초)
  const schedulerIntervalRef = useRef(null);
  const rafRef = useRef(null);

  // ── totalLoops/tempo/soundEnabled ref 동기화 ──
  useEffect(() => { totalLoopsRef.current = totalLoops; }, [totalLoops]);
  useEffect(() => { tempoRef.current = tempo; }, [tempo]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // ── 템포 비율 (원본 / 현재) ──
  const tempoRatio = useCallback(() => originalBpmRef.current / tempoRef.current, []);

  // ── MXL 로드 + 박자/템포 추출 ──
  useEffect(() => {
    if (!mxlUrl) { setReady(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);

    // OSMD 임시 인스턴스 (DOM 렌더링 없음)
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

        // 박자/템포 추출
        let bpm = DEFAULT_BPM;
        let beatsPerMeasure = 4;
        let beatUnit = 4;  // 4분음표 단위

        try {
          const sheet = osmd.Sheet;

          // 템포: DefaultStartTempoInBpm 우선, 없으면 첫 마디의 TempoInBPM
          if (sheet.DefaultStartTempoInBpm && sheet.DefaultStartTempoInBpm > 0) {
            bpm = Math.round(sheet.DefaultStartTempoInBpm);
          } else if (sheet.SourceMeasures?.[0]?.TempoInBPM) {
            bpm = Math.round(sheet.SourceMeasures[0].TempoInBPM);
          }

          // 박자: 첫 마디의 ActiveTimeSignature
          const firstMeasure = sheet.SourceMeasures?.[0];
          const ts = firstMeasure?.ActiveTimeSignature;
          if (ts) {
            beatsPerMeasure = ts.Numerator || 4;
            beatUnit = ts.Denominator || 4;
          }
        } catch (e) {
          console.warn("박자/템포 추출 실패, 기본값 사용:", e.message);
        }

        // cursor를 돌려 총 박자 수 카운트 + 박자별 시간 계산
        // (cursor 스텝 != 박자가 아니지만, 실용적으로 마디 수 × 박자수로 계산)
        let totalMeasures = 0;
        try {
          totalMeasures = osmd.Sheet.SourceMeasures?.length || 0;
        } catch (e) {
          totalMeasures = 0;
        }

        const totalBeats = totalMeasures * beatsPerMeasure;
        const beatDuration = 60 / bpm;  // 1박자 시간 (초, 원본 BPM)

        // beatUnit 보정: 4/4박자가 아닌 경우 (예: 3/2박자)
        // 2분음표 박자라면 한 박자 시간이 2배. quarter note 기준으로 환산.
        const beatUnitRatio = 4 / beatUnit;  // 2분음표=2, 4분음표=1, 8분음표=0.5
        const adjustedBeatDuration = beatDuration * beatUnitRatio;

        // 합성 박자별 시간 배열
        const times = [];
        for (let i = 0; i < totalBeats; i++) {
          times.push(i * adjustedBeatDuration);
        }

        const oneCycleDuration = totalBeats * adjustedBeatDuration;

        originalBpmRef.current = bpm;
        beatsPerMeasureRef.current = beatsPerMeasure;
        totalBeatsRef.current = totalBeats;
        beatTimesRef.current = times;
        oneCycleDurationRef.current = oneCycleDuration;

        setTempo(bpm);
        setDuration(oneCycleDuration);

        console.log(`[Metronome] BPM=${bpm}, ${beatsPerMeasure}/${beatUnit}박자, 마디=${totalMeasures}, 총박자=${totalBeats}, 1회=${oneCycleDuration.toFixed(2)}초`);

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
  }, [mxlUrl]);

  // ── AudioContext 초기화 ──
  const ensureAudioContext = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
  }, []);

  // ── 메트로놈 클릭 재생 ──
  const playClick = useCallback((time, isStrong) => {
    if (!soundEnabledRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = isStrong ? STRONG_BEAT_FREQ : WEAK_BEAT_FREQ;
    osc.type = "sine";

    // 클릭 envelope (빠른 attack, 빠른 release)
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SEC);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + CLICK_DURATION_SEC + 0.01);
  }, []);

  // ── 스케줄러 (lookahead 패턴) ──
  const scheduler = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const r = tempoRatio();  // 원본/현재 비율
    const beatsPerMeasure = beatsPerMeasureRef.current;

    // lookahead 윈도우 안에 들어올 박자들을 미리 스케줄
    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULER_LOOKAHEAD_SEC) {
      const beatIdx = nextBeatIdxRef.current;

      if (beatIdx >= totalBeatsRef.current) {
        // 1회 재생 끝 → 다음 loop 또는 정지
        const nextLoop = currentLoopRef.current + 1;
        if (nextLoop < totalLoopsRef.current) {
          // 다음 반복 시작
          currentLoopRef.current = nextLoop;
          setCurrentLoop(nextLoop);
          nextBeatIdxRef.current = 0;
          // nextBeatTimeRef는 이어서 진행 (시간 점프 없음)
          // 가상 시간도 0으로 리셋
          playStartCtxTimeRef.current = nextBeatTimeRef.current;
          playStartVirtualTimeRef.current = 0;
          continue;  // 다음 박자 즉시 스케줄
        } else {
          // 모든 반복 종료 → 정지 예약
          const stopTime = nextBeatTimeRef.current;
          setTimeout(() => {
            if (playingRef.current) {
              stopRef.current?.();
            }
          }, Math.max(0, (stopTime - ctx.currentTime) * 1000));
          return;
        }
      }

      // 강박/약박 판정
      const beatInMeasure = beatIdx % beatsPerMeasure;
      const isStrong = beatInMeasure === 0;

      // 메트로놈 클릭 스케줄
      playClick(nextBeatTimeRef.current, isStrong);

      // 박자 카운트 업데이트 (UI용, 실제 박자 시점에 발동)
      const beatTime = nextBeatTimeRef.current;
      const delayMs = Math.max(0, (beatTime - ctx.currentTime) * 1000);
      const displayBeat = beatInMeasure + 1;
      setTimeout(() => {
        if (playingRef.current) setCurrentBeat(displayBeat);
      }, delayMs);

      // 다음 박자 시간 = 이번 박자 + 1박자 간격 (현재 BPM 기준)
      const beatInterval = (60 / tempoRef.current) * (4 / (beatsPerMeasureRef.current === 0 ? 4 : 4)) * 1;
      // ↑ beatUnit 보정은 originalBpm 기준으로만 이미 반영됨; 현재 BPM은 단순 60/BPM
      // 정확히는: 현재 박자 간격 = (60 / tempoRef.current) × beatUnitRatio
      // beatUnitRatio는 originalBpmRef 기준에서 계산되므로 별도 저장 필요
      // → 간단히: oneCycleDuration / totalBeats 를 r로 보정
      const adjustedBeatInterval = (oneCycleDurationRef.current / totalBeatsRef.current) * r;

      nextBeatTimeRef.current += adjustedBeatInterval;
      nextBeatIdxRef.current = beatIdx + 1;
    }
  }, [tempoRatio, playClick]);

  // ── tick (가상 시간 업데이트, RAF) ──
  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const r = tempoRatio();
    // 가상 시간 = 시작 시점의 가상 시간 + 경과 시간 (원본 BPM 기준)
    const elapsed = ctx.currentTime - playStartCtxTimeRef.current;
    const virtualElapsed = elapsed / r;  // 현재 BPM에서의 경과를 원본 BPM 시간으로 변환
    const t = playStartVirtualTimeRef.current + virtualElapsed;

    // 1회분을 넘어가면 0으로 wrap (cursor가 처음으로 돌아감)
    const wrapped = t % oneCycleDurationRef.current;
    setCurrentTime(wrapped);

    rafRef.current = requestAnimationFrame(tick);
  }, [tempoRatio]);

  // stop ref (스케줄러 내부에서 호출)
  const stopRef = useRef(null);

  // ── 재생 ──
  const play = useCallback(async () => {
    if (!ready) return;
    await ensureAudioContext();
    const ctx = audioCtxRef.current;

    // 마지막 loop 끝난 후 재생 시 처음부터
    if (currentLoopRef.current >= totalLoopsRef.current) {
      currentLoopRef.current = 0;
      setCurrentLoop(0);
      setCurrentTime(0);
    }

    // 현재 가상 시간을 박자 인덱스로 환산
    const beatInterval = oneCycleDurationRef.current / totalBeatsRef.current;
    const startBeatIdx = Math.floor(currentTime / beatInterval);

    nextBeatIdxRef.current = startBeatIdx;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;  // 50ms 후 첫 박자 시작 (스케줄링 여유)

    playStartCtxTimeRef.current = ctx.currentTime + 0.05;
    playStartVirtualTimeRef.current = startBeatIdx * beatInterval;

    playingRef.current = true;
    setPlaying(true);

    // 스케줄러 즉시 1회 + 주기 시작
    scheduler();
    schedulerIntervalRef.current = setInterval(scheduler, SCHEDULER_INTERVAL_MS);

    // 가상 시간 진행
    rafRef.current = requestAnimationFrame(tick);
  }, [ready, ensureAudioContext, currentTime, scheduler, tick]);

  // ── 일시정지 ──
  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);

    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── 정지 (처음으로) ──
  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);

    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setCurrentTime(0);
    currentLoopRef.current = 0;
    setCurrentLoop(0);
    setCurrentBeat(1);
  }, []);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // ── 탐색 ──
  const seekTo = useCallback((fraction) => {
    const t = Math.max(0, Math.min(1, fraction)) * oneCycleDurationRef.current;
    if (playingRef.current) {
      pause();
      setCurrentTime(t);
      setTimeout(() => play(), 50);
    } else {
      setCurrentTime(t);
    }
  }, [pause, play]);

  // ── 템포 변경 ──
  const changeTempo = useCallback((newTempo) => {
    setTempo(newTempo);
    const newRatio = originalBpmRef.current / newTempo;
    setDuration(oneCycleDurationRef.current * newRatio);

    if (playingRef.current) {
      // 재생 중 템포 변경: 현재 시점부터 재시작
      const t = currentTime;
      pause();
      setCurrentTime(t);
      setTimeout(() => play(), 50);
    }
  }, [currentTime, pause, play]);

  // ── 사운드 토글 ──
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  // ── 정리 ──
  useEffect(() => {
    return () => {
      if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (e) { /* 무시 */ }
      }
    };
  }, []);

  // ── 계산값 ──
  const r = tempoRatio();
  const adjustedDuration = oneCycleDurationRef.current * r;
  const adjustedCurrentTime = currentTime * r;
  const progress = oneCycleDurationRef.current > 0
    ? Math.min(1, currentTime / oneCycleDurationRef.current)
    : 0;

  return {
    loading,
    ready,
    error,
    playing,
    currentTime,                      // 가상 시간 (원본 BPM 기준, 초)
    originalTime: currentTime,        // OsmdView용 별칭
    duration: adjustedDuration,       // 템포 적용 후 1회 길이 (프로그레스용)
    displayTime: adjustedCurrentTime, // 템포 적용 후 현재 시간 (표시용)
    progress,
    tempo,
    melodyTimes: beatTimesRef.current,  // 합성 박자별 시간 (OsmdView 비례 매핑용)
    currentLoop,
    totalLoops,
    beatsPerMeasure: beatsPerMeasureRef.current,
    currentBeat,                      // 현재 마디 내 박자 (1, 2, 3, ...)
    soundEnabled,

    play, pause, stop, seekTo, changeTempo, toggleSound,
  };
}
