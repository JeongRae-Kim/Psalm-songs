

import { useEffect, useState } from "react";

export default function useSongs() {
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

  return { songs, loading, error };
}