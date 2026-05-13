
/**
 * FilterChips v2
 * 기본 필터 칩들 + "플레이리스트" 특수 칩 (필터가 아닌 페이지 이동)
 *
 * @param {string} active - 현재 활성 필터 키
 * @param {Function} onChange - 필터 변경 콜백
 * @param {Function} [onPlaylistClick] - 플레이리스트 칩 클릭 시 콜백 (필터가 아닌 페이지 이동용)
 */
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "psalm", label: "시편" },
  { key: "isaiah", label: "이사야" },
  { key: "favorites", label: "★" },
  { key: "recent", label: "최근" },
];

export default function FilterChips({ active, onChange, onPlaylistClick }) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors
            ${active === filter.key
              ? "bg-accent text-white"
              : "bg-card text-t-secondary border border-b-default hover:border-gray-400"
            }`}
        >
          {filter.label}
        </button>
      ))}

      {/* 플레이리스트 칩: 필터가 아닌 페이지 이동 */}
      {onPlaylistClick && (
        <button
          onClick={onPlaylistClick}
          className="px-3 py-1.5 text-xs rounded-full transition-colors
            bg-card text-t-secondary border border-b-default hover:border-gray-400"
          title="내 플레이리스트"
        >
          🎵
        </button>
      )}
    </div>
  );
}
