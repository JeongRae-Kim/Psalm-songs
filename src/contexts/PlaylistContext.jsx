import { createContext, useContext, useState, useEffect, useCallback } from "react";

/**
 * PlaylistContext v1
 * 플레이리스트 데이터를 앱 전역에서 단일 인스턴스로 관리
 *
 * 이전 useState 기반 훅은 컴포넌트마다 독립 인스턴스가 생성되어
 * 빠른 연속 클릭 시 race condition이 발생했음. Context로 단일화하여 해결.
 *
 * Phase 2 호환 저장 형식:
 * [
 *   { id: "default", name: "내 플레이리스트", songIds: [...], createdAt: "..." }
 * ]
 */

const STORAGE_KEY = "psalm-songs-playlists";

const DEFAULT_PLAYLIST = {
  id: "default",
  name: "내 플레이리스트",
  songIds: [],
  createdAt: null,
};

// localStorage 읽기 (iOS Safari 시크릿 모드 등에서도 안전)
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (e) {
    console.warn("[PlaylistContext] localStorage 읽기 실패:", e);
    return null;
  }
}

// localStorage 쓰기 (예외 시 무시)
function saveToStorage(playlists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch (e) {
    console.warn("[PlaylistContext] localStorage 쓰기 실패:", e);
  }
}

const PlaylistContext = createContext(null);

export function PlaylistProvider({ children }) {
  // 초기값: localStorage 또는 기본 플레이리스트 1개
  const [playlists, setPlaylists] = useState(() => {
    const stored = loadFromStorage();
    if (stored) return stored;
    return [{ ...DEFAULT_PLAYLIST, createdAt: new Date().toISOString() }];
  });

  // 변경 시 자동 저장
  useEffect(() => {
    saveToStorage(playlists);
  }, [playlists]);

  // Phase 1: 항상 첫 번째 플레이리스트가 기본
  const defaultPlaylist = playlists[0];
  const songIds = defaultPlaylist?.songIds || [];
  const songCount = songIds.length;

  const isInPlaylist = useCallback(
    (songId) => songIds.includes(songId),
    [songIds]
  );

  const addSong = useCallback((songId) => {
    if (!songId) return;
    // setState 함수형 업데이트: 이전 state를 확실히 받아서 처리 → race condition 방지
    setPlaylists((prev) => {
      const updated = [...prev];
      const pl = { ...updated[0] };
      if (pl.songIds.includes(songId)) return prev; // 중복 방지
      pl.songIds = [...pl.songIds, songId];
      updated[0] = pl;
      return updated;
    });
  }, []);

  const removeSong = useCallback((songId) => {
    if (!songId) return;
    setPlaylists((prev) => {
      const updated = [...prev];
      const pl = { ...updated[0] };
      pl.songIds = pl.songIds.filter((id) => id !== songId);
      updated[0] = pl;
      return updated;
    });
  }, []);

  const moveSong = useCallback((fromIndex, toIndex) => {
    setPlaylists((prev) => {
      const updated = [...prev];
      const pl = { ...updated[0] };
      const arr = [...pl.songIds];
      if (
        fromIndex < 0 || fromIndex >= arr.length ||
        toIndex < 0 || toIndex >= arr.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      pl.songIds = arr;
      updated[0] = pl;
      return updated;
    });
  }, []);

  const moveUp = useCallback((index) => {
    if (index <= 0) return;
    moveSong(index, index - 1);
  }, [moveSong]);

  const moveDown = useCallback((index) => {
    moveSong(index, index + 1);
  }, [moveSong]);

  const clear = useCallback(() => {
    setPlaylists((prev) => {
      const updated = [...prev];
      updated[0] = { ...updated[0], songIds: [] };
      return updated;
    });
  }, []);

  const value = {
    defaultPlaylist,
    songIds,
    songCount,
    isInPlaylist,
    addSong,
    removeSong,
    moveSong,
    moveUp,
    moveDown,
    clear,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
}

// 기존 코드 호환을 위해 default export 이름은 usePlaylists 유지
export default function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) {
    throw new Error("usePlaylists는 PlaylistProvider 내부에서만 사용 가능합니다");
  }
  return ctx;
}
