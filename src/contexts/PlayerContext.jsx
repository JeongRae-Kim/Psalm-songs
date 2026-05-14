import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useMidiPlayer from "../hooks/useMidiPlayer";
import useAccompanistPlayer from "../hooks/useAccompanistPlayer";
import { useTheme } from "./ThemeContext";
import usePlayback from "./PlaybackContext";

/**
 * PlayerContext v2 — 재생 엔진 전역화 (단계 B-1)
 *
 * 변경 이력:
 *   - 단계 A: Provider 골격만 (placeholder).
 *   - 단계 B-1: 재생 엔진(useMidiPlayer / useAccompanistPlayer)을
 *     SongDetailPage에서 이곳으로 이동. Provider가 currentSong을 보유한다.
 *
 * 설계 (B-1 설계명세 기준):
 *   - 방식 1: Provider가 currentSong을 자체 상태로 보유.
 *   - 선택지 A: loadSong(song)으로 곡 객체를 통째로 주입받음.
 *     Provider는 useSongs를 호출하지 않는다.
 *   - 엔진 2개(midi, accompanist)는 B-1에서는 기존과 동일하게 항상 호출.
 *     훅 2개 동시 실행 정리는 단계 E.
 *
 * B-1 시점의 의도된 한계:
 *   - loadSong은 단순 대입만 함. "같은 곡이면 재로드 안 함" / "곡 바뀌면
 *     정지" 로직은 단계 B-2·C에서 추가.
 *   - 따라서 B-1 직후에도 "설정 다녀오면 초기화" 문제는 아직 남아 있다.
 *   - 자동재생 로직은 이곳으로 옮기되 동작은 기존과 동일하게 유지(정리는 단계 D).
 */

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const navigate = useNavigate();
  const { instrument } = useTheme();
  const {
    playbackMode,
    goToNext,
    consumeAutoPlay,
    exitPlaylistMode,
  } = usePlayback();

  // ── Provider가 보유하는 상태 ──
  const [currentSong, setCurrentSong] = useState(null);
  const [activeTab, setActiveTab] = useState("sheet");

  // currentSong의 최신값을 loadSong 콜백에서 stale 없이 참조하기 위한 ref
  const currentSongRef = useRef(null);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  // ── currentSong에서 파생되는 엔진 입력값 ──
  const hasMidi = Boolean(currentSong?.midiFile);
  const midiFile = hasMidi ? currentSong.midiFile : null;
  const totalLoops = currentSong?.verses?.length || 1;
  const introMeasures = currentSong?.introMeasures || 4;
  const hasAmen = currentSong?.hasAmen || false;

  // ── 곡 종료 핸들러 (SongDetailPage에서 이동) ──
  // 플레이리스트 모드면 다음 곡으로 자동 이동, 아니면 기본 정지 동작.
  const handleSongEnded = useCallback(() => {
    if (playbackMode !== "playlist") return; // single 모드는 기본 정지 유지
    const nextId = goToNext();
    if (nextId) {
      navigate(`/song/${nextId}`);
    } else {
      exitPlaylistMode();
    }
  }, [playbackMode, goToNext, navigate, exitPlaylistMode]);

  // ── 재생 엔진 (B-1: 기존과 동일하게 항상 2개 호출) ──
  const midi = useMidiPlayer(midiFile, totalLoops, instrument, handleSongEnded);
  const accompanist = useAccompanistPlayer(
    midiFile,
    totalLoops,
    introMeasures,
    hasAmen,
    instrument,
    handleSongEnded
  );

  // 두 엔진의 stop을 ref로 잡아 loadSong이 매 렌더 재생성되지 않도록 한다.
  const midiStopRef = useRef(null);
  const accompanistStopRef = useRef(null);
  useEffect(() => { midiStopRef.current = midi.stop; }, [midi.stop]);
  useEffect(() => { accompanistStopRef.current = accompanist.stop; }, [accompanist.stop]);

  // ── 곡 로드 (선택지 가: 곡이 바뀌면 정지까지 책임) ──
  // 같은 곡이면(재마운트 등) 아무것도 하지 않음 → 재생 상태 보존.
  // 다른 곡이면 이전 재생을 정지하고 새 곡으로 교체.
  //
  // 단계 C 예정: "같은 곡 판정"을 더 정교화하고, 곡 변경 시 정지/초기화
  // 책임을 이곳으로 완전히 일원화한다. (지금은 B-1 범위의 최소 형태)
  const loadSong = useCallback((song) => {
    const prev = currentSongRef.current;
    const prevId = prev?.id ?? null;
    const nextId = song?.id ?? null;

    if (prevId === nextId) {
      // 같은 곡 — 재마운트 등. 재생 상태를 건드리지 않는다.
      return;
    }

    // 곡이 바뀜 — 이전 재생을 정지하고 교체
    midiStopRef.current?.();
    accompanistStopRef.current?.();
    setCurrentSong(song || null);
  }, []);

  // ── 활성 플레이어 결정 ──
  // 악보/가사 탭은 midi, 반주기 탭은 accompanist.
  const activePlayer = activeTab === "accompanist" ? accompanist : midi;

  // ── 탭 전환 시 비활성 플레이어 정지 (SongDetailPage에서 이동) ──
  // 반주기 탭으로 오면 midi 정지, 다른 탭으로 가면 accompanist 정지.
  useEffect(() => {
    if (activeTab === "accompanist") {
      if (midi.playing) midi.stop();
    } else {
      if (accompanist.playing) accompanist.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── 자동재생 (SongDetailPage에서 이동, 동작 동일하게 유지) ──
  // 플레이리스트 모드에서 곡 진입/변경 시 활성 플레이어가 ready가 되면 자동 재생.
  // 정리(곡 변경에만 결합, 재마운트와 분리)는 단계 D.
  const activePlayerReady =
    activeTab === "accompanist" ? accompanist.ready : midi.ready;

  useEffect(() => {
    if (playbackMode !== "playlist") return;
    if (!activePlayerReady) return;

    const t = setTimeout(() => {
      const shouldAutoPlay = consumeAutoPlay();
      if (!shouldAutoPlay) return;
      try {
        if (activeTab === "accompanist") {
          accompanist.play();
        } else {
          midi.play();
        }
      } catch (e) {
        console.warn("[PlayerContext] 자동재생 play() 실패:", e);
      }
    }, 100);

    return () => clearTimeout(t);
    // 의도적으로 midi/accompanist 객체는 의존성에서 제외
    // (매 렌더마다 새 객체 → 무한 재실행 방지). setTimeout 콜백 내에서
    // 호출 시점에 클로저로 참조하므로 stale 위험 낮음. (기존 로직과 동일)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackMode, activeTab, activePlayerReady, currentSong?.id, consumeAutoPlay]);

  // ── context value ──
  const value = {
    // 곡 관리
    currentSong,
    loadSong,
    activeTab,
    setActiveTab,

    // 곡 존재 여부 (페이지가 MiniPlayer 표시 여부 판단에 사용)
    hasMidi,

    // 활성 플레이어 패스스루 (activeTab에 따라 midi 또는 accompanist)
    ready: activePlayer.ready,
    loading: activePlayer.loading,
    playing: activePlayer.playing,
    error: activePlayer.error,
    currentTime: activePlayer.currentTime,
    duration: activePlayer.duration,
    progress: activePlayer.progress,
    displayTime: activePlayer.displayTime,
    currentLoop: activePlayer.currentLoop,
    totalLoops: activePlayer.totalLoops,
    phase: activePlayer.phase,             // accompanist 전용. midi일 땐 undefined
    phaseLabel: activePlayer.phaseLabel,   // accompanist 전용
    infiniteLoop: activePlayer.infiniteLoop,
    toggleInfiniteLoop: activePlayer.toggleInfiniteLoop,
    tempo: activePlayer.tempo,
    play: activePlayer.play,
    pause: activePlayer.pause,
    stop: activePlayer.stop,
    seekTo: activePlayer.seekTo,
    changeTempo: activePlayer.changeTempo,

    // 가사 탭 전용 — 항상 midi 기준 (B-1 설계명세 2-5)
    lyricsCurrentLoop: midi.currentLoop,
    lyricsPlaying: midi.playing,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export default function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer는 PlayerProvider 내부에서만 사용 가능합니다");
  }
  return ctx;
}
