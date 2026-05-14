import { createContext, useContext, useEffect, useState } from "react";

/**
 * SongsContext v1 — 곡 데이터 전역화 (6-5)
 *
 * 배경:
 *   기존 useSongs는 Context가 아닌 일반 훅이라, 호출하는 컴포넌트마다
 *   독립적으로 /songs.json을 다시 fetch했다. HomePage, PlaylistPage,
 *   SongDetailPage가 각각 받았고, StrictMode 이중 마운트까지 겹쳐
 *   곡 진입당 songs.json이 여러 번 로드됐다. PlaylistContext가 동일한
 *   패턴 문제를 "Context로 단일화"하여 해결한 선례를 따른다.
 *
 * 변경:
 *   - fetch 로직을 SongsProvider 안으로 이식. 앱 생애주기 동안 1회만
 *     /songs.json을 fetch한다(StrictMode면 2회).
 *   - useSongs()는 useContext만 하는 형태로 바뀌되, 반환값
 *     { songs, loading, error }는 기존과 100% 동일하다. 따라서
 *     호출처는 import 경로만 바꾸면 되고 사용 코드는 무변경이다.
 *   - 기존 src/hooks/useSongs.js는 삭제되었다(6-5 결정: 가).
 *
 * fetch 로직 자체는 기존 useSongs.js에서 한 줄도 바꾸지 않고 옮겼다
 * (콘솔 로그 포함).
 */

const SongsContext = createContext(null);

export function SongsProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/songs.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("=== songs.json 로드 성공 ===");
        console.log("총 곡 수:", data.songs.length);
        setSongs(data.songs);
        setLoading(false);
      })
      .catch((err) => {
        console.error("songs.json 로드 실패:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const value = { songs, loading, error };

  return (
    <SongsContext.Provider value={value}>
      {children}
    </SongsContext.Provider>
  );
}

export default function useSongs() {
  const ctx = useContext(SongsContext);
  if (!ctx) {
    throw new Error("useSongs는 SongsProvider 내부에서만 사용 가능합니다");
  }
  return ctx;
}
