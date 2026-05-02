
export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="제목, 시편 번호, 곡조명 검색"
        className="w-full px-4 py-2.5 pl-9 text-sm
          bg-card border border-b-default rounded-lg
          focus:outline-none focus:border-accent
          placeholder-t-muted transition-colors"
      />
      {/* 돋보기 아이콘 */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {/* 입력 지우기 버튼 */}
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2
            text-t-muted hover:text-t-secondary transition-colors text-sm"
        >
          ✕
        </button>
      )}
    </div>
  );
}