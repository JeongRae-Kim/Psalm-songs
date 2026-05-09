/* ── MiniPlayer.jsx v2 ──
 * 공통 미니 플레이어 컴포넌트 (1단 컴팩트 + 2단 확장 패널)
 *
 * 1단: 정지, 재생/일시정지 토글, 프로그레스 바, 절 카운트
 * 2단: 템포 슬라이더 (전체 폭), 시간 표시, 메모
 */

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
const ExpandUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const CollapseDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
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
 * @param {boolean} [props.showSoundToggle=false] - 사운드 ON/OFF 버튼 (박자연습 전용)
 * @param {boolean} props.expanded - 확장 패널 열림 여부
 * @param {Function} props.onToggleExpand - 확장 토글 콜백
 * @param {React.ReactNode} [props.memoSlot] - 메모 컴포넌트 슬롯
 */
export default function MiniPlayer({ player, showSoundToggle = false, expanded = false, onToggleExpand, memoSlot }) {
  /* 로딩 상태 */
  if (!player.ready) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: "40px" }}>
        <span className="text-[11px] text-white/50">로딩 중…</span>
      </div>
    );
  }

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* ━━ 1단: 컴팩트 컨트롤 ━━ */}
      <div className="flex items-center gap-2 min-w-0">
        {/* 정지 */}
        <button onClick={player.stop}
          style={{ width: "36px", height: "36px", minWidth: "36px" }}
          className="shrink-0 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/10 transition-colors"
          title="처음으로">
          <StopIcon />
        </button>

        {/* 재생/일시정지 토글 */}
        <button onClick={player.playing ? player.pause : player.play}
          style={{ width: "40px", height: "40px", minWidth: "40px" }}
          className="shrink-0 rounded-full flex items-center justify-center bg-white/15 text-white hover:bg-white/25 active:bg-white/35 transition-colors"
          title={player.playing ? "일시정지" : "재생"}>
          {player.playing ? <PauseIcon /> : <PlayIcon />}
        </button>

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

        {/* 확장 토글 */}
        {onToggleExpand && (
          <button onClick={onToggleExpand}
            style={{ width: "32px", height: "32px", minWidth: "32px" }}
            className="shrink-0 rounded-full flex items-center justify-center text-white/50 hover:text-white active:bg-white/10 transition-colors"
            title={expanded ? "접기" : "펼치기"}>
            {expanded ? <CollapseDownIcon /> : <ExpandUpIcon />}
          </button>
        )}
      </div>

      {/* ━━ 2단: 확장 패널 ━━ */}
      {expanded && (
        <div className="flex flex-col gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          {/* 시간 표시 */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-white/60">{formatTime(player.displayTime)}</span>
            <span className="text-xs text-white/60">{formatTime(player.duration)}</span>
          </div>

          {/* 템포 슬라이더 (전체 폭) */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-white/50 shrink-0">템포</span>
            <input type="range" min={60} max={200} step={1}
              value={player.tempo}
              onChange={(e) => player.changeTempo(Number(e.target.value))}
              className="flex-1 h-2 accent-white"
            />
            <span className="text-sm text-white/80 font-medium shrink-0 w-16 text-right">
              {player.tempo} BPM
            </span>
          </div>

          {/* 메모 슬롯 */}
          {memoSlot && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} className="pt-3">
              {memoSlot}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
