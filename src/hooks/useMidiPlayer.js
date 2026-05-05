/**
 * useMidiPlayer.js v4
 * MIDI 파일 로드/파싱 + SoundFont 피아노 재생 (smplr)
 * 단순 재생 구조 — MIDI를 처음부터 끝까지 한 번 재생
 *
 * 반복/아멘 처리는 악보 입력 시 MuseScore에서 반복기호를 사용하여
 * MIDI 내보내기 시 자동으로 풀리도록 함 (앱 코드 수정 불필요)
 *
 * 필요 패키지: npm install @tonejs/midi smplr
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Midi } from "@tonejs/midi";
import { SplendidGrandPiano } from "smplr";

export default function useMidiPlayer(midiUrl) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [pianoLoading, setPianoLoading] = useState(false);

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
        notesRef.current = all;

        if (midi.tracks.length > 0) {
          melodyTimesRef.current = midi.tracks[0].notes.map((n) => n.time).sort((a, b) => a - b);
        }

        setLoading(false); setReady(true);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [midiUrl]);

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

    // 곡 끝나면 자동 정지
    const endDelay = (originalDuration.current - fromTime) * r * 1000;
    const endId = setTimeout(() => { if (playingRef.current) stop(); }, endDelay + 100);
    scheduledRef.current.push(endId);
  }, [tempoRatio]);

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
    if (ctx.state === "suspended") await ctx.resume();

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
    cancelAnimationFrame(rafRef.current);
  }, []);

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
    duration: adjustedDuration,     // 템포 적용 후 총 길이 (프로그레스 바)
    displayTime: adjustedCurrentTime, // 템포 적용 후 현재 시간 (표시용)
    progress,                       // 0~1
    tempo,
    melodyTimes: melodyTimesRef.current,
    play, pause, stop, seekTo, changeTempo,
  };
}
