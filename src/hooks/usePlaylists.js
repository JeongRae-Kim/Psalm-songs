import { useCallback, useEffect, useState } from "react";

/**
 * usePlaylists v1
 * 플레이리스트 데이터 관리 (localStorage 기반)
 *
 * Phase 1: 단일 기본 플레이리스트만 사용
 * Phase 2: 배열에 여러 플레이리스트 추가 예정 (구조는 동일)
 *
 * 저장 형식 (Phase 2 호환):
 * [
 *   { id: "default", name: "내 플레이리스트", songIds: [...], createdAt: "..." }
 * ]
 */

const STORAGE_KEY = "psalm-songs-playlists";

const DEFAULT_PLAYLIST = {
  id: "default",
  name: "내 플레이리스트",
  songIds: [],
  createdAt: null, // 첫 생성 시 채워짐
};

// localStorage 읽기 (안전)
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (e) {
    console.warn("[usePlaylists] localStorage 읽기 실패:", e);
    return null;
  }
}

// localStorage 쓰기 (안전)
function saveToStorage(playlists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch (e) {
    console.warn("[usePlaylists] localStorage 쓰기 실패:", e);
  }
}

export default function usePlaylists() {
  // 초기값: localStorage에서 읽거나 빈 기본 플레이리스트 1개
  const [playlists, setPlaylists] = useState(() => {
    const stored = loadFromStorage();
    if (stored) return stored;
    return [{ ...DEFAULT_PLAYLIST, createdAt: new Date().toISOString() }];
  });

  // 변경 시 자동 저장
  useEffect(() => {
    saveToStorage(playlists);
  }, [playlists]);

  // Phase 1 동안 항상 첫 번째 플레이리스트가 기본
  const defaultPlaylist = playlists[0];
  const songIds = defaultPlaylist?.songIds || [];
  const songCount = songIds.length;

  const isInPlaylist = useCallback(
    (songId) => songIds.includes(songId),
    [songIds]
  );

  const addSong = useCallback((songId) => {
    if (!songId) return;
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

  return {
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
}
