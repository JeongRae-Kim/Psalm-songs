/**
 * OsmdViewMxl.jsx v1.1
 * MXL → OSMD 악보 렌더링 + currentStepIdx 직접 매핑 + 자동 스크롤 + 줌 버튼
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

/* ── 줌 아이콘 ── */
const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

export default function OsmdViewMxl({
  mxlUrl,
  currentStepIdx = 0,
  playing = false,
  scrollContainerRef,
  currentLoop = 0,
}) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const cursorIdxRef = useRef(0);
  const baseZoomRef = useRef(0.7);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zooming, setZooming] = useState(false);

  // ── 커서 DOM 강제 표시 (height 1px 버그 수정) ──
  const forceCursorVisible = useCallback(() => {
    const cursorImg = containerRef.current?.querySelector('img[id^="cursorImg-"]');
    if (!cursorImg) return;
    const attrH = cursorImg.getAttribute("height");
    const h = attrH ? attrH + "px" : "171px";
    cursorImg.style.display = "block";
    cursorImg.style.opacity = "0.5";
    cursorImg.style.zIndex = "100";
    cursorImg.style.height = h;
    cursorImg.style.minHeight = h;
  }, []);

  // ── OSMD 로드 & 렌더 ──
  useEffect(() => {
    if (!mxlUrl || !containerRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    containerRef.current.innerHTML = "";

    fetch(mxlUrl)
      .then((res) => {
        if (!res.ok) throw new Error("MXL 로드 실패: " + res.status);
        return res.arrayBuffer();
      })
      .then(async (mxlBuffer) => {
        if (cancelled) return;

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawComposer: true,
          drawLyricist: true,
          drawPartNames: false,
          drawMeasureNumbers: false,
          followCursor: true,
          pageFormat: "Endless",
          drawingParameters: "compact",
        });

        try {
          await osmd.load(mxlBuffer);
        } catch (e1) {
          console.warn("[MXL view] ArrayBuffer 실패, URL 시도:", e1.message);
          await osmd.load(mxlUrl);
        }

        const containerWidth = containerRef.current.offsetWidth || 380;
        const baseWidth = 1000;
        const padding = 16;
        const idealZoom = Math.max(0.4, Math.min(1.0, (containerWidth - padding) / baseWidth));
        osmd.zoom = idealZoom;
        baseZoomRef.current = idealZoom;
        setZoomLevel(100);

        osmd.render();
        osmdRef.current = osmd;
        osmd.cursor.show();
        osmd.cursor.reset();
        cursorIdxRef.current = 0;

        forceCursorVisible();
        await new Promise((r) => requestAnimationFrame(r));
        forceCursorVisible();

        console.log(`[MXL view] OSMD 준비 완료, zoom=${idealZoom.toFixed(2)}`);

        if (!cancelled) setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      osmdRef.current = null;
    };
  }, [mxlUrl, forceCursorVisible]);

  useEffect(() => {
    if (!loading && osmdRef.current) {
      forceCursorVisible();
      setTimeout(forceCursorVisible, 200);
    }
  }, [loading, forceCursorVisible]);

  // ── 줌 변경 ──
  const handleZoomChange = useCallback(async (delta) => {
    const osmd = osmdRef.current;
    if (!osmd || zooming) return;

    const newLevel = Math.min(150, Math.max(50, zoomLevel + delta));
    if (newLevel === zoomLevel) return;

    setZooming(true);
    setZoomLevel(newLevel);

    const newZoom = baseZoomRef.current * (newLevel / 100);
    osmd.zoom = newZoom;

    const savedIdx = cursorIdxRef.current;

    try {
      osmd.render();

      osmd.cursor.reset();
      osmd.cursor.show();
      cursorIdxRef.current = 0;

      for (let i = 0; i < savedIdx && !osmd.cursor.iterator.endReached; i++) {
        osmd.cursor.next();
        cursorIdxRef.current++;
      }

      forceCursorVisible();
    } catch (e) {
      console.warn("줌 변경 중 오류:", e);
    }

    setZooming(false);
  }, [zoomLevel, zooming, forceCursorVisible]);

  const handleZoomReset = useCallback(() => {
    if (zoomLevel === 100) return;
    handleZoomChange(100 - zoomLevel);
  }, [zoomLevel, handleZoomChange]);

  // ── 스크롤 ──
  const scrollToCursor = useCallback(() => {
    const cursorEl = containerRef.current?.querySelector('img[id^="cursorImg-"]');
    const scrollEl = scrollContainerRef?.current;
    if (!cursorEl || !scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const cursorRect = cursorEl.getBoundingClientRect();

    const threshold = scrollRect.top + scrollRect.height * 0.5;
    if (cursorRect.top > threshold || cursorRect.bottom < scrollRect.top) {
      const offset = cursorRect.top - scrollRect.top - scrollRect.height * 0.25;
      scrollEl.scrollTo({
        top: scrollEl.scrollTop + offset,
        behavior: "smooth",
      });
    }
  }, [scrollContainerRef]);

  // ── 커서 동기화: currentStepIdx 직접 사용 ──
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !playing) return;

    const target = currentStepIdx;

    if (target < cursorIdxRef.current) {
      osmd.cursor.reset();
      osmd.cursor.show();
      cursorIdxRef.current = 0;
    }

    let moved = false;
    while (cursorIdxRef.current < target && !osmd.cursor.iterator.endReached) {
      osmd.cursor.next();
      cursorIdxRef.current++;
      moved = true;
    }

    forceCursorVisible();
    if (moved) scrollToCursor();
  }, [currentStepIdx, playing, scrollToCursor, forceCursorVisible]);

  // ── 반복 재생 시 cursor 처음으로 리셋 ──
  useEffect(() => {
    if (currentLoop > 0 && osmdRef.current) {
      try {
        osmdRef.current.cursor.reset();
        osmdRef.current.cursor.show();
        cursorIdxRef.current = 0;
        forceCursorVisible();
        scrollToCursor();
      } catch (e) { /* 무시 */ }
    }
  }, [currentLoop, forceCursorVisible, scrollToCursor]);

  // ── 정지 시 리셋 ──
  useEffect(() => {
    if (!playing && currentStepIdx === 0 && osmdRef.current) {
      try {
        osmdRef.current.cursor.reset();
        osmdRef.current.cursor.show();
        cursorIdxRef.current = 0;
        setTimeout(forceCursorVisible, 100);
      } catch (e) { /* 무시 */ }
    }
  }, [playing, currentStepIdx, forceCursorVisible]);

  return (
    <div style={{ backgroundColor: "#faf8f4", minHeight: "100%" }}>
      {/* 줌 컨트롤 */}
      {!loading && !error && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: "6px", padding: "6px 12px",
          position: "sticky", top: 0, zIndex: 10,
          backgroundColor: "rgba(250, 248, 244, 0.9)",
          backdropFilter: "blur(4px)",
        }}>
          <button onClick={() => handleZoomChange(-10)}
            disabled={zoomLevel <= 50 || zooming}
            style={{
              width: "32px", height: "32px", borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.15)", backgroundColor: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: zoomLevel <= 50 || zooming ? "not-allowed" : "pointer",
              opacity: zoomLevel <= 50 || zooming ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
            title="축소">
            <ZoomOutIcon />
          </button>

          <button onClick={handleZoomReset}
            style={{
              minWidth: "48px", height: "32px", borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.15)", backgroundColor: "white",
              fontSize: "0.75rem", fontWeight: 600, color: "#374151",
              cursor: "pointer", padding: "0 8px",
              transition: "background-color 0.15s",
            }}
            title="줌 리셋 (100%)">
            {zooming ? "…" : `${zoomLevel}%`}
          </button>

          <button onClick={() => handleZoomChange(10)}
            disabled={zoomLevel >= 150 || zooming}
            style={{
              width: "32px", height: "32px", borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.15)", backgroundColor: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: zoomLevel >= 150 || zooming ? "not-allowed" : "pointer",
              opacity: zoomLevel >= 150 || zooming ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
            title="확대">
            <ZoomInIcon />
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <p style={{ color: "rgba(0,0,0,0.3)", fontSize: "0.8rem" }}>
            악보를 불러오는 중…
          </p>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-20">
          <p style={{ color: "rgba(200,0,0,0.6)", fontSize: "0.8rem" }}>
            악보 로드 실패: {error}
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          padding: "8px",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.4s ease-out",
          position: "relative",
        }}
      />
    </div>
  );
}
