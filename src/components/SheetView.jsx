import { useRef, useCallback, useEffect, useState } from "react";

/**
 * SheetView (줌 외부화 버전)
 *
 * 줌 상태(scale)는 부모 컴포넌트에서 관리하고 props로 받음.
 * 핀치 줌, 더블탭 줌, 마우스 휠 줌 입력은 내부에서 처리하되,
 * 결과 scale 값은 onScaleChange 콜백으로 부모에 전달.
 *
 * @param {string} sheetImage - 악보 이미지 경로
 * @param {string} title - 곡 제목
 * @param {number} scale - 현재 줌 배율 (1.0 ~ 3.0)
 * @param {Function} onScaleChange - 줌 변경 콜백 (newScale: number) => void
 */
export default function SheetView({ sheetImage, title, scale = 1, onScaleChange }) {
  const [loaded, setLoaded] = useState(false);
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

    // 좌우 제한
    const maxX = Math.max(0, (scaledW - containerW) / 2 / s);

    // 상단 절대 고정: ty는 0 이하만 허용 (양수 = 위로 이동 = 차단)
    // 하단 제한: 확대된 이미지 하단까지만
    const minY = -Math.max(0, (scaledH - containerH) / s);

    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.max(minY, Math.min(0, ty)),
    };
  }, []);

  // scale 변경 시 translate 보정
  const requestScaleChange = useCallback((newScale) => {
    const clamped = Math.min(3, Math.max(1, newScale));
    if (onScaleChange) onScaleChange(clamped);
    if (clamped <= 1) {
      setTranslate({ x: 0, y: 0 });
    } else {
      setTranslate((prev) => clampTranslate(prev.x, prev.y, clamped));
    }
  }, [clampTranslate, onScaleChange]);

  // scale이 외부에서 1로 리셋되면 translate도 리셋
  useEffect(() => {
    if (scale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

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
      requestScaleChange(newScale);
    } else if (e.touches.length === 1 && panRef.current.active && scale > 1) {
      e.preventDefault();
      const dx = (e.touches[0].clientX - panRef.current.startX) / scale;
      const dy = (e.touches[0].clientY - panRef.current.startY) / scale;
      const newTx = panRef.current.startTranslateX + dx;
      const newTy = panRef.current.startTranslateY + dy;
      const clamped = clampTranslate(newTx, newTy, scale);
      setTranslate(clamped);
    }
  }, [scale, clampTranslate, requestScaleChange]);

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
        requestScaleChange(1);
      } else {
        requestScaleChange(2);
      }
    }
    lastTapRef.current = now;
  }, [scale, requestScaleChange]);

  // 마우스 휠 줌
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    requestScaleChange(scale + delta);
  }, [scale, requestScaleChange]);

  // 마우스 드래그
  const mouseRef = useRef({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });

  const handleMouseDown = useCallback((e) => {
    if (scale <= 1) return;
    e.preventDefault();
    mouseRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTx: translate.x,
      startTy: translate.y,
    };
  }, [scale, translate]);

  const handleMouseMove = useCallback((e) => {
    if (!mouseRef.current.active || scale <= 1) return;
    const dx = (e.clientX - mouseRef.current.startX) / scale;
    const dy = (e.clientY - mouseRef.current.startY) / scale;
    const newTx = mouseRef.current.startTx + dx;
    const newTy = mouseRef.current.startTy + dy;
    const clamped = clampTranslate(newTx, newTy, scale);
    setTranslate(clamped);
  }, [scale, clampTranslate]);

  const handleMouseUp = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  // 이벤트 등록
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts = { passive: false };
    el.addEventListener("touchstart", handleTouchStart, opts);
    el.addEventListener("touchmove", handleTouchMove, opts);
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);
    el.addEventListener("click", handleTap);
    el.addEventListener("wheel", handleWheel, opts);
    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
      el.removeEventListener("click", handleTap);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTap, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  const isZoomed = scale > 1;

  return (
    <div
      style={{
        backgroundColor: "#faf8f4",
        minHeight: "100%",
      }}
    >
      {/* 악보 */}
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
          cursor: isZoomed ? "grab" : "default",
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
            transition: pinchRef.current.active || panRef.current.active || mouseRef.current.active
              ? "none"
              : "transform 0.2s ease-out",
            willChange: "transform",
          }}
        />
      </div>

      {/* 로딩 중 */}
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
