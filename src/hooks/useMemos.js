
import { useState, useCallback } from "react";
import { getItem, setItem } from "../utils/storage";

export default function useMemos() {
  const [memos, setMemos] = useState(() => getItem("memos", {}));

  const getMemo = useCallback(
    (songId) => memos[songId] || "",
    [memos]
  );

  const saveMemo = useCallback((songId, text) => {
    setMemos((prev) => {
      const next = { ...prev };
      if (text.trim()) {
        next[songId] = text;
      } else {
        delete next[songId];
      }
      setItem("memos", next);
      return next;
    });
  }, []);

  return { getMemo, saveMemo };
}