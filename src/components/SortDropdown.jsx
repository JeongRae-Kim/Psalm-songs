
const SORT_OPTIONS = [
  { key: "number", label: "번호순" },
  { key: "title", label: "가나다순" },
];

export default function SortDropdown({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 text-xs
        bg-card border border-b-default rounded-lg
        focus:outline-none focus:border-accent
        text-t-secondary transition-colors cursor-pointer"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.key} value={opt.key}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}