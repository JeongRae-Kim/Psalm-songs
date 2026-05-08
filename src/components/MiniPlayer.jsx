/* ── MiniPlayer.jsx ──
 * 공통 미니 플레이어 컴포넌트
 * 연습 / 박자연습 / MXL재생 / 악보 탭 하단에서 공용으로 사용
 */

/* ── 아이콘 ── */
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

/**
 * @param {Object} props
 * @param {Object} props.player - 플레이어 훅 반환 객체
 *   { play, pause, stop, seekTo, playing, progress, displayTime,
 *     duration, tempo, changeTempo, currentLoop, totalLoops, ready }
 * @param {boolean} [props.showSoundToggle=false] - 사운드 ON/OFF 버튼 (박자연습 전용)
 */
export default function MiniPlayer({ player, showSoundToggle = false }) {
  /* 로딩 상태 */
  if (!player.ready) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[11px] text-white/50">로딩 중…</span>
      </div>
    );
  }

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div className="flex-1 flex items-center gap-1.5 min-w-0">
      {/* 정지 (처음으로) */}
      <button onClick={player.stop}
        className="shrink-0 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        title="처음으로"><StopSmall /></button>

      {/* 재생 */}
      <button onClick={player.play}
        disabled={player.playing}
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
          ${player.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
        title="재생"><PlaySmall /></button>

      {/* 일시정지 */}
      <button onClick={player.pause}
        disabled={!player.playing}
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
          ${!player.playing ? "bg-white/5 text-white/30" : "bg-white/15 text-white hover:bg-white/25 active:bg-white/35"}`}
        title="일시정지"><PauseSmall /></button>

      {/* 사운드 ON/OFF (박자연습 전용) */}
      {showSoundToggle && player.toggleSound && (
        <button onClick={player.toggleSound}
          className={`shrink-0 w-6 h-6 flex items-center justify-center transition-colors
            ${player.soundEnabled ? "text-white/80 hover:text-white" : "text-white/30 hover:text-white/50"}`}
          title={player.soundEnabled ? "메트로놈 사운드 끄기" : "메트로놈 사운드 켜기"}>
          {player.soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
      )}

      {/* 시간 */}
      <span className="shrink-0 text-[10px] text-white/50 w-7 text-right">
        {formatTime(player.displayTime)}
      </span>

      {/* 프로그레스 바 */}
      <div onClick={handleProgressClick}
        className="flex-1 h-1.5 rounded-full cursor-pointer overflow-hidden min-w-[40px]"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${Math.min(100, player.progress * 100)}%`, backgroundColor: "rgba(255,255,255,0.7)", transition: "none" }} />
      </div>

      {/* 총 시간 */}
      <span className="shrink-0 text-[10px] text-white/50 w-7">
        {formatTime(player.duration)}
      </span>

      {/* 절 카운트 */}
      {player.totalLoops > 1 && (
        <span className="shrink-0 text-[10px] text-white/60 ml-1" title={`${player.currentLoop + 1}/${player.totalLoops}절`}>
          {player.currentLoop + 1}/{player.totalLoops}
        </span>
      )}

      {/* 템포 */}
      <input type="range" min={60} max={200} step={1}
        value={player.tempo}
        onChange={(e) => player.changeTempo(Number(e.target.value))}
        className="shrink-0 h-1 accent-white opacity-50"
        style={{ width: "45px" }} title={`${player.tempo} BPM`} />
      <span className="shrink-0 text-[9px] text-white/40 w-5">{player.tempo}</span>
    </div>
  );
}