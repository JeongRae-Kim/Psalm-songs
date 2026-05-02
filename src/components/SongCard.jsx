
import { useNavigate } from "react-router-dom";

export default function SongCard({ song, isFavorite, onToggleFavorite }) {
  const navigate = useNavigate();

  // 성경 본문 위치 텍스트 생성
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
        {/* 왼쪽: 성경 본문 위치 */}
        <span className="shrink-0 text-sm font-medium text-t-secondary whitespace-nowrap">
          {scriptureLabel}
        </span>

        {/* 오른쪽: 곡 제목 (넘치면 말줄임) */}
        <span className="flex-1 min-w-0 text-t-primary font-medium truncate">
          {song.title}
        </span>
      </button>

      {/* 즐겨찾기 ★ */}
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
