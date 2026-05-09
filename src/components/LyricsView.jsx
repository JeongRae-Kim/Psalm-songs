import { useState, useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";

/* ── 설정 아이콘 ── */
const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* 스피커 아이콘 */
const SpeakerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
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

/**
 * @param {Object} props
 * @param {Array} props.verses - 가사 절 배열 [{number, text}, ...]
 * @param {number} [props.currentLoop] - 현재 재생 중인 절 인덱스 (0부터)
 * @param {boolean} [props.playing] - MIDI 재생 중 여부
 * @param {React.RefObject} [props.scrollContainerRef] - 스크롤 컨테이너 ref
 */
export default function LyricsView({ verses, currentLoop = -1, playing = false, scrollContainerRef }) {
  const { font, setFont, fontSize, setFontSize } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
  const verseRefs = useRef([]);

  // 절 ref 배열 초기화
  useEffect(() => {
    verseRefs.current = verseRefs.current.slice(0, verses.length);
  }, [verses.length]);

  // 현재 절로 자동 스크롤
  useEffect(() => {
    if (!playing || currentLoop < 0 || currentLoop >= verses.length) return;

    const verseEl = verseRefs.current[currentLoop];
    const scrollEl = scrollContainerRef?.current;
    if (!verseEl || !scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const verseRect = verseEl.getBoundingClientRect();

    // 현재 절이 화면 밖에 있으면 스크롤
    if (verseRect.top < scrollRect.top || verseRect.bottom > scrollRect.bottom) {
      const offset = verseRect.top - scrollRect.top - scrollRect.height * 0.2;
      scrollEl.scrollTo({
        top: scrollEl.scrollTop + offset,
        behavior: "smooth",
      });
    }
  }, [currentLoop, playing, verses.length, scrollContainerRef]);

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
      {verses.map((verse, idx) => {
        const isCurrentVerse = playing && currentLoop === idx;

        return (
          <div
            key={verse.number}
            ref={(el) => { verseRefs.current[idx] = el; }}
            className="rounded-lg border shadow-sm p-4 transition-all duration-300"
            style={{
              backgroundColor: isCurrentVerse ? "var(--accent, #374151)" : "var(--bg-card, white)",
              borderColor: isCurrentVerse ? "var(--accent, #374151)" : "var(--border-light, #e5e7eb)",
              transform: isCurrentVerse ? "scale(1.01)" : "scale(1)",
            }}
          >
            <span className="text-xs mb-2 block flex items-center gap-1.5"
              style={{ color: isCurrentVerse ? "rgba(255,255,255,0.7)" : "var(--text-hint)" }}>
              {verse.number}절
              {isCurrentVerse && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}>
                  <SpeakerIcon /> 재생 중
                </span>
              )}
            </span>
            <p
              className="leading-relaxed whitespace-pre-line"
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: FONT_FAMILIES[font],
                color: isCurrentVerse ? "white" : "var(--text-primary)",
              }}
            >
              {verse.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
