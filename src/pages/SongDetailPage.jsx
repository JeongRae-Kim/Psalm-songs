import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import useMemos from "../hooks/useMemos";
import LyricsView from "../components/LyricsView";
import SheetView from "../components/SheetView";
import MemoEditor from "../components/MemoEditor";

/* ── 아이콘 SVG 컴포넌트들 ── */
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ExpandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const ShrinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
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
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addRecent } = useRecent();
  const { getMemo, saveMemo } = useMemos();
  const [activeTab, setActiveTab] = useState("sheet");
  const [immersive, setImmersive] = useState(false);

  const song = songs.find((s) => s.id === id);

  // 이전/다음 곡 계산
  const currentIndex = useMemo(
    () => songs.findIndex((s) => s.id === id),
    [songs, id]
  );
  const prevSong = currentIndex > 0 ? songs[currentIndex - 1] : null;
  const nextSong = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;

  // 성경 본문 라벨
  const scriptureLabel = song
    ? song.psalmNumber
      ? `시편 ${song.psalmNumber}편 ${song.verseRange}`
      : `이사야 ${song.verseRange}`
    : "";

  // 최근 본 곡 기록
  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

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
        <button
          onClick={() => navigate("/")}
          className="text-sm text-blue-500 hover:text-blue-700 transition-colors"
        >
          ← 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">

      {/* ━━ 상단 1행: 홈 + 제목 + 즐겨찾기 + 몰입 토글 (항상 고정) ━━ */}
      <header className="shrink-0 bg-card border-b border-b-light px-3 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {/* 홈 */}
          <button
            onClick={() => navigate("/")}
            className="shrink-0 text-t-hint hover:text-t-primary transition-colors"
            title="홈으로"
          >
            <HomeIcon />
          </button>

          {/* 제목 */}
          <h1 className="text-base font-bold text-t-primary truncate flex-1 min-w-0">
            {song.title}
          </h1>

          {/* 즐겨찾기 */}
          <button
            onClick={() => toggleFavorite(song.id)}
            className="shrink-0 text-lg hover:scale-110 transition-transform"
          >
            {isFavorite(song.id) ? (
              <span className="text-yellow-400">★</span>
            ) : (
              <span className="text-t-muted">☆</span>
            )}
          </button>

          {/* 몰입 모드 토글 */}
          <button
            onClick={() => setImmersive(!immersive)}
            className="shrink-0 text-t-hint hover:text-t-primary transition-colors"
            title={immersive ? "일반 모드" : "전체 화면"}
          >
            {immersive ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
        </div>
      </header>

      {/* ━━ 상단 2행: 악보 탭 + 성경 본문 + 가사 탭 (몰입 시 숨김) ━━ */}
      {!immersive && (
        <div
          className="shrink-0 border-b border-b-light transition-all duration-300"
          style={{ backgroundColor: "var(--c-accent, #1e293b)" }}
        >
          <div className="max-w-3xl mx-auto flex items-center">
            <button
              onClick={() => setActiveTab("sheet")}
              className={`flex-1 text-center py-2.5 text-sm font-medium transition-colors
                ${activeTab === "sheet"
                  ? "text-white border-b-2 border-white"
                  : "text-white/60 hover:text-white/80"
                }`}
            >
              악보
            </button>

            <span className="text-white/90 text-xs font-medium px-2 whitespace-nowrap">
              {scriptureLabel}
            </span>

            <button
              onClick={() => setActiveTab("lyrics")}
              className={`flex-1 text-center py-2.5 text-sm font-medium transition-colors
                ${activeTab === "lyrics"
                  ? "text-white border-b-2 border-white"
                  : "text-white/60 hover:text-white/80"
                }`}
            >
              가사
            </button>
          </div>
        </div>
      )}

      {/* ━━ 중간: 악보 또는 가사 (스크롤 영역) ━━ */}
      <main className="flex-1 overflow-auto min-h-0">
        <div className="max-w-3xl mx-auto h-full">
          {activeTab === "sheet" && (
            <SheetView
              sheetImage={song.sheetImage}
              title={song.title}
            />
          )}
          {activeTab === "lyrics" && (
            <LyricsView verses={song.verses} />
          )}
        </div>
      </main>

      {/* ━━ 하단 (몰입 시 숨김) ━━ */}
      {!immersive && (
        <footer className="shrink-0 bg-card border-t border-b-light transition-all duration-300">
          <div className="max-w-3xl mx-auto">

            {/* 하단 1줄: ◀ 목차 ▶ + 다운로드 */}
            <div className="flex items-center px-3 py-2">
              {/* 이전 */}
              <button
                onClick={() => prevSong && navigate(`/song/${prevSong.id}`)}
                disabled={!prevSong}
                className={`shrink-0 p-1.5 rounded-full transition-colors
                  ${prevSong
                    ? "text-t-secondary hover:text-t-primary hover:bg-gray-100 active:bg-gray-200"
                    : "text-t-muted/30 cursor-not-allowed"
                  }`}
                title="이전 곡"
              >
                <PrevIcon />
              </button>

              {/* 현재 목차 */}
              <span className="flex-1 text-center text-xs font-medium text-t-secondary">
                {scriptureLabel}
              </span>

              {/* 다음 */}
              <button
                onClick={() => nextSong && navigate(`/song/${nextSong.id}`)}
                disabled={!nextSong}
                className={`shrink-0 p-1.5 rounded-full transition-colors
                  ${nextSong
                    ? "text-t-secondary hover:text-t-primary hover:bg-gray-100 active:bg-gray-200"
                    : "text-t-muted/30 cursor-not-allowed"
                  }`}
                title="다음 곡"
              >
                <NextIcon />
              </button>

              {/* PDF 다운로드 */}
              <a
                href={song.sheetPdf}
                download
                className="shrink-0 ml-2 p-1.5 rounded-full text-t-hint
                  hover:text-t-primary hover:bg-gray-100 active:bg-gray-200
                  transition-colors"
                title="PDF 다운로드"
              >
                <DownloadIcon />
              </a>
            </div>

            {/* 하단 2줄: 메모 */}
            <div className="px-3 pb-2">
              <MemoEditor
                value={getMemo(song.id)}
                onSave={(text) => saveMemo(song.id, text)}
              />
            </div>

          </div>
        </footer>
      )}
    </div>
  );
}
