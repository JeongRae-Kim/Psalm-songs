
import { useState, useCallback } from "react";
import { getItem, setItem } from "../utils/storage";

const MAX_RECENT = 10;

export default function useRecent() {
  const [recent, setRecent] = useState(() => getItem("recent", []));

  const addRecent = useCallback((songId) => {
    setRecent((prev) => {
      const filtered = prev.filter((id) => id !== songId);
      const next = [songId, ...filtered].slice(0, MAX_RECENT);
      setItem("recent", next);
      return next;
    });
  }, []);

  return { recent, addRecent };
}