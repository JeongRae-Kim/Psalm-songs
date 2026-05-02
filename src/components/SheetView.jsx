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
    const containerW = container.offsetWidth - 24; // padding 12px * 2
    const containerH = container.offsetHeight;

    // 확대된 이미지 크기
    const scaledW = imgW * s;
    const scaledH = imgH * s;

    // 이동 가능 범위 (확대로 넘치는 부분만큼)
    const maxX = Math.max(0, (scaledW - containerW) / 2 / s);
    const maxY = Math.max(0, (scaledH - containerH) / 2 / s);

    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(0, Math.max(-maxY * 2, ty)), // 위로는 이동 제한, 아래로만
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      e.preventDefault();
      pinchRef.current = {
        active: true,
        initialDistance: getDistance(e.touches),
        initialScale: scale,
      };
      panRef.current.active = false;
    } else if (e.touches.length === 1 && scale > 1) {
      // 확대 상태에서 한 손 패닝 시작
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
      // 핀치 줌 중
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const ratio = currentDistance / pinchRef.current.initialDistance;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 1), 3);
      setScale(newScale);

      // 축소 시 translate도 보정
      if (newScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && panRef.current.active && scale > 1) {
      // 확대 상태에서 한 손 패닝 중
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
    // 핀치나 패닝 직후에는 무시
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
        background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)",
        minHeight: "100%",
      }}
    >
      {/* 악보 액자 */}
      <div
        ref={containerRef}
        style={{
          padding: "12px",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.6s ease-out",
          touchAction: isZoomed ? "none" : "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          position: "relative",
          overflow: "hidden",
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
              transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
              transition: pinchRef.current.active || panRef.current.active
                ? "none"
                : "transform 0.2s ease-out",
              willChange: "transform",
            }}
          />
        </div>

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
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
            악보를 불러오는 중…
          </p>
        </div>
      )}
    </div>
  );
}
