import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import useAccompanistPlayer from "../hooks/useAccompanistPlayer";
import useMidiPlayer from "../hooks/useMidiPlayer";
import { useTheme } from "../contexts/ThemeContext";
import LyricsView from "../components/LyricsView";
import SheetView from "../components/SheetView";
import HomeIcon from "../components/icons/HomeIcon";
import MiniPlayer from "../components/MiniPlayer";

/* ── 아이콘 SVG (페이지 전용) ── */
const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const ExpandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
const ShrinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
const PrevIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);
const NextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
  </svg>
);

/* ── 줌 아이콘 (탭 우측 컨트롤용) ── */
const ZoomInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

/* 줌/폰트 컨트롤 상수 */
const SHEET_SCALE_MIN = 1;
const SHEET_SCALE_MAX = 3;
const SHEET_SCALE_STEP = 0.25;
const SHEET_SCALE_DEFAULT = 1;

const LYRICS_FONT_MIN = 12;
const LYRICS_FONT_MAX = 32;
const LYRICS_FONT_STEP = 2;
const LYRICS_FONT_DEFAULT = 18;

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { songs, loading } = useSongs();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addRecent } = useRecent();
  const { instrument, fontSize, setFontSize } = useTheme();

  const [activeTab, setActiveTab] = useState(location.state?.tab || "sheet");
  const [immersive, setImmersive] = useState(false);
  const [sheetScale, setSheetScale] = useState(SHEET_SCALE_DEFAULT);  // 악보/반주기 줌

  const headerRef = useRef(null);
  const footerRef = useRef(null);
  const mainRef = useRef(null);
  const [headerH, setHeaderH] = useState(88);
  const [footerH, setFooterH] = useState(52);

  const song = songs.find((s) => s.id === id);

  const hasMidi = Boolean(song?.midiFile);
  const hasAccompanist = hasMidi;  // 반주기: MIDI만 있으면 됨

  const totalLoops = song?.verses?.length || 1;

  const midi = useMidiPlayer(hasMidi ? song.midiFile : null, totalLoops, instrument);
  const accompanist = useAccompanistPlayer(
    hasAccompanist ? song.midiFile : null,
    totalLoops,
    song?.introMeasures || 4,
    song?.hasAmen || false,
    instrument
  );

  // 곡 변경 시: 현재 탭이 새 곡에서 유효한지 검사
  useEffect(() => {
    const currentSong = songs.find((s) => s.id === id);
    if (!currentSong) return;

    const songHasMidi = Boolean(currentSong.midiFile);
    const songHasLyrics = currentSong.verses && currentSong.verses.length > 0;

    const tabValid =
      activeTab === "sheet" ||
      (activeTab === "accompanist" && songHasMidi) ||
      (activeTab === "lyrics" && songHasLyrics);

    if (!tabValid) {
      setActiveTab("sheet");
    }

    if (accompanist.ready) accompanist.stop();
    if (midi.ready) midi.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, songs]);

  // 탭 전환 시 비활성 플레이어 정지
  useEffect(() => {
    if (activeTab === "accompanist") {
      // 반주기 탭으로 오면 midi 정지
      if (midi.playing) midi.stop();
    } else {
      // 다른 탭으로 가면 accompanist 정지
      if (accompanist.playing) accompanist.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const currentIndex = useMemo(() => songs.findIndex((s) => s.id === id), [songs, id]);
  const prevSong = currentIndex > 0 ? songs[currentIndex - 1] : null;
  const nextSong = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;

  const scriptureLabel = song
    ? song.psalmNumber
      ? `시편 ${song.psalmNumber}편 ${song.verseRange}`
      : `이사야 ${song.verseRange}`
    : "";

  useEffect(() => { if (id) addRecent(id); }, [id, addRecent]);

  // footer 높이 측정
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      if (footerRef.current) setFooterH(footerRef.current.offsetHeight);
    };
    measure();
    const timer = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [immersive, activeTab]);

  if (loading) {
    return (
      <div className="h-screen bg-page flex items-center justify-center">
        <p className="text-t-hint">불러오는 중…</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="h-screen bg-page flex flex-col items-center justify-center gap-4">
        <p className="text-t-secondary">곡을 찾을 수 없습니다</p>
        <button onClick={() => navigate("/")}
          className="text-sm text-blue-500 hover:text-blue-700 transition-colors">
          ← 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const effectiveFooterH = immersive ? 0 : footerH;

  const tabs = [
    { key: "sheet", label: "악보" },
    ...(hasAccompanist ? [{ key: "accompanist", label: "반주기" }] : []),
    { key: "lyrics", label: "가사" },
  ];

  const tabBase = {
    flex: "0 1 auto", textAlign: "center", padding: "10px 12px",
    fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
    border: "none", background: "none", position: "relative", lineHeight: "1",
  };
  const tabActive = { color: "white" };
  const tabInactive = { color: "rgba(255,255,255,0.5)" };
  const tabUnderline = {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: "2px", backgroundColor: "white",
  };

  // 현재 활성 플레이어 — 악보/가사는 midi, 반주기는 accompanist
  const hasActivePlayer = hasMidi;

  const activePlayer =
    activeTab === "accompanist" ? accompanist :
    hasMidi ? midi : null;

  const activeShowSoundToggle = false;

  // ── 줌/폰트 컨트롤: 활성 탭에 따라 동작 대상 분기 ──
  const isLyricsTab = activeTab === "lyrics";

  const zoomLabel = isLyricsTab
    ? `${fontSize}px`
    : `${Math.round(sheetScale * 100)}%`;

  const zoomCanDecrease = isLyricsTab
    ? fontSize > LYRICS_FONT_MIN
    : sheetScale > SHEET_SCALE_MIN;

  const zoomCanIncrease = isLyricsTab
    ? fontSize < LYRICS_FONT_MAX
    : sheetScale < SHEET_SCALE_MAX;

  const handleZoomOut = () => {
    if (isLyricsTab) {
      setFontSize(Math.max(LYRICS_FONT_MIN, fontSize - LYRICS_FONT_STEP));
    } else {
      setSheetScale(Math.max(SHEET_SCALE_MIN, +(sheetScale - SHEET_SCALE_STEP).toFixed(2)));
    }
  };

  const handleZoomIn = () => {
    if (isLyricsTab) {
      setFontSize(Math.min(LYRICS_FONT_MAX, fontSize + LYRICS_FONT_STEP));
    } else {
      setSheetScale(Math.min(SHEET_SCALE_MAX, +(sheetScale + SHEET_SCALE_STEP).toFixed(2)));
    }
  };

  const handleZoomReset = () => {
    if (isLyricsTab) {
      setFontSize(LYRICS_FONT_DEFAULT);
    } else {
      setSheetScale(SHEET_SCALE_DEFAULT);
    }
  };

  const zoomBtnBase = {
    width: "28px", height: "28px", borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "opacity 0.15s, background-color 0.15s",
  };
  const zoomBtnLabel = {
    minWidth: "44px", height: "28px", borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.95)",
    fontSize: "0.7rem", fontWeight: 600,
    cursor: "pointer", padding: "0 6px",
  };

  return (
    <div className="bg-page" style={{ overscrollBehavior: "none" }}>

      {/* ━━ 상단 ━━ */}
      <div ref={headerRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="bg-card border-b border-b-light px-3 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <button onClick={() => navigate("/")}
              className="shrink-0 text-t-hint hover:text-t-primary transition-colors px-1" title="곡 목록으로">
              <HomeIcon size={22} title="곡 목록으로" />
            </button>
            <h1 className="text-base font-bold text-t-primary truncate flex-1 min-w-0">
              {song.title}
              <span className="ml-2 text-xs text-t-hint font-normal">· {scriptureLabel}</span>
            </h1>
            <button onClick={() => navigate("/settings", { state: { from: `/song/${id}`, tab: activeTab } })}
              className="shrink-0 text-t-hint hover:text-t-primary transition-colors"
              title="설정">
              <SettingsIcon />
            </button>
            <button onClick={() => toggleFavorite(song.id)}
              className="shrink-0 text-lg hover:scale-110 transition-transform">
              {isFavorite(song.id)
                ? <span className="text-yellow-400">★</span>
                : <span className="text-t-muted">☆</span>}
            </button>
            <button onClick={() => setImmersive(!immersive)}
              className="shrink-0 text-t-hint hover:text-t-primary transition-colors"
              title={immersive ? "일반 모드" : "전체 화면"}>
              {immersive ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
          </div>
        </div>

        {!immersive && (
          <div style={{ backgroundColor: "var(--accent, #374151)", display: "flex", alignItems: "center", height: "40px" }}>
            <div style={{ maxWidth: "48rem", margin: "0 auto", width: "100%", display: "flex", alignItems: "center", height: "100%", paddingRight: "8px" }}>
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ ...tabBase, ...(activeTab === tab.key ? tabActive : tabInactive) }}>
                  {tab.label}
                  {activeTab === tab.key && <span style={tabUnderline} />}
                </button>
              ))}

              {/* 우측 빈 공간 + 줌 컨트롤 */}
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button onClick={handleZoomOut}
                  disabled={!zoomCanDecrease}
                  style={{
                    ...zoomBtnBase,
                    cursor: zoomCanDecrease ? "pointer" : "not-allowed",
                    opacity: zoomCanDecrease ? 1 : 0.35,
                  }}
                  title={isLyricsTab ? "글자 작게" : "축소"}>
                  <ZoomOutIcon />
                </button>
                <button onClick={handleZoomReset}
                  style={{
                    ...zoomBtnLabel,
                    cursor: "pointer",
                  }}
                  title={isLyricsTab ? "글자 크기 기본값" : "100%로 리셋"}>
                  {zoomLabel}
                </button>
                <button onClick={handleZoomIn}
                  disabled={!zoomCanIncrease}
                  style={{
                    ...zoomBtnBase,
                    cursor: zoomCanIncrease ? "pointer" : "not-allowed",
                    opacity: zoomCanIncrease ? 1 : 0.35,
                  }}
                  title={isLyricsTab ? "글자 크게" : "확대"}>
                  <ZoomInIcon />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ━━ 중간 ━━ */}
      <main ref={mainRef} style={{
        position: "fixed", top: headerH, bottom: effectiveFooterH,
        left: 0, right: 0, overflowY: "auto", overflowX: "hidden",
        WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}>
        <div className="max-w-3xl mx-auto" style={{ position: "relative" }}>
          {activeTab === "sheet" && (
            <SheetView
              sheetImage={song.sheetImage}
              title={song.title}
              scale={sheetScale}
              onScaleChange={setSheetScale}
            />
          )}

          {/* 가사: midi 플레이어의 currentLoop, playing 전달 + 폰트 사이즈 */}
          {activeTab === "lyrics" && (
            <LyricsView
              verses={song.verses}
              currentLoop={midi.currentLoop}
              playing={midi.playing}
              fontSize={fontSize}
            />
          )}

          {/* 반주기 탭: PDF 악보 이미지 + phase 표시 */}
          {activeTab === "accompanist" && (
            <>
              <SheetView
                sheetImage={song.sheetImage}
                title={song.title}
                scale={sheetScale}
                onScaleChange={setSheetScale}
              />
              {accompanist.playing && accompanist.phaseLabel && (
                <div style={{
                  position: "fixed", top: headerH + 8, right: 16, zIndex: 40,
                  backgroundColor: "rgba(0,0,0,0.7)", color: "white",
                  padding: "4px 12px", borderRadius: "12px",
                  fontSize: "0.8rem", fontWeight: 600,
                }}>
                  {accompanist.phaseLabel}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ━━ 하단 footer ━━ */}
      {!immersive && (
        <div ref={footerRef} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
          <div style={{ backgroundColor: "var(--accent, #374151)" }}>
            <div className="max-w-3xl mx-auto px-3 py-2">
              <div className="flex items-center gap-2">
                {/* ◀ 이전 곡 */}
                <button onClick={() => prevSong && navigate(`/song/${prevSong.id}`)}
                  disabled={!prevSong}
                  style={{ width: "36px", height: "36px", minWidth: "36px" }}
                  className={`shrink-0 rounded-full flex items-center justify-center transition-colors ${prevSong ? "text-white/80 hover:text-white active:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                  title="이전 곡"><PrevIcon /></button>

                {/* 중앙: MiniPlayer 또는 성경 구절 */}
                {hasActivePlayer && activePlayer ? (
                  <MiniPlayer
                    player={activePlayer}
                    showSoundToggle={activeShowSoundToggle}
                  />
                ) : (
                  <span className="flex-1 text-center text-xs font-medium text-white/90">
                    {scriptureLabel}
                  </span>
                )}

                {/* ▶ 다음 곡 */}
                <button onClick={() => nextSong && navigate(`/song/${nextSong.id}`)}
                  disabled={!nextSong}
                  style={{ width: "36px", height: "36px", minWidth: "36px" }}
                  className={`shrink-0 rounded-full flex items-center justify-center transition-colors ${nextSong ? "text-white/80 hover:text-white active:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                  title="다음 곡"><NextIcon /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
