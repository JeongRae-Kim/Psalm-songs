/**
 * OsmdView.jsx v9
 * MXL → OSMD 악보 렌더링 + 커서 동기화 + 자동 스크롤
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [커서 동기화 — v9: 진행률 기반 segment interpolation]            │
 * │                                                                 │
 * │ BPM 변환, offset 보정, scale 보정 전부 불필요.                   │
 * │                                                                 │
 * │ 1. melodyTimes (MIDI 음표 시작 시간, 초 단위) 배열 사용          │
 * │ 2. cursorTimes (OSMD 커서 스텝 beat 값) 배열 사용               │
 * │ 3. 현재 재생 시간 → melodyTimes에서 음표 인덱스 찾기             │
 * │ 4. 음표 인덱스 → cursorTimes 스텝에 segment interpolation 매핑  │
 * │                                                                 │
 * │ 두 배열의 길이가 달라도 구간별 보간으로 정확하게 매핑됨.          │
 * │ BPM, offset, scale 등 외부 보정값 없이 자체 완결적으로 동작.     │
 * └─────────────────────────────────────────────────────────────────┘
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export default function OsmdView({
  mxlUrl,
  originalTime,
  melodyTimes,
  playing,
  scrollContainerRef,
  currentLoop = 0,
}) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const cursorIdxRef = useRef(0);
  const totalStepsRef = useRef(0);
  const cursorTimesRef = useRef([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          console.warn("ArrayBuffer 실패, URL 시도:", e1.message);
          await osmd.load(mxlUrl);
        }

        const containerWidth = containerRef.current.offsetWidth || 380;
        const baseWidth = 1000;
        const padding = 16;
        const idealZoom = Math.max(0.4, Math.min(1.0, (containerWidth - padding) / baseWidth));
        osmd.zoom = idealZoom;
        console.log(`OSMD zoom: ${idealZoom.toFixed(2)} (container ${containerWidth}px)`);

        osmd.render();
        osmdRef.current = osmd;
        osmd.cursor.show();

        // 각 커서 스텝의 timestamp(beat) 수집
        const times = [];
        osmd.cursor.reset();
        while (!osmd.cursor.iterator.endReached) {
          const ts = osmd.cursor.iterator.currentTimeStamp;
          times.push(ts ? ts.realValue : times.length);
          osmd.cursor.next();
        }
        totalStepsRef.current = times.length;
        cursorTimesRef.current = times;

        osmd.cursor.reset();
        osmd.cursor.show();
        cursorIdxRef.current = 0;

        forceCursorVisible();
        await new Promise((r) => requestAnimationFrame(r));
        forceCursorVisible();

        console.log(`OSMD 준비: ${times.length}스텝`);
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

  // ── 커서 동기화: 진행률 기반 segment interpolation (v9) ──
  const getCursorTarget = useCallback(
    (origSec) => {
      const totalSteps = totalStepsRef.current;
      if (totalSteps === 0) return 0;

      const mTimes = melodyTimes;

      // ── melodyTimes가 유효할 때: segment interpolation ──
      if (mTimes && mTimes.length >= 2) {
        const firstMidi = mTimes[0];
        const lastMidi = mTimes[mTimes.length - 1];
        const midiRange = lastMidi - firstMidi;

        if (midiRange <= 0) return 0;

        // origSec가 첫 음표 전이면 스텝 0
        if (origSec <= firstMidi) return 0;

        // melodyTimes에서 현재 시간 위치의 음표 인덱스 (소수점 포함 보간)
        let noteIdx = mTimes.length - 1;  // 마지막 음표 이후면 끝
        for (let i = mTimes.length - 1; i >= 0; i--) {
          if (mTimes[i] <= origSec) {
            if (i < mTimes.length - 1) {
              // 현재 음표와 다음 음표 사이의 보간 비율
              const segDur = mTimes[i + 1] - mTimes[i];
              const elapsed = origSec - mTimes[i];
              noteIdx = i + (segDur > 0 ? elapsed / segDur : 0);
            } else {
              noteIdx = i;
            }
            break;
          }
        }

        // 음표 인덱스 → 커서 스텝 (비례 매핑)
        const noteProgress = noteIdx / Math.max(1, mTimes.length - 1);
        const targetStep = Math.round(noteProgress * (totalSteps - 1));

        return Math.min(Math.max(0, targetStep), totalSteps - 1);
      }

      // ── fallback: melodyTimes 없을 때 (MIDI 미로드) ──
      return 0;
    },
    [melodyTimes]
  );

  // ── 디버그 로그용 ──
  const lastDebugRef = useRef(0);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !playing || totalStepsRef.current === 0) return;

    const target = getCursorTarget(originalTime);

    // 디버그: 1초 간격으로 현재 상태 출력
    const now = Date.now();
    if (now - lastDebugRef.current > 1000) {
      const mTimes = melodyTimes;
      const mLen = mTimes?.length || 0;
      const firstM = mLen > 0 ? mTimes[0] : 0;
      const lastM = mLen > 0 ? mTimes[mLen - 1] : 0;
      const range = lastM - firstM;
      const progress = range > 0
        ? ((originalTime - firstM) / range * 100).toFixed(1)
        : "N/A";
      console.log(
        `[커서] t=${originalTime.toFixed(2)}s, progress=${progress}%, ` +
        `target=${target}/${totalStepsRef.current}, melodyNotes=${mLen}`
      );
      lastDebugRef.current = now;
    }

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
  }, [originalTime, playing, getCursorTarget, scrollToCursor, forceCursorVisible, melodyTimes]);

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
    if (!playing && originalTime === 0 && osmdRef.current) {
      try {
        osmdRef.current.cursor.reset();
        osmdRef.current.cursor.show();
        cursorIdxRef.current = 0;
        setTimeout(forceCursorVisible, 100);
      } catch (e) { /* 무시 */ }
    }
  }, [playing, originalTime, forceCursorVisible]);

  return (
    <div style={{ backgroundColor: "#faf8f4", minHeight: "100%" }}>
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
