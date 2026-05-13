import { createContext, useContext, useState, useCallback, useRef } from "react";

/**
 * PlaybackContext v1
 * 재생 모드와 플레이리스트 재생 순서를 앱 전역에서 관리
 *
 * 모드:
 *   - "single": 단일 곡 모드 (홈/즐겨찾기/최근에서 곡 클릭)
 *   - "playlist": 플레이리스트 모드 (플레이리스트 페이지에서 재생 시작)
 *
 * 플레이리스트 모드 동작:
 *   - 곡 끝나면 자동으로 다음 곡으로 이동
 *   - 전체 반복 ON 시 마지막 곡 후 첫 곡으로 복귀
 *   - 곡 무한 반복(곡 페이지의 ↻)이 ON이면 플레이리스트 진행 안 함 (우선순위 1)
 */

const PlaybackContext = createContext(null);

export function PlaybackProvider({ children }) {
  // 모드
  const [playbackMode, setPlaybackMode] = useState("single");

  // 플레이리스트 재생 상태
  const [playlistSongIds, setPlaylistSongIds] = useState([]); // 재생할 곡 ID 순서
  const [currentIndex, setCurrentIndex] = useState(0);        // 현재 재생 중인 인덱스
  const [loopPlaylist, setLoopPlaylist] = useState(false);    // 전체 반복 모드

  // pendingAutoPlay: 곡 페이지 이동 후 자동 재생 트리거 플래그
  // (true면 SongDetailPage가 마운트/로드 후 자동으로 play() 호출)
  const pendingAutoPlayRef = useRef(false);

  // ── 플레이리스트 모드로 진입 ──
  const startPlaylist = useCallback((songIds, startIndex = 0) => {
    if (!songIds || songIds.length === 0) return null;
    const idx = Math.max(0, Math.min(startIndex, songIds.length - 1));
    console.log("[Playback 진단] startPlaylist 호출:", { songIds, startIndex: idx, firstId: songIds[idx] });
    setPlaylistSongIds(songIds);
    setCurrentIndex(idx);
    setPlaybackMode("playlist");
    pendingAutoPlayRef.current = true;
    console.log("[Playback 진단] → pendingAutoPlay = true 설정");
    return songIds[idx];
  }, []);

  // ── 단일 곡 모드로 전환 ──
  const exitPlaylistMode = useCallback(() => {
    setPlaybackMode("single");
    pendingAutoPlayRef.current = false;
  }, []);

  // ── 전체 반복 토글 ──
  const toggleLoopPlaylist = useCallback(() => {
    setLoopPlaylist((prev) => !prev);
  }, []);

  // ── 다음 곡으로: 다음 곡 ID 반환, 없으면 null ──
  // 전체 반복 ON이면 마지막 후 첫 곡으로 wrap
  const goToNext = useCallback(() => {
    if (playbackMode !== "playlist" || playlistSongIds.length === 0) return null;
    const next = currentIndex + 1;
    if (next < playlistSongIds.length) {
      setCurrentIndex(next);
      pendingAutoPlayRef.current = true;
      return playlistSongIds[next];
    }
    if (loopPlaylist) {
      setCurrentIndex(0);
      pendingAutoPlayRef.current = true;
      return playlistSongIds[0];
    }
    return null;
  }, [playbackMode, playlistSongIds, currentIndex, loopPlaylist]);

  // ── 이전 곡으로: 이전 곡 ID 반환, 없으면 null ──
  const goToPrev = useCallback(() => {
    if (playbackMode !== "playlist" || playlistSongIds.length === 0) return null;
    const prev = currentIndex - 1;
    if (prev >= 0) {
      setCurrentIndex(prev);
      pendingAutoPlayRef.current = true;
      return playlistSongIds[prev];
    }
    if (loopPlaylist) {
      const lastIdx = playlistSongIds.length - 1;
      setCurrentIndex(lastIdx);
      pendingAutoPlayRef.current = true;
      return playlistSongIds[lastIdx];
    }
    return null;
  }, [playbackMode, playlistSongIds, currentIndex, loopPlaylist]);

  // ── 현재 재생 중인 곡 위치 동기화 (곡 페이지 진입 시 호출) ──
  // 사용자가 직접 URL 통해 다른 곡으로 가거나, 플레이리스트에서 특정 곡 클릭한 경우 사용
  const syncCurrentSong = useCallback((songId) => {
    if (playbackMode !== "playlist") return;
    const idx = playlistSongIds.indexOf(songId);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
    } else if (idx < 0) {
      // 플레이리스트에 없는 곡으로 이동 → 단일 모드로 자동 전환
      setPlaybackMode("single");
      pendingAutoPlayRef.current = false;
    }
  }, [playbackMode, playlistSongIds, currentIndex]);

  // ── pendingAutoPlay 소비 (SongDetailPage가 재생 시작 후 호출) ──
  const consumeAutoPlay = useCallback(() => {
    const should = pendingAutoPlayRef.current;
    pendingAutoPlayRef.current = false;
    console.log("[Playback 진단] consumeAutoPlay 호출, 반환값:", should);
    return should;
  }, []);

  const value = {
    // 상태
    playbackMode,
    playlistSongIds,
    currentIndex,
    loopPlaylist,

    // 액션
    startPlaylist,
    exitPlaylistMode,
    toggleLoopPlaylist,
    goToNext,
    goToPrev,
    syncCurrentSong,
    consumeAutoPlay,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}

export default function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error("usePlayback은 PlaybackProvider 내부에서만 사용 가능합니다");
  }
  return ctx;
}
