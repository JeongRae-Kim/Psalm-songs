
import { useState, useCallback } from "react";
import { getItem, setItem } from "../utils/storage";

export default function useFavorites() {
  const [favorites, setFavorites] = useState(() => getItem("favorites", []));

  const toggleFavorite = useCallback((songId) => {
    setFavorites((prev) => {
      const next = prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId];
      setItem("favorites", next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (songId) => favorites.includes(songId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}