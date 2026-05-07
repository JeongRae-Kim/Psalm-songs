import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import useMemos from "../hooks/useMemos";
import useMidiPlayer from "../hooks/useMidiPlayer";
import useMetronomePlayer from "../hooks/useMetronomePlayer";
import LyricsView from "../components/LyricsView";
import SheetView from "../components/SheetView";
import MemoEditor from "../components/MemoEditor";
import OsmdView from "../components/OsmdView";
import HomeIcon from "../components/icons/HomeIcon";

/* ── 아이콘 SVG ── */
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);
const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/* 미니 플레이어 아이콘 */
const PlaySmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);
const PauseSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" /><rect x="15" y="3" width="4" height="18" />
  </svg>
);
const StopSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" />
  </svg>
);

/* 사운드 ON/OFF 아이콘 */
const SoundOnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);
const SoundOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addRecent } = useRecent();
  const { getMemo, saveMemo } = useMemos();
  const [activeTab, setActiveTab] = useState("sheet");
  const [immersive, setImmersive] = useState(false);

  const headerRef = useRef(null);
  const footerRef = useRef(null);
  const mainRef = useRef(null);
  const [headerH, setHeaderH] = useState(88);
  const [footerH, setFooterH] = useState(96);

  const song = songs.find((s) => s.id === id);

  const hasMidi = Boolean(song?.midiFile);
  const hasMxl = Boolean(song?.mxlFile);
  const hasPractice = hasMxl;
  const hasMetronome = hasMxl;  // 박자연습은 mxl만 있으면 가능

  // 반복 횟수: 가사 절수만큼 자동 반복 (전주는 mid에 포함되어 있으면 매 반복마다 들림)
  const totalLoops = song?.verses?.length || 1;

  const midi = useMidiPlayer(hasMidi ? song.midiFile : null, totalLoops);
  const metronome = useMetronomePlayer(hasMxl ? song.mxlFile : null, totalLoops);

  // 곡 변경 시: 현재 탭이 새 곡에서 유효한지 검사 (패턴 C — 조건부 유지)
  useEffect(() => {
    const currentSong = songs.find((s) => s.id === id);
    if (!currentSong) return;

    const songHasMxl = Boolean(currentSong.mxlFile);
    const songHasLyrics = currentSong.verses && currentSong.verses.length > 0;

    const tabValid =
      activeTab === "sheet" ||                          // 악보는 모든 곡 보유
      (activeTab === "practice" && songHasMxl) ||       // 연습은 mxl 필요
      (activeTab === "metronome" && songHasMxl) ||      // 박자연습도 mxl 필요
      (activeTab === "lyrics" && songHasLyrics);        // 가사는 verses 필요

    if (!tabValid) {
      setActiveTab("sheet");  // 유효하지 않으면 악보로 폴백
    }

    if (midi.ready) midi.stop();
    if (metronome.ready) metronome.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, songs]);

  useEffect(() => {
    if (activeTab !== "practice" && midi.playing) midi.stop();
    if (activeTab !== "metronome" && metronome.playing) metronome.stop();
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

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      if (footerRef.current) setFooterH(footerRef.current.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
    ...(hasPractice ? [{ key: "practice", label: "연습" }] : []),
    ...(hasMetronome ? [{ key: "metronome", label: "박자연습" }] : []),
    { key: "lyrics", label: "가사" },
  ];

  const tabBase = {
    flex: 1, textAlign: "center", padding: "10px 0",
    fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
    border: "none", background: "none", position: "relative", lineHeight: "1",
  };
  const tabActive = { color: "white" };
  const tabInactive = { color: "rgba(255,255,255,0.5)" };
  const tabUnderline = {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: "2px", backgroundColor: "white",
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    midi.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  const handleMetronomeProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    metronome.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
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
            </h1>
            <button onClick={() => navigate("/settings")}
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
            <div style={{ maxWidth: "48rem", margin: "0 auto", width: "100%", display: "flex", alignItems: "center", height: "100%" }}>
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ ...tabBase, ...(activeTab === tab.key ? tabActive : tabInactive) }}>
                  {tab.label}
                  {activeTab === tab.key && <span style={tabUnderline} />}
                </button>
              ))}
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.75rem", fontWeight: 500, padding: "0 8px", whiteSpace: "nowrap", lineHeight: "1" }}>
                {scriptureLabel}
              </span>
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
          {activeTab === "sheet" && <SheetView sheetImage={song.sheetImage} title={song.title} />}
          {activeTab === "lyrics" && <LyricsView verses={song.verses} />}

          {/* 연습탭은 항상 마운트 (백그라운드 렌더링) — 활성 시에만 보이고 상호작용 가능 */}
          {hasPractice && (
            <div
              style={{
                visibility: activeTab === "practice" ? "visible" : "hidden",
                position: activeTab === "practice" ? "static" : "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: activeTab === "practice" ? "auto" : "none",
                zIndex: activeTab === "practice" ? 1 : -1,
              }}
            >
              <OsmdView mxlUrl={song.mxlFile} originalTime={midi.originalTime}
                melodyTimes={midi.melodyTimes} playing={midi.playing} scrollContainerRef={mainRef}
                currentLoop={midi.currentLoop} midiBpm={midi.tempo}
                midiOffset={midi.melodyTimes?.[0] || 0} />
            </div>
          )}

          {/* 박자연습탭도 항상 마운트 (백그라운드 렌더링) */}
          {hasMetronome && (
            <div
              style={{
                visibility: activeTab === "metronome" ? "visible" : "hidden",
                position: activeTab === "metronome" ? "static" : "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: activeTab === "metronome" ? "auto" : "none",
                zIndex: activeTab === "metronome" ? 1 : -1,
              }}
            >
              <OsmdView mxlUrl={song.mxlFile} originalTime={metronome.originalTime}
                melodyTimes={metronome.melodyTimes} playing={metronome.playing} scrollContainerRef={mainRef}
                currentLoop={metronome.currentLoop} midiBpm={metronome.tempo}
                midiOffset={metronome.melodyTimes?.[0] || 0} />
            </div>
          )}
        </div>
      </main>

      {/* ━━ 하단 ━━ */}
      {!immersive && (
        <div ref={footerRef} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
          <div style={{ backgroundColor: "var(--accent, #374151)" }}>
            <div className="max-w-3xl mx-auto flex items-center px-3 py-2 gap-1">
              {/* ◀ 이전 곡 */}
              <button onClick={() => prevSong && navigate(`/song/${prevSong.id}`)}
                disabled={!prevSong}
                className={`shrink-0 p-1.5 rounded-full transition-colors ${prevSong ? "text-white/80 hover:text-white active:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                title="이전 곡"><PrevIcon /></button>

              {/* 중앙: 활성 탭에 따라 다른 미니 플레이어 표시 */}
              {activeTab === "practice" && midi.ready ? (
                /* 연습 탭 미니 플레이어 (mid 재생) */
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {/* 정지 (처음으로) */}
                  <button onClick={midi.stop}
                    className="shrink-0 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    title="처음으로"><StopSmall /></button>

                  {/* 재생 */}
                  <button onClick={midi.play}
                    disabled={midi.playing}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${midi.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
                    title="재생"><PlaySmall /></button>

                  {/* 일시정지 */}
                  <button onClick={midi.pause}
                    disabled={!midi.playing}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${!midi.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
                    title="일시정지"><PauseSmall /></button>

                  {/* 시간 */}
                  <span className="shrink-0 text-[10px] text-white/50 w-7 text-right">
                    {formatTime(midi.displayTime)}
                  </span>

                  {/* 프로그레스 바 */}
                  <div onClick={handleProgressClick}
                    className="flex-1 h-1.5 rounded-full cursor-pointer overflow-hidden min-w-[40px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(100, midi.progress * 100)}%`, backgroundColor: "rgba(255,255,255,0.7)", transition: "none" }} />
                  </div>

                  {/* 총 시간 */}
                  <span className="shrink-0 text-[10px] text-white/50 w-7">
                    {formatTime(midi.duration)}
                  </span>

                  {/* 절 카운트 (verses.length > 1인 경우만 표시) */}
                  {midi.totalLoops > 1 && (
                    <span className="shrink-0 text-[10px] text-white/60 ml-1" title={`${midi.currentLoop + 1}/${midi.totalLoops}절`}>
                      {midi.currentLoop + 1}/{midi.totalLoops}
                    </span>
                  )}

                  {/* 템포 */}
                  <input type="range" min={60} max={200} step={1}
                    value={midi.tempo}
                    onChange={(e) => midi.changeTempo(Number(e.target.value))}
                    className="shrink-0 h-1 accent-white opacity-50"
                    style={{ width: "45px" }} title={`${midi.tempo} BPM`} />
                  <span className="shrink-0 text-[9px] text-white/40 w-5">{midi.tempo}</span>
                </div>
              ) : activeTab === "metronome" && metronome.ready ? (
                /* 박자연습 탭 미니 플레이어 (메트로놈 + cursor 동기화) */
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {/* 정지 (처음으로) */}
                  <button onClick={metronome.stop}
                    className="shrink-0 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    title="처음으로"><StopSmall /></button>

                  {/* 재생 */}
                  <button onClick={metronome.play}
                    disabled={metronome.playing}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${metronome.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
                    title="재생"><PlaySmall /></button>

                  {/* 일시정지 */}
                  <button onClick={metronome.pause}
                    disabled={!metronome.playing}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${!metronome.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
                    title="일시정지"><PauseSmall /></button>

                  {/* 사운드 ON/OFF */}
                  <button onClick={metronome.toggleSound}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center transition-colors
                      ${metronome.soundEnabled ? "text-white/80 hover:text-white" : "text-white/30 hover:text-white/50"}`}
                    title={metronome.soundEnabled ? "메트로놈 사운드 끄기" : "메트로놈 사운드 켜기"}>
                    {metronome.soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
                  </button>

                  {/* 시간 */}
                  <span className="shrink-0 text-[10px] text-white/50 w-7 text-right">
                    {formatTime(metronome.displayTime)}
                  </span>

                  {/* 프로그레스 바 */}
                  <div onClick={handleMetronomeProgressClick}
                    className="flex-1 h-1.5 rounded-full cursor-pointer overflow-hidden min-w-[40px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(100, metronome.progress * 100)}%`, backgroundColor: "rgba(255,255,255,0.7)", transition: "none" }} />
                  </div>

                  {/* 총 시간 */}
                  <span className="shrink-0 text-[10px] text-white/50 w-7">
                    {formatTime(metronome.duration)}
                  </span>

                  {/* 절 카운트 (verses.length > 1인 경우만 표시) */}
                  {metronome.totalLoops > 1 && (
                    <span className="shrink-0 text-[10px] text-white/60 ml-1" title={`${metronome.currentLoop + 1}/${metronome.totalLoops}절`}>
                      {metronome.currentLoop + 1}/{metronome.totalLoops}
                    </span>
                  )}

                  {/* 템포 */}
                  <input type="range" min={60} max={200} step={1}
                    value={metronome.tempo}
                    onChange={(e) => metronome.changeTempo(Number(e.target.value))}
                    className="shrink-0 h-1 accent-white opacity-50"
                    style={{ width: "45px" }} title={`${metronome.tempo} BPM`} />
                  <span className="shrink-0 text-[9px] text-white/40 w-5">{metronome.tempo}</span>
                </div>
              ) : (
                <span className="flex-1 text-center text-xs font-medium text-white/90">
                  {scriptureLabel}
                </span>
              )}

              {/* ▶ 다음 곡 */}
              <button onClick={() => nextSong && navigate(`/song/${nextSong.id}`)}
                disabled={!nextSong}
                className={`shrink-0 ml-2 p-1.5 rounded-full transition-colors ${nextSong ? "text-white/80 hover:text-white active:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                title="다음 곡"><NextIcon /></button>

              {/* 다운로드 */}
              <a href={song.sheetPdf} download
                className="shrink-0 ml-2 p-1.5 rounded-full text-white/60 hover:text-white active:bg-white/10 transition-colors"
                title="PDF 다운로드"><DownloadIcon /></a>
            </div>
          </div>

          {/* 메모 */}
          <div className="bg-card border-t border-b-light">
            <div className="max-w-3xl mx-auto px-3 py-2">
              <MemoEditor value={getMemo(song.id)} onSave={(text) => saveMemo(song.id, text)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
