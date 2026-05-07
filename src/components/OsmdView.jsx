/**
 * OsmdView.jsx v8.1
 * MXL → OSMD 악보 렌더링 + 커서 동기화 + 자동 스크롤
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [커서 동기화 — v8.1: beat 기반 매핑 (안정화)]                    │
 * │                                                                 │
 * │ 1. OSMD 로드 시 각 커서 스텝의 beat 값 수집 (cursorTimesRef)     │
 * │ 2. MIDI에서 BPM 전달받음 (midiBpm prop)                         │
 * │ 3. MIDI 재생 시간(초) → beat 변환:                               │
 * │    adjustedSec = origSec - midiOffset                           │
 * │    beat = (adjustedSec / scale) × (BPM / 60) / 4               │
 * │    ※ OSMD realValue는 온음표=1.0 단위이므로 /4 필요             │
 * │ 4. scale = MIDI 실제 연주 길이 / OSMD 추정 길이                  │
 * │    - MIDI 연주 길이: melodyTimes 마지막 값 - 첫 값               │
 * │    - OSMD 추정 길이: lastBeat × 4 × 60 / BPM                   │
 * │    - melodyTimes 미로드 시 scale=1.0 (무보정)                    │
 * │ 5. cursorTimesRef에서 현재 beat 이하의 마지막 인덱스 = 커서 위치  │
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
  midiBpm = 0,
  midiOffset = 0,
}) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const cursorIdxRef = useRef(0);
  const totalStepsRef = useRef(0);
  const cursorTimesRef = useRef([]);
  const bpmRef = useRef(0);

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

        // BPM 수집: OSMD → MIDI(prop) → 기본값 120
        const srcMeasures = osmd.sheet?.SourceMeasures;
        const osmdBpm = srcMeasures?.[0]?.TempoInBPM || 0;
        const detectedBpm = osmdBpm > 0 ? osmdBpm : (midiBpm > 0 ? midiBpm : 120);
        bpmRef.current = detectedBpm;

        osmd.cursor.reset();
        osmd.cursor.show();
        cursorIdxRef.current = 0;

        forceCursorVisible();
        await new Promise((r) => requestAnimationFrame(r));
        forceCursorVisible();

        const bpmSource = osmdBpm > 0 ? "OSMD" : (midiBpm > 0 ? "MIDI" : "기본값");
        const lastBeat = times.length > 0 ? times[times.length - 1] : 0;
        const estDuration = detectedBpm > 0 ? (lastBeat * 4 * 60 / detectedBpm) : "N/A";
        console.log(
          `OSMD 준비: ${times.length}스텝, BPM=${detectedBpm}(${bpmSource}), ` +
          `lastBeat=${lastBeat.toFixed(2)}, 추정길이=${typeof estDuration === "number" ? estDuration.toFixed(1) + "초" : estDuration}`
        );
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

  // ── midiBpm이 나중에 들어왔을 때 bpmRef 업데이트 (OSMD 재로드 없이) ──
  useEffect(() => {
    if (midiBpm > 0 && bpmRef.current === 120) {
      // OSMD에서 BPM을 못 가져와서 기본값 120이었는데, MIDI에서 BPM이 들어온 경우
      bpmRef.current = midiBpm;
    }
  }, [midiBpm]);

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

  // ── 커서 동기화: beat 기반 매핑 (v8.1) ──
  const getCursorTarget = useCallback(
    (origSec) => {
      if (totalStepsRef.current === 0) return 0;

      const cTimes = cursorTimesRef.current;
      const bpm = bpmRef.current;

      // ── beat 기반 매핑 (BPM + cursorTimes 유효할 때) ──
      if (bpm > 0 && cTimes.length > 0) {
        const lastBeat = cTimes[cTimes.length - 1] || 1;
        const osmdEstDuration = lastBeat * 4 * 60 / bpm;

        // scale 계산: melodyTimes가 유효하면 사용, 아니면 무보정(1.0)
        const mTimes = melodyTimes;
        let scale = 1.0;
        if (mTimes && mTimes.length >= 2) {
          const firstNote = mTimes[0];
          const lastNote = mTimes[mTimes.length - 1];
          const midiPlayDuration = lastNote - firstNote;
          if (midiPlayDuration > 0 && osmdEstDuration > 0) {
            scale = midiPlayDuration / osmdEstDuration;
          }
        }

        const adjustedSec = Math.max(0, origSec - midiOffset);
        const currentBeat = (adjustedSec / scale) * (bpm / 60) / 4;

        // cursorTimes에서 currentBeat 이하인 마지막 인덱스 찾기
        let step = 0;
        for (let i = cTimes.length - 1; i >= 0; i--) {
          if (cTimes[i] <= currentBeat + 0.01) {
            step = i;
            break;
          }
        }
        return Math.min(step, totalStepsRef.current - 1);
      }

      // ── fallback: BPM 없을 때 ──
      return 0;
    },
    [melodyTimes, midiOffset]
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
      const bpm = bpmRef.current;
      const cTimes = cursorTimesRef.current;
      const lastBeat = cTimes.length > 0 ? cTimes[cTimes.length - 1] : 1;
      const osmdEst = bpm > 0 ? lastBeat * 4 * 60 / bpm : 0;
      const mTimes = melodyTimes;
      let scale = 1.0;
      if (mTimes && mTimes.length >= 2) {
        const midiPlay = mTimes[mTimes.length - 1] - mTimes[0];
        if (midiPlay > 0 && osmdEst > 0) scale = midiPlay / osmdEst;
      }
      console.log(
        `[커서] t=${originalTime.toFixed(2)}s, scale=${scale.toFixed(3)}, ` +
        `target=${target}/${totalStepsRef.current}, ` +
        `cursorBeat=${cTimes[target]?.toFixed(2) || "?"}`
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
