import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import { useTheme } from "../contexts/ThemeContext";
import LyricsView from "../components/LyricsView";
import SheetView from "../components/SheetView";
import HomeIcon from "../components/icons/HomeIcon";
import MiniPlayer from "../components/MiniPlayer";
import AddToPlaylistButton from "../components/AddToPlaylistButton";
import usePlayback from "../contexts/PlaybackContext";
import usePlayer from "../contexts/PlayerContext";

/*
 * 단계 B-1 변경 요약:
 *   - useMidiPlayer / useAccompanistPlayer 직접 호출 제거 → usePlayer() 구독.
 *   - handleSongEnded, 자동재생 effect, 탭전환 비활성정지 effect → PlayerContext로 이동.
 *   - 곡을 찾으면 playerCtx.loadSong(song) 호출로 재생 대상을 Provider에 알림.
 *   - activeTab은 PlayerContext가 소유. 페이지는 playerCtx.activeTab / setActiveTab 사용.
 *
 * B-1의 의도된 한계 (단계 C·D에서 해결):
 *   - 곡 변경 effect 안의 무조건 stop()은 아직 남아 있음 → 단계 C에서 제거.
 *     따라서 B-1 직후엔 설정 다녀오면 여전히 재생이 초기화됨.
 */

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
  const { fontSize, setFontSize } = useTheme();
  const {
    playbackMode,
    playlistSongIds,
    currentIndex: playbackIndex,
    loopPlaylist,
    goToNext,
    goToPrev,
    syncCurrentSong,
    exitPlaylistMode,
  } = usePlayback();

  // ── 재생 엔진은 PlayerContext가 보유. 페이지는 구독만 한다. ──
  const player = usePlayer();
  const { activeTab, setActiveTab } = player;

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

  // location.state로 전달된 탭 정보 (설정 페이지에서 복귀 시 등) 반영
  // B-1: activeTab은 PlayerContext 소유. 진입 시 location.state.tab이 있으면 동기화.
  useEffect(() => {
    if (location.state?.tab && location.state.tab !== activeTab) {
      setActiveTab(location.state.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.tab]);

  // ── 곡 변경 시: 재생 대상을 Provider에 로드 + 탭 유효성 검사 + 모드 동기화 ──
  // B-1: handleSongEnded / 자동재생 / 탭전환 비활성정지는 PlayerContext로 이동함.
  //
  // 선택지 가 적용: 무조건 stop()을 제거함. 곡 변경 시 정지 책임은
  // PlayerContext의 loadSong이 진다 (같은 곡이면 정지 안 함 → 재생 보존,
  // 다른 곡이면 이전 재생 정지). 이로써 "재마운트 시 재생 초기화" 문제의
  // 핵심 원인 하나가 B-1 시점에 이미 제거된다.
  // (단계 C에서 loadSong의 같은-곡 판정을 더 정교화 예정.)
  useEffect(() => {
    const currentSong = songs.find((s) => s.id === id);
    if (!currentSong) return;

    // 재생 대상을 Provider에 알림 (방식 1 / 선택지 A).
    // loadSong이 곡 변경 여부를 판단해 정지/보존을 처리한다.
    player.loadSong(currentSong);

    const songHasMidi = Boolean(currentSong.midiFile);
    const songHasLyrics = currentSong.verses && currentSong.verses.length > 0;

    const tabValid =
      activeTab === "sheet" ||
      (activeTab === "accompanist" && songHasMidi) ||
      (activeTab === "lyrics" && songHasLyrics);

    if (!tabValid) {
      setActiveTab("sheet");
    }

    // 플레이리스트 모드면 currentIndex를 이 곡으로 동기화
    syncCurrentSong(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, songs]);

  // 이전/다음 곡 결정: 플레이리스트 모드면 플레이리스트 순서, 아니면 전체 곡 순서
  const currentIndex = useMemo(() => songs.findIndex((s) => s.id === id), [songs, id]);

  const { prevSong, nextSong } = useMemo(() => {
    if (playbackMode === "playlist" && playlistSongIds.length > 0) {
      // 플레이리스트 모드: playlistSongIds 내 순서로
      const idx = playlistSongIds.indexOf(id);
      if (idx >= 0) {
        const prevId = idx > 0 ? playlistSongIds[idx - 1]
          : (loopPlaylist ? playlistSongIds[playlistSongIds.length - 1] : null);
        const nextId = idx < playlistSongIds.length - 1 ? playlistSongIds[idx + 1]
          : (loopPlaylist ? playlistSongIds[0] : null);
        return {
          prevSong: prevId ? songs.find((s) => s.id === prevId) : null,
          nextSong: nextId ? songs.find((s) => s.id === nextId) : null,
        };
      }
    }
    // single 모드 또는 fallback: 전체 곡 목록 순서
    return {
      prevSong: currentIndex > 0 ? songs[currentIndex - 1] : null,
      nextSong: currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null,
    };
  }, [playbackMode, playlistSongIds, id, songs, currentIndex, loopPlaylist]);

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
    { key: "lyrics", label: "가사" },
    ...(hasAccompanist ? [{ key: "accompanist", label: "반주기" }] : []),
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

  // 현재 활성 플레이어 — 악보/가사는 midi, 반주기는 accompanist (PlayerContext가 결정)
  const hasActivePlayer = hasMidi;

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
            <AddToPlaylistButton songId={song.id} variant="header" />
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

          {/* 가사: LyricsView가 usePlayer()에서 재생 상태를 직접 구독 */}
          {activeTab === "lyrics" && (
            <LyricsView
              verses={song.verses}
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
              {player.playing && player.phaseLabel && (
                <div style={{
                  position: "fixed", top: headerH + 8, right: 16, zIndex: 40,
                  backgroundColor: "rgba(0,0,0,0.7)", color: "white",
                  padding: "4px 12px", borderRadius: "12px",
                  fontSize: "0.8rem", fontWeight: 600,
                }}>
                  {player.phaseLabel}
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
            {/* 플레이리스트 모드 인디케이터 */}
            {playbackMode === "playlist" && playlistSongIds.length > 0 && (
              <div className="max-w-3xl mx-auto px-3 pt-1.5 pb-0.5 flex items-center justify-between text-[10px] text-white/70">
                <span className="inline-flex items-center gap-1">
                  <span>🎵</span>
                  <span>플레이리스트 재생 중</span>
                  <span className="opacity-70">· {playbackIndex + 1}/{playlistSongIds.length}</span>
                  {loopPlaylist && <span className="opacity-70">· 🔁 전체 반복</span>}
                </span>
                <button
                  onClick={() => exitPlaylistMode()}
                  className="hover:text-white transition-colors"
                  title="플레이리스트 모드 종료"
                >
                  종료
                </button>
              </div>
            )}
            <div className="max-w-3xl mx-auto px-3 py-2">
              <div className="flex items-center gap-2">
                {/* ◀ 이전 곡 */}
                <button
                  onClick={() => {
                    if (!prevSong) return;
                    if (playbackMode === "playlist") {
                      const pid = goToPrev();
                      if (pid) navigate(`/song/${pid}`);
                    } else {
                      navigate(`/song/${prevSong.id}`);
                    }
                  }}
                  disabled={!prevSong}
                  style={{ width: "36px", height: "36px", minWidth: "36px" }}
                  className={`shrink-0 rounded-full flex items-center justify-center transition-colors ${prevSong ? "text-white/80 hover:text-white active:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                  title="이전 곡"><PrevIcon /></button>

                {/* 중앙: MiniPlayer 또는 성경 구절 */}
                {hasActivePlayer ? (
                  <MiniPlayer showSoundToggle={activeShowSoundToggle} />
                ) : (
                  <span className="flex-1 text-center text-xs font-medium text-white/90">
                    {scriptureLabel}
                  </span>
                )}

                {/* ▶ 다음 곡 */}
                <button
                  onClick={() => {
                    if (!nextSong) return;
                    if (playbackMode === "playlist") {
                      const nid = goToNext();
                      if (nid) navigate(`/song/${nid}`);
                    } else {
                      navigate(`/song/${nextSong.id}`);
                    }
                  }}
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
