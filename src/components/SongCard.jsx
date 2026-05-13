import { useNavigate } from "react-router-dom";
import AddToPlaylistButton from "./AddToPlaylistButton";

export default function SongCard({ song, isFavorite, onToggleFavorite }) {
  const navigate = useNavigate();

  const scriptureLabel = song.psalmNumber
    ? `시편 ${song.psalmNumber}편 ${song.verseRange}`
    : `이사야 ${song.verseRange}`;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(`/song/${song.id}`)}
        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3
          bg-card rounded-lg shadow-sm
          hover:shadow-md hover:-translate-y-0.5
          active:translate-y-0 active:shadow-sm
          transition-all duration-200 ease-out
          text-left cursor-pointer border border-b-light"
      >
        <span className="shrink-0 text-sm font-medium text-t-secondary whitespace-nowrap">
          {scriptureLabel}
        </span>
        <span className="flex-1 min-w-0 text-t-primary font-medium truncate">
          {song.title}
        </span>
      </button>

      {/* 플레이리스트 추가 버튼 */}
      <AddToPlaylistButton songId={song.id} variant="icon" />

      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(song.id); }}
        className="shrink-0 p-2 text-lg transition-colors hover:scale-110"
        title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      >
        {isFavorite ? (
          <span className="text-yellow-400">★</span>
        ) : (
          <span className="text-t-muted">☆</span>
        )}
      </button>
    </div>
  );
}
