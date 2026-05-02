
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "psalm", label: "시편" },
  { key: "isaiah", label: "이사야" },
  { key: "favorites", label: "★" },
  { key: "recent", label: "최근" },
];

export default function FilterChips({ active, onChange }) {
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
    </div>
  );
}