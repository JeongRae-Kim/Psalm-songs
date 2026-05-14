/* ── MiniPlayer.jsx v4 ──
 * 공통 미니 플레이어 컴포넌트 (단일행, 메모/확장/템포 제거)
 *
 * 1행 구성: [정지] [재생/일시정지] [반복] [프로그레스 바] [절 카운트]
 *
 * 단계 B-1 변경:
 *   - 기존: player 객체를 props로 받음
 *   - 변경: usePlayer() context 구독으로 전환. player prop 제거.
 *   - showSoundToggle prop은 유지 (박자연습 전용, 재생 엔진과 무관).
 */
import { getAudioContext } from "../hooks/audioContext";
import usePlayer from "../contexts/PlayerContext";

/* ── 아이콘 ── */
const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" /><rect x="15" y="3" width="4" height="18" />
  </svg>
);
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" />
  </svg>
);
const SoundOnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);
const SoundOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
/* 무한 반복 아이콘 (두 화살표 원형 루프) */
const RepeatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

/**
 * @param {Object} props
 * @param {boolean} [props.showSoundToggle=false] - 사운드 ON/OFF 버튼 (박자연습 전용)
 */
export default function MiniPlayer({ showSoundToggle = false }) {
  const player = usePlayer();

  /* 로딩 상태 */
  if (!player.ready) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: "40px" }}>
        <span className="text-[11px] text-white/50">로딩 중…</span>
      </div>
    );
  }

  const handlePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      // iOS Safari 호환: 사용자 제스처 내에서 동기적으로 AudioContext 생성+resume
      getAudioContext();
      player.play();
    }
  };

  const handleProgressClick = (e) => {
    if (typeof player.seekTo !== "function") return;  // seekTo 미지원 훅(반주기) 안전 처리
    const rect = e.currentTarget.getBoundingClientRect();
    player.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  const hasInfiniteLoop = typeof player.toggleInfiniteLoop === "function";

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
      {/* 정지 */}
      <button onClick={player.stop}
        style={{ width: "36px", height: "36px", minWidth: "36px" }}
        className="shrink-0 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/10 transition-colors"
        title="처음으로">
        <StopIcon />
      </button>

      {/* 재생/일시정지 토글 */}
      <button onClick={handlePlayPause}
        style={{ width: "40px", height: "40px", minWidth: "40px" }}
        className="shrink-0 rounded-full flex items-center justify-center bg-white/15 text-white hover:bg-white/25 active:bg-white/35 transition-colors"
        title={player.playing ? "일시정지" : "재생"}>
        {player.playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* 무한 반복 토글 */}
      {hasInfiniteLoop && (
        <button onClick={player.toggleInfiniteLoop}
          style={{ width: "36px", height: "36px", minWidth: "36px" }}
          className={`shrink-0 rounded-full flex items-center justify-center transition-colors
            ${player.infiniteLoop
              ? "bg-white/20 text-white hover:bg-white/30"
              : "text-white/50 hover:text-white active:bg-white/10"}`}
          title={player.infiniteLoop ? "무한 반복 끄기" : "무한 반복 켜기"}>
          <RepeatIcon />
        </button>
      )}

      {/* 사운드 ON/OFF (박자연습 전용) */}
      {showSoundToggle && player.toggleSound && (
        <button onClick={player.toggleSound}
          style={{ width: "36px", height: "36px", minWidth: "36px" }}
          className={`shrink-0 rounded-full flex items-center justify-center transition-colors
            ${player.soundEnabled ? "text-white/80 hover:text-white" : "text-white/30 hover:text-white/50"}`}
          title={player.soundEnabled ? "사운드 끄기" : "사운드 켜기"}>
          {player.soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
      )}

      {/* 프로그레스 바 */}
      <div onClick={handleProgressClick}
        className="flex-1 h-2 rounded-full cursor-pointer overflow-hidden min-w-[60px]"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${Math.min(100, player.progress * 100)}%`, backgroundColor: "rgba(255,255,255,0.7)", transition: "none" }} />
      </div>

      {/* 절 카운트 */}
      {player.totalLoops > 1 && (
        <span className="shrink-0 text-xs text-white/70 font-medium" title={`${player.currentLoop + 1}/${player.totalLoops}절`}>
          {player.currentLoop + 1}/{player.totalLoops}
        </span>
      )}
    </div>
  );
}
