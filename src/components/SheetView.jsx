import { useState, useRef, useCallback, useEffect } from "react";

export default function SheetView({ sheetImage, title }) {
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // 핀치 줌 상태
  const pinchRef = useRef({
    active: false,
    initialDistance: 0,
    initialScale: 1,
  });

  // 패닝 상태
  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
  });

  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 패닝 범위 제한
  const clampTranslate = useCallback((tx, ty, s) => {
    if (s <= 1) return { x: 0, y: 0 };
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: tx, y: ty };

    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;
    const containerW = container.offsetWidth;
    const containerH = container.offsetHeight;

    const scaledW = imgW * s;
    const scaledH = imgH * s;

    const maxX = Math.max(0, (scaledW - containerW) / 2 / s);

    // 상단 고정: y는 0 이하만 허용 (위로 이동 불가)
    // 하단 제한: 악보 아래쪽 끝까지만 이동 가능
    const maxY = Math.max(0, (scaledH - containerH) / s);

    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(0, Math.max(-maxY, ty)),
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = {
        active: true,
        initialDistance: getDistance(e.touches),
        initialScale: scale,
      };
      panRef.current.active = false;
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      panRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTranslateX: translate.x,
        startTranslateY: translate.y,
      };
    }
  }, [scale, translate]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const ratio = currentDistance / pinchRef.current.initialDistance;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 1), 3);
      setScale(newScale);

      if (newScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && panRef.current.active && scale > 1) {
      e.preventDefault();
      const dx = (e.touches[0].clientX - panRef.current.startX) / scale;
      const dy = (e.touches[0].clientY - panRef.current.startY) / scale;
      const newTx = panRef.current.startTranslateX + dx;
      const newTy = panRef.current.startTranslateY + dy;
      const clamped = clampTranslate(newTx, newTy, scale);
      setTranslate(clamped);
    }
  }, [scale, clampTranslate]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
    panRef.current.active = false;
  }, []);

  // 더블탭 줌 토글
  const lastTapRef = useRef(0);
  const handleTap = useCallback((e) => {
    if (e.touches && e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (scale > 1) {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      } else {
        setScale(2);
        setTranslate({ x: 0, y: 0 });
      }
    }
    lastTapRef.current = now;
  }, [scale]);

  // 터치 이벤트 등록
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts = { passive: false };
    el.addEventListener("touchstart", handleTouchStart, opts);
    el.addEventListener("touchmove", handleTouchMove, opts);
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);
    el.addEventListener("click", handleTap);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
      el.removeEventListener("click", handleTap);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTap]);

  const isZoomed = scale > 1;

  return (
    <div
      style={{
        backgroundColor: "#faf8f4",
        minHeight: "100%",
      }}
    >
      {/* 악보 — 여백 없이 꽉 차게 */}
      <div
        ref={containerRef}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.6s ease-out",
          touchAction: isZoomed ? "none" : "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          position: "relative",
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
            transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
            transition: pinchRef.current.active || panRef.current.active
              ? "none"
              : "transform 0.2s ease-out",
            willChange: "transform",
          }}
        />

        {/* 줌 레벨 + 리셋 버튼 (확대 시에만) */}
        {isZoomed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale(1);
              setTranslate({ x: 0, y: 0 });
            }}
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              backgroundColor: "rgba(0,0,0,0.6)",
              color: "white",
              fontSize: "0.7rem",
              padding: "6px 12px",
              borderRadius: "16px",
              border: "none",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            {Math.round(scale * 100)}% ✕
          </button>
        )}
      </div>

      {/* 로딩 중 표시 */}
      {!loaded && (
        <div className="flex items-center justify-center py-20">
          <p style={{ color: "rgba(0,0,0,0.3)", fontSize: "0.8rem" }}>
            악보를 불러오는 중…
          </p>
        </div>
      )}
    </div>
  );
}
