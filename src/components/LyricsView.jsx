import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

/* ── 설정 아이콘 ── */
const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const FONTS = [
  { key: "gothic", label: "고딕" },
  { key: "myeongjo", label: "명조" },
  { key: "pretendard", label: "Pretendard" },
];

const FONT_FAMILIES = {
  gothic: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif',
  myeongjo: '"Noto Serif KR", "Batang", serif',
  pretendard: '"Pretendard", -apple-system, BlinkMacSystemFont, sans-serif',
};

export default function LyricsView({ verses }) {
  const { font, setFont, fontSize, setFontSize } = useTheme();
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* 글꼴/크기 조정 토글 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors border
            ${showPanel
              ? "bg-accent text-accent-text border-accent"
              : "bg-card text-t-secondary border-b-light hover:border-b-default"
            }`}
        >
          <GearIcon />
          <span>글꼴/크기</span>
          <span style={{ fontSize: "10px" }}>{showPanel ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* 접이식 설정 패널 */}
      {showPanel && (
        <div className="bg-card rounded-lg border border-b-light p-4 flex flex-col gap-4">
          {/* 글꼴 선택 */}
          <div>
            <p className="text-xs text-t-hint mb-2">글꼴</p>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFont(f.key)}
                  className={`flex-1 text-center py-2 text-xs rounded-lg transition-colors border
                    ${font === f.key
                      ? "bg-accent text-accent-text border-accent"
                      : "bg-page text-t-primary border-b-light hover:border-b-default"
                    }`}
                >
                  {f.label}{font === f.key && " ✓"}
                </button>
              ))}
            </div>
          </div>

          {/* 글자 크기 슬라이더 */}
          <div>
            <p className="text-xs text-t-hint mb-2">글자 크기</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-t-hint shrink-0">작게</span>
              <input
                type="range"
                min={12}
                max={32}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 h-2 accent-[var(--accent)]"
              />
              <span className="text-xs text-t-hint shrink-0">크게</span>
              <span className="text-sm font-bold text-t-primary shrink-0 w-10 text-center">
                {fontSize}px
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 가사 */}
      {verses.map((verse) => (
        <div
          key={verse.number}
          className="bg-card rounded-lg border border-b-light shadow-sm p-4"
        >
          <span className="text-xs text-t-hint mb-2 block">
            {verse.number}절
          </span>
          <p
            className="text-t-primary leading-relaxed whitespace-pre-line"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: FONT_FAMILIES[font],
            }}
          >
            {verse.text}
          </p>
        </div>
      ))}
    </div>
  );
}
