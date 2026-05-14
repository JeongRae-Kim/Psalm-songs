import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useMidiPlayer from "../hooks/useMidiPlayer";
import useAccompanistPlayer from "../hooks/useAccompanistPlayer";
import { useTheme } from "./ThemeContext";
import usePlayback from "./PlaybackContext";

/**
 * PlayerContext v4 — 재생 엔진 전역화 (단계 E) + 모드 인지 반복 (7-1)
 *
 * 변경 이력:
 *   - 단계 A: Provider 골격만 (placeholder).
 *   - 단계 B-1: 재생 엔진(useMidiPlayer / useAccompanistPlayer)을
 *     SongDetailPage에서 이곳으로 이동. Provider가 currentSong을 보유한다.
 *   - 단계 E: 훅 중복 실행 정리. 두 엔진은 React 훅 규칙상 여전히 둘 다
 *     호출하되, 비활성 엔진에는 midiFile 대신 null을 주입한다. 두 훅 모두
 *     midiUrl이 falsy면 fetch·파싱을 건너뛰는 가드를 이미 갖고 있으므로
 *     (useMidiPlayer.js / useAccompanistPlayer.js의 MIDI 로드 effect),
 *     훅 내부 코드는 한 줄도 바꾸지 않는다.
 *   - 7-1: 반복 버튼을 playbackMode 인지로 전환. 기존에는 반복 버튼이
 *     모드와 무관하게 항상 엔진의 infiniteLoop(개별 곡 무한 반복)만
 *     토글해, 플레이리스트 모드에서 반복을 켜면 곡이 끝나도 onEnded가
 *     호출되지 않아 다음 곡으로 진행하지 못했다. 이제:
 *       · single 모드 → 엔진 infiniteLoop 토글 (현행 유지)
 *       · playlist 모드 → PlaybackContext의 loopPlaylist 토글
 *     또한 single 모드에서 infiniteLoop를 켠 채 플레이리스트가 시작되면
 *     엔진 infiniteLoop를 강제 해제해, 곡 종료 분기가 onEnded를 막지
 *     않도록 한다. 엔진 훅(useMidiPlayer.js / useAccompanistPlayer.js)과
 *     PlaybackContext.jsx는 무변경 — REFACTOR_PLAN 2장 "엔진 내부 무변경
 *     원칙"을 그대로 지킨다.
 *
 * 설계 (B-1 설계명세 기준):
 *   - 방식 1: Provider가 currentSong을 자체 상태로 보유.
 *   - 선택지 A: loadSong(song)으로 곡 객체를 통째로 주입받음.
 *     Provider는 useSongs를 호출하지 않는다.
 *
 * 단계 E의 의도된 동작:
 *   - 곡 진입 시 활성 탭에 해당하는 엔진만 MIDI를 1회 fetch·파싱한다.
 *     (기존: 두 엔진이 각 1회 = 곡당 2회)
 *   - 탭 전환 시 새로 활성이 된 엔진의 midiUrl이 null→실제URL로 바뀌며
 *     그 엔진이 재파싱한다. 두 훅 모두 파싱 결과 캐시가 없으므로 같은 곡
 *     안에서 탭을 왕복하면 그때마다 재파싱이 발생한다. 12곡 환경에서는
 *     체감 지연이 거의 없으며, 필요 시 캐싱은 별도 단계로 다룬다.
 *   - "탭 전환 시 그 탭의 재생이 정지 상태로 시작"되는 동작은 B-1과 동일
 *     (아래 activeTab effect의 stop() 호출). 단계 E가 추가하는 것은
 *     재생 버튼 활성화까지의 짧은 로딩 지연뿐이다.
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
    loopPlaylist,
    toggleLoopPlaylist,
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

  // ── 재생 엔진 (단계 E: 활성 탭의 엔진에만 midiFile 주입) ──
  // React 훅 규칙상 두 훅은 여전히 무조건 호출한다(조건부 호출 불가).
  // 대신 비활성 엔진에는 midiFile 대신 null을 넘긴다. 두 훅 모두 MIDI 로드
  // effect 첫머리에 `if (!midiUrl) { setReady(false); return; }` 가드가
  // 있으므로, null을 받은 엔진은 fetch·파싱을 건너뛴다.
  //
  // 활성 판정: 악보/가사 탭 → midi, 반주기 탭 → accompanist.
  const midiActive = activeTab !== "accompanist";
  const accompanistActive = activeTab === "accompanist";

  const midiInput = midiActive ? midiFile : null;
  const accompanistInput = accompanistActive ? midiFile : null;

  const midi = useMidiPlayer(midiInput, totalLoops, instrument, handleSongEnded);
  const accompanist = useAccompanistPlayer(
    accompanistInput,
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

  // ── 7-1: 모드 인지 반복 (single=엔진 무한반복 / playlist=전체 반복) ──
  // 반복 버튼은 하나지만 playbackMode에 따라 다른 대상을 토글한다.
  //   - single 모드   → activePlayer.infiniteLoop (엔진 개별 곡 무한 반복)
  //   - playlist 모드 → PlaybackContext.loopPlaylist (플레이리스트 전체 반복)
  // 두 모드는 상호 배타이므로 동시에 켜질 상황이 없다.
  const isPlaylistMode = playbackMode === "playlist";
  const repeatActive = isPlaylistMode ? loopPlaylist : activePlayer.infiniteLoop;
  const repeatMode = isPlaylistMode ? "playlist" : "single";

  const toggleRepeat = useCallback(() => {
    if (playbackMode === "playlist") {
      toggleLoopPlaylist();
    } else {
      activePlayer.toggleInfiniteLoop?.();
    }
  }, [playbackMode, toggleLoopPlaylist, activePlayer]);

  // ── 7-1: 플레이리스트 진입 시 엔진 infiniteLoop 강제 해제 ──
  // single 모드에서 엔진 infiniteLoop를 켠 채로 플레이리스트가 시작되면,
  // 엔진의 곡 종료 분기가 여전히 infiniteLoop=true로 빠져 onEnded를
  // 호출하지 않는다 → goToNext가 막혀 다음 곡으로 진행 못 함.
  // playbackMode가 playlist로 바뀌는 순간 두 엔진의 infiniteLoop를 끈다.
  // (엔진 객체는 매 렌더 새로 생성되므로 의존성에서 제외 — activeTab
  //  정지 effect와 동일한 패턴)
  useEffect(() => {
    if (playbackMode !== "playlist") return;
    if (midi.infiniteLoop) midi.toggleInfiniteLoop?.();
    if (accompanist.infiniteLoop) accompanist.toggleInfiniteLoop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackMode]);

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
    // 7-1: 반복 상태/토글은 모드 인지 값으로 노출.
    //   - single   → 엔진 infiniteLoop
    //   - playlist → PlaybackContext.loopPlaylist
    // 인터페이스 이름(infiniteLoop/toggleInfiniteLoop)은 그대로 유지해
    // MiniPlayer 등 구독자의 변경을 최소화한다. repeatMode로 현재 의미를
    // 구분할 수 있다(버튼 툴팁/라벨용).
    infiniteLoop: repeatActive,
    toggleInfiniteLoop: toggleRepeat,
    repeatMode,                            // "single" | "playlist"
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
