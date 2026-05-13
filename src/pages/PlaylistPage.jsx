import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import usePlaylists from "../hooks/usePlaylists";
import usePlayback from "../contexts/PlaybackContext";
import HomeIcon from "../components/icons/HomeIcon";

/* ── 아이콘 ── */
const ArrowUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PlayIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);

const RepeatIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const MusicIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export default function PlaylistPage() {
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { defaultPlaylist, songIds, songCount, removeSong, moveUp, moveDown } = usePlaylists();
  const { loopPlaylist, toggleLoopPlaylist, startPlaylist } = usePlayback();

  // songIds 순서대로 실제 곡 객체 매핑 (없는 곡은 자동 제외)
  const playlistSongs = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    return songIds
      .map((id) => songs.find((s) => s.id === id))
      .filter(Boolean);
  }, [songs, songIds]);

  // 유효한 곡 ID만 (제외된 곡 빼고)
  const validSongIds = useMemo(() => playlistSongs.map((s) => s.id), [playlistSongs]);

  const scriptureLabel = (song) =>
    song.psalmNumber
      ? `시편 ${song.psalmNumber}편 ${song.verseRange}`
      : `이사야 ${song.verseRange}`;

  const handlePlayFromStart = () => {
    if (validSongIds.length === 0) return;
    const firstId = startPlaylist(validSongIds, 0);
    if (firstId) navigate(`/song/${firstId}`);
  };

  const handlePlayFrom = (index) => {
    if (index < 0 || index >= validSongIds.length) return;
    const songId = startPlaylist(validSongIds, index);
    if (songId) navigate(`/song/${songId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <p className="text-t-hint">불러오는 중…</p>
      </div>
    );
  }

  const isEmpty = playlistSongs.length === 0;

  return (
    <div className="min-h-screen bg-page">
      {/* 헤더 */}
      <header className="bg-header border-b border-b-light px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-t-hint hover:text-t-primary transition-colors"
            title="홈으로"
          >
            <HomeIcon size={22} title="홈으로" />
          </button>
          <h1 className="text-xl font-bold text-t-primary flex-1">
            {defaultPlaylist?.name || "내 플레이리스트"}
            <span className="ml-2 text-sm font-normal text-t-hint">
              {songCount > 0 ? `${songCount}곡` : ""}
            </span>
          </h1>

          {/* 전체 반복 토글 */}
          {!isEmpty && (
            <button
              onClick={toggleLoopPlaylist}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-colors border
                ${loopPlaylist
                  ? "bg-accent text-white border-accent"
                  : "bg-card text-t-secondary border-b-default hover:border-gray-400"
                }`}
              title={loopPlaylist ? "전체 반복 끄기" : "전체 반복 켜기"}
            >
              <RepeatIcon size={14} />
              <span>전체 반복{loopPlaylist ? " ON" : ""}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* 빈 상태 */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-t-muted mb-4">
              <MusicIcon size={56} />
            </div>
            <p className="text-t-secondary mb-2">플레이리스트가 비어있습니다</p>
            <p className="text-sm text-t-hint">
              홈 화면이나 곡 페이지에서 <span className="font-bold">+</span> 버튼을 눌러 곡을 추가하세요
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-4 py-2 text-sm rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
            >
              곡 둘러보기
            </button>
          </div>
        )}

        {/* 처음부터 재생 버튼 */}
        {!isEmpty && (
          <button
            onClick={handlePlayFromStart}
            className="w-full mb-3 px-4 py-3 rounded-lg bg-accent text-white
              flex items-center justify-center gap-2
              hover:opacity-90 active:opacity-80 transition-opacity shadow-sm"
          >
            <PlayIcon size={20} />
            <span className="font-medium">처음부터 재생</span>
            <span className="text-xs opacity-75">({playlistSongs.length}곡)</span>
          </button>
        )}

        {/* 곡 목록 */}
        {!isEmpty && (
          <div className="flex flex-col gap-2">
            {playlistSongs.map((song, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === playlistSongs.length - 1;
              return (
                <div key={song.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handlePlayFrom(idx)}
                    className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3
                      bg-card rounded-lg shadow-sm
                      hover:shadow-md hover:-translate-y-0.5
                      active:translate-y-0 active:shadow-sm
                      transition-all duration-200 ease-out
                      text-left cursor-pointer border border-b-light"
                  >
                    <span className="shrink-0 text-xs text-t-hint w-6 text-right">
                      {idx + 1}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-t-secondary whitespace-nowrap">
                      {scriptureLabel(song)}
                    </span>
                    <span className="flex-1 min-w-0 text-t-primary font-medium truncate">
                      {song.title}
                    </span>
                  </button>

                  <button
                    onClick={() => moveUp(idx)}
                    disabled={isFirst}
                    className={`shrink-0 p-2 transition-colors ${
                      isFirst ? "text-t-muted opacity-30 cursor-not-allowed" : "text-t-hint hover:text-t-primary"
                    }`}
                    title="위로 이동"
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={isLast}
                    className={`shrink-0 p-2 transition-colors ${
                      isLast ? "text-t-muted opacity-30 cursor-not-allowed" : "text-t-hint hover:text-t-primary"
                    }`}
                    title="아래로 이동"
                  >
                    <ArrowDownIcon />
                  </button>
                  <button
                    onClick={() => removeSong(song.id)}
                    className="shrink-0 p-2 text-red-400 hover:text-red-600 transition-colors"
                    title="플레이리스트에서 제거"
                  >
                    <MinusIcon />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
