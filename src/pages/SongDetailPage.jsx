
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import useMemos from "../hooks/useMemos";
import LyricsView from "../components/LyricsView";
import SheetView from "../components/SheetView";
import MemoEditor from "../components/MemoEditor";

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addRecent } = useRecent();
  const { getMemo, saveMemo } = useMemos();
  const [activeTab, setActiveTab] = useState("sheet");

  const song = songs.find((s) => s.id === id);

  // 최근 본 곡 기록
  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <p className="text-t-hint">불러오는 중…</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-4">
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
    <div className="min-h-screen bg-page">
      {/* 헤더 */}
      <header className="bg-card border-b border-b-light px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-t-hint hover:text-t-primary transition-colors text-sm shrink-0"
            >
              ← 목록
            </button>
            <span className="w-px h-4 bg-gray-200 shrink-0" />
            <h1 className="text-lg font-bold text-t-primary truncate flex-1 min-w-0">
              {song.title}
            </h1>
            {/* 즐겨찾기 토글 */}
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
          </div>
          <p className="text-xs text-t-hint mt-1 ml-16">
            {song.scripture} · {song.tuneName}
          </p>
        </div>
      </header>

      {/* 탭 바 */}
      <div className="bg-card border-b border-b-light">
        <div className="max-w-3xl mx-auto flex">
          <button
            onClick={() => setActiveTab("lyrics")}
            className={`flex-1 text-center py-3 text-sm font-medium transition-colors
              ${activeTab === "lyrics"
                ? "text-t-primary border-b-2 border-gray-800"
                : "text-t-hint hover:text-t-secondary"
              }`}
          >
            가사
          </button>
          <button
            onClick={() => setActiveTab("sheet")}
            className={`flex-1 text-center py-3 text-sm font-medium transition-colors
              ${activeTab === "sheet"
                ? "text-t-primary border-b-2 border-gray-800"
                : "text-t-hint hover:text-t-secondary"
              }`}
          >
            악보
          </button>
        </div>
      </div>

      {/* 탭 내용 */}
      <main className="max-w-3xl mx-auto">
        {activeTab === "lyrics" && (
          <LyricsView verses={song.verses} />
        )}
        {activeTab === "sheet" && (
          <SheetView
            sheetImage={song.sheetImage}
            sheetPdf={song.sheetPdf}
            title={song.title}
          />
        )}

        {/* 메모 */}
        <div className="px-4 py-4">
          <MemoEditor
            value={getMemo(song.id)}
            onSave={(text) => saveMemo(song.id, text)}
          />
        </div>
      </main>
    </div>
  );
}