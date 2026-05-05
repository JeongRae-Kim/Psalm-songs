/**
 * MidiPlayer.jsx
 * MIDI 재생 컨트롤 바 — 재생/정지/탐색/템포
 * useMidiPlayer 훅의 상태와 액션을 받아 UI 표시
 */

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);

const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" />
    <rect x="15" y="3" width="4" height="18" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="5" width="3" height="14" />
    <polygon points="18,5 18,19 8,12" />
  </svg>
);

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MidiPlayer({
  playing,
  currentTime,
  duration,
  tempo,
  ready,
  loading,
  error,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onTempoChange,
}) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, fraction)));
  };

  if (error) {
    return (
      <div
        style={{ backgroundColor: "var(--accent, #374151)" }}
        className="px-3 py-2"
      >
        <p className="text-xs text-white/60 text-center">
          MIDI 로드 실패: {error}
        </p>
      </div>
    );
  }

  if (!ready && !loading) return null;

  return (
    <div style={{ backgroundColor: "var(--accent, #374151)" }}>
      <div className="max-w-3xl mx-auto px-3 py-2">
        {/* 로딩 중 */}
        {loading && (
          <p className="text-xs text-white/60 text-center py-1">
            MIDI 로딩 중…
          </p>
        )}

        {/* 플레이어 */}
        {ready && (
          <>
            {/* 1행: 컨트롤 + 프로그레스 */}
            <div className="flex items-center gap-2">
              {/* 처음으로 */}
              <button
                onClick={onStop}
                className="shrink-0 w-8 h-8 rounded-full flex items-center
                  justify-center text-white/70 hover:text-white
                  active:bg-white/10 transition-colors"
                title="처음으로"
              >
                <StopIcon />
              </button>

              {/* 재생/일시정지 */}
              <button
                onClick={playing ? onPause : onPlay}
                className="shrink-0 w-10 h-10 rounded-full flex items-center
                  justify-center bg-white/10 text-white
                  hover:bg-white/20 active:bg-white/30 transition-colors"
                title={playing ? "일시정지" : "재생"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>

              {/* 프로그레스 바 */}
              <div className="flex-1 flex flex-col gap-1">
                <div
                  onClick={handleProgressClick}
                  className="w-full h-1.5 rounded-full cursor-pointer overflow-hidden"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <div
                    className="h-full rounded-full transition-none"
                    style={{
                      width: `${Math.min(100, progress)}%`,
                      backgroundColor: "rgba(255,255,255,0.8)",
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/50">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-[10px] text-white/50">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2행: 템포 */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-white/50">템포</span>
              <input
                type="range"
                min={60}
                max={200}
                step={1}
                value={tempo}
                onChange={(e) => onTempoChange(Number(e.target.value))}
                className="flex-1 h-1 accent-white opacity-60"
                style={{ maxWidth: "120px" }}
              />
              <span className="text-[10px] text-white/70 min-w-[50px]">
                {tempo} BPM
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
