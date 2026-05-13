import usePlaylists from "../hooks/usePlaylists";

/**
 * AddToPlaylistButton
 * 곡을 플레이리스트에 추가/제거하는 토글 버튼
 *
 * @param {string} songId
 * @param {"icon"|"header"} [variant="icon"] - icon: SongCard용 작은 아이콘, header: SongDetailPage 상단용
 * @param {Function} [onClick] - 추가 콜백 (e.stopPropagation 등 필요 시)
 */
const PlusIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function AddToPlaylistButton({ songId, variant = "icon", onClick }) {
  const { isInPlaylist, addSong, removeSong } = usePlaylists();
  const inPlaylist = isInPlaylist(songId);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    if (inPlaylist) {
      removeSong(songId);
    } else {
      addSong(songId);
    }
  };

  // SongCard용 - 작은 회색/강조 아이콘
  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className="shrink-0 p-2 transition-colors hover:scale-110"
        title={inPlaylist ? "플레이리스트에서 제거" : "플레이리스트에 추가"}
      >
        {inPlaylist ? (
          <span className="text-green-500 inline-flex"><CheckIcon size={18} /></span>
        ) : (
          <span className="text-t-muted hover:text-t-secondary inline-flex"><PlusIcon size={18} /></span>
        )}
      </button>
    );
  }

  // SongDetailPage 상단용 - 헤더와 어울리는 스타일
  if (variant === "header") {
    return (
      <button
        onClick={handleClick}
        className={`shrink-0 transition-colors ${
          inPlaylist ? "text-green-500 hover:text-green-600" : "text-t-hint hover:text-t-primary"
        }`}
        title={inPlaylist ? "플레이리스트에서 제거" : "플레이리스트에 추가"}
      >
        {inPlaylist ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
      </button>
    );
  }

  return null;
}
