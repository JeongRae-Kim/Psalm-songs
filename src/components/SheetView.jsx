import { useState, useRef, useCallback, useEffect } from "react";

export default function SheetView({ sheetImage, title }) {
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // 핀치 줌 상태 추적
  const pinchRef = useRef({
    active: false,
    initialDistance: 0,
    initialScale: 1,
  });

  // 두 손가락 사이 거리 계산
  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = {
        active: true,
        initialDistance: getDistance(e.touches),
        initialScale: scale,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const ratio = currentDistance / pinchRef.current.initialDistance;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 1), 3);
      setScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
  }, []);

  // 더블탭 줌 토글
  const lastTapRef = useRef(0);
  const handleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      setScale((prev) => (prev > 1 ? 1 : 2));
    }
    lastTapRef.current = now;
  }, []);

  // 터치 이벤트 등록 (passive: false 필요)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts = { passive: false };
    el.addEventListener("touchstart", handleTouchStart, opts);
    el.addEventListener("touchmove", handleTouchMove, opts);
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)",
        minHeight: "100%",
      }}
    >
      {/* 악보 액자 */}
      <div
        ref={containerRef}
        onClick={handleTap}
        style={{
          padding: "12px",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(12px)",
          transition: loaded
            ? "opacity 0.6s ease-out, transform 0.6s ease-out"
            : "opacity 0.6s ease-out, transform 0.6s ease-out",
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            borderRadius: "8px",
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)",
            overflow: "hidden",
          }}
        >
          <img
            ref={imgRef}
            src={sheetImage}
            alt={`${title} 악보`}
            onLoad={() => setLoaded(true)}
            draggable={false}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              backgroundColor: "#faf8f4",
              transformOrigin: "top center",
              transform: `scale(${scale})`,
              transition: pinchRef.current.active
                ? "none"
                : "transform 0.2s ease-out",
            }}
          />
        </div>

        {/* 줌 레벨 표시 (확대 시에만) */}
        {scale > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              backgroundColor: "rgba(0,0,0,0.5)",
              color: "white",
              fontSize: "0.7rem",
              padding: "4px 8px",
              borderRadius: "12px",
            }}
          >
            {Math.round(scale * 100)}%
          </div>
        )}
      </div>

      {/* 로딩 중 표시 */}
      {!loaded && (
        <div className="flex items-center justify-center py-20">
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
            악보를 불러오는 중…
          </p>
        </div>
      )}
    </div>
  );
}
