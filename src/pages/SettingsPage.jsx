import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import HomeIcon from "../components/icons/HomeIcon";

/* ── 뒤로가기 아이콘 ── */
const BackIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const THEMES = [
  { key: "minimal", label: "미니멀", desc: "깔끔한 흰색 톤" },
  { key: "paper", label: "종이결", desc: "따뜻한 크림색 톤" },
  { key: "modern", label: "모던", desc: "차가운 블루그레이 톤" },
];

const DARK_MODES = [
  { key: "auto", label: "자동" },
  { key: "off", label: "끔" },
  { key: "on", label: "켬" },
];

const FONTS = [
  { key: "gothic", label: "고딕" },
  { key: "myeongjo", label: "명조" },
  { key: "pretendard", label: "Pretendard" },
];

const INSTRUMENTS = [
  { key: "piano", label: "그랜드 피아노", desc: "따뜻하고 풍성한 어쿠스틱 피아노" },
  { key: "epiano", label: "일렉트릭 피아노", desc: "부드럽고 모던한 전자 피아노" },
  { key: "organ", label: "교회 오르간", desc: "장엄하고 웅장한 파이프 오르간" },
  { key: "harpsichord", label: "하프시코드", desc: "또렷하고 고풍스러운 건반 악기" },
  { key: "celesta", label: "첼레스타", desc: "맑고 영롱한 종소리 건반 악기" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, darkMode, setDarkMode, font, setFont, fontSize, setFontSize, instrument, setInstrument } = useTheme();

  const handleBack = () => {
    if (location.state?.from) {
      // 곡 페이지에서 왔으면 탭 정보 포함하여 복귀
      navigate(location.state.from, { state: { tab: location.state.tab } });
    } else {
      // 그 외 (홈 등)에서 왔으면 브라우저 히스토리 복귀
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      {/* 헤더 */}
      <header className="bg-header border-b border-b-light px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-t-hint hover:text-t-primary transition-colors"
            title="뒤로"
          >
            <BackIcon size={22} />
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-t-hint hover:text-t-primary transition-colors"
            title="홈으로"
          >
            <HomeIcon size={22} title="홈으로" />
          </button>
          <span className="w-px h-4 bg-b-default" />
          <h1 className="text-xl font-bold text-t-primary">설정</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* 테마 선택 */}
        <section>
          <h2 className="text-sm font-medium text-t-secondary mb-3">테마</h2>
          <div className="flex flex-col gap-2">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg
                  transition-colors border
                  ${theme === t.key
                    ? "bg-accent text-accent-text border-accent"
                    : "bg-card text-t-primary border-b-light hover:border-b-default"
                  }`}
              >
                <div>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className={`text-xs ml-2 ${theme === t.key ? "opacity-70" : "text-t-hint"}`}>
                    {t.desc}
                  </span>
                </div>
                {theme === t.key && <span>✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* 다크모드 */}
        <section>
          <h2 className="text-sm font-medium text-t-secondary mb-3">다크모드</h2>
          <div className="flex gap-2">
            {DARK_MODES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDarkMode(d.key)}
                className={`flex-1 text-center py-2.5 text-sm rounded-lg
                  transition-colors border
                  ${darkMode === d.key
                    ? "bg-accent text-accent-text border-accent"
                    : "bg-card text-t-primary border-b-light hover:border-b-default"
                  }`}
              >
                {d.label}{darkMode === d.key && " ✓"}
              </button>
            ))}
          </div>
          <p className="text-xs text-t-hint mt-2">
            "자동"은 기기 설정을 따릅니다
          </p>
        </section>

        {/* 글꼴 */}
        <section>
          <h2 className="text-sm font-medium text-t-secondary mb-3">글꼴</h2>
          <div className="flex gap-2">
            {FONTS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFont(f.key)}
                className={`flex-1 text-center py-2.5 text-sm rounded-lg
                  transition-colors border
                  ${font === f.key
                    ? "bg-accent text-accent-text border-accent"
                    : "bg-card text-t-primary border-b-light hover:border-b-default"
                  }`}
              >
                {f.label}{font === f.key && " ✓"}
              </button>
            ))}
          </div>
        </section>

        {/* 글자 크기 — 슬라이더 + 숫자 표시 */}
        <section>
          <h2 className="text-sm font-medium text-t-secondary mb-3">글자 크기</h2>
          <div className="bg-card rounded-lg border border-b-light p-4">
            <div className="flex items-center gap-4">
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
            </div>
            <div className="text-center mt-3">
              <span className="text-2xl font-bold text-t-primary">{fontSize}</span>
              <span className="text-sm text-t-hint ml-1">px</span>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-b-light p-4 mt-3">
            <p className="text-t-hint text-xs mb-2">미리보기</p>
            <p className="text-t-primary leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
              여호와는 나의 목자시니 내게 부족함이 없으리로다
            </p>
          </div>
        </section>

        {/* 악기 선택 */}
        <section>
          <h2 className="text-sm font-medium text-t-secondary mb-3">재생 악기</h2>
          <div className="flex flex-col gap-2">
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.key}
                onClick={() => setInstrument(inst.key)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg
                  transition-colors border
                  ${instrument === inst.key
                    ? "bg-accent text-accent-text border-accent"
                    : "bg-card text-t-primary border-b-light hover:border-b-default"
                  }`}
              >
                <div>
                  <span className="text-sm font-medium">{inst.label}</span>
                  <span className={`text-xs ml-2 ${instrument === inst.key ? "opacity-70" : "text-t-hint"}`}>
                    {inst.desc}
                  </span>
                </div>
                {instrument === inst.key && <span>✓</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-t-hint mt-2">
            악기 변경 시 다음 재생부터 적용됩니다
          </p>
        </section>

      </main>
    </div>
  );
}
