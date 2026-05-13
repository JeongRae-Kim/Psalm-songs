import { useTheme } from "../contexts/ThemeContext";

/* 스피커 아이콘 */
const SpeakerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

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
 * @param {number} [props.fontSize] - 가사 폰트 크기 (px). props로 받으면 ThemeContext보다 우선
 */
export default function LyricsView({ verses, currentLoop = -1, playing = false, fontSize: fontSizeProp }) {
  const { font, fontSize: fontSizeCtx } = useTheme();
  // props로 받으면 그 값 사용, 아니면 ThemeContext 값 사용
  const fontSize = fontSizeProp != null ? fontSizeProp : fontSizeCtx;

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* 가사 */}
      {verses.map((verse, idx) => {
        const isCurrentVerse = playing && currentLoop === idx;

        return (
          <div
            key={verse.number}
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
