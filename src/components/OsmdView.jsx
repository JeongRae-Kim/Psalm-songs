/**
 * OsmdView.jsx v8
 * MXL → OSMD 악보 렌더링 + 커서 동기화 + 자동 스크롤
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [커서 동기화 — v8: beat 기반 매핑]                                │
 * │                                                                 │
 * │ 1. OSMD 로드 시 각 커서 스텝의 beat 값 수집 (cursorTimesRef)     │
 * │ 2. OSMD에서 BPM 추출 (bpmRef)                                   │
 * │ 3. MIDI 재생 시간(초) → beat 변환: beat = sec × (BPM / 60)      │
 * │ 4. cursorTimesRef에서 현재 beat 이하의 마지막 인덱스 = 커서 위치  │
 * │                                                                 │
 * │ 이 방식은 음표 길이를 정확히 반영하므로 2분음표는 오래 머물고,    │
 * │ 16분음표는 빠르게 넘어감.                                        │
 * │                                                                 │
 * │ fallback: BPM 추출 실패 시 기존 비례 매핑 사용                   │
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
}) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const cursorIdxRef = useRef(0);
  const totalStepsRef = useRef(0);

  /**
   * 각 커서 스텝의 timestamp (beat 단위)
   * beat 기반 매칭 업그레이드 시 이 배열을 초(seconds)로 변환하여 사용
   * 변환 공식: seconds = beat × (60 / BPM)
   * 변박곡인 경우 구간별 BPM을 적용해야 정확함
   */
  const cursorTimesRef = useRef([]);
  const bpmRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── 커서 DOM 강제 표시 (height 1px 버그 수정) ──
  // 자기 컨테이너 내부의 cursor만 찾음 (다중 OsmdView 인스턴스 간 ID 충돌 방지)
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
          pageFormat: "Endless",         // 페이지 분할 X, 무한 세로 스크롤
          drawingParameters: "compact",  // 모바일 친화 압축 레이아웃
        });

        try {
          await osmd.load(mxlBuffer);
        } catch (e1) {
          console.warn("ArrayBuffer 실패, URL 시도:", e1.message);
          await osmd.load(mxlUrl);
        }

        // 변경 4: 컨테이너 폭 기반 zoom 동적 계산 (모바일 폭 맞춤)
        // 기준 폭 1000px → 컨테이너가 좁으면 zoom을 줄임. 하한 0.4로 가독성 보장.
        const containerWidth = containerRef.current.offsetWidth || 380;
        const baseWidth = 1000;
        const padding = 16; // 좌우 padding 8px씩
        const idealZoom = Math.max(0.4, Math.min(1.0, (containerWidth - padding) / baseWidth));
        osmd.zoom = idealZoom;
        console.log(`OSMD zoom: ${idealZoom.toFixed(2)} (container ${containerWidth}px)`);

        osmd.render();
        osmdRef.current = osmd;
        osmd.cursor.show();

        // 각 커서 스텝의 timestamp(beat) 수집 + 총 스텝 수 카운트
        const times = [];
        osmd.cursor.reset();
        while (!osmd.cursor.iterator.endReached) {
          const ts = osmd.cursor.iterator.currentTimeStamp;
          times.push(ts ? ts.realValue : times.length);
          osmd.cursor.next();
        }
        totalStepsRef.current = times.length;
        cursorTimesRef.current = times;

        // BPM 수집 (beat → 초 변환에 필요)
        // 우선순위: OSMD 악보 → MIDI 헤더(prop) → 기본값 120
        const srcMeasures = osmd.sheet?.SourceMeasures;
        const osmdBpm = srcMeasures?.[0]?.TempoInBPM || 0;
        const detectedBpm = osmdBpm > 0 ? osmdBpm : (midiBpm > 0 ? midiBpm : 120);
        bpmRef.current = detectedBpm;

        // 리셋
        osmd.cursor.reset();
        osmd.cursor.show();
        cursorIdxRef.current = 0;

        // 변경 5: 페이드인 타이밍 보강
        // 커서를 먼저 강제 표시한 뒤 한 프레임 대기 → DOM 안정화 후 페이드인 시작
        forceCursorVisible();
        await new Promise((r) => requestAnimationFrame(r));
        forceCursorVisible();

        // 디버그: beat 기반 매핑 검증용
        const lastBeat = times.length > 0 ? times[times.length - 1] : 0;
        const estDuration = detectedBpm > 0 ? (lastBeat * 60 / detectedBpm) : "N/A";
        const bpmSource = osmdBpm > 0 ? "OSMD" : (midiBpm > 0 ? "MIDI" : "기본값");
        console.log(
          `OSMD 준비: ${times.length}스텝, BPM=${detectedBpm}(${bpmSource}), ` +
          `lastBeat=${lastBeat.toFixed(2)}, 추정길이=${typeof estDuration === "number" ? estDuration.toFixed(1) + "초" : estDuration}`
        );
        console.log("cursorTimes:", JSON.stringify(times.map(t => Math.round(t * 1000) / 1000)));
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
    // 자기 컨테이너 내부의 cursor만 찾음 (다중 OsmdView 인스턴스 간 ID 충돌 방지)
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

  // ── 커서 동기화: beat 기반 매핑 (v8) ──
  // BPM과 cursorTimesRef가 유효하면 beat 기반, 아니면 기존 비례 매핑 fallback
  const getCursorTarget = useCallback(
    (origSec) => {
      if (totalStepsRef.current === 0) return 0;

      const cTimes = cursorTimesRef.current;
      const bpm = bpmRef.current;

      // ── beat 기반 매핑 (BPM + cursorTimes 둘 다 유효할 때) ──
      if (bpm > 0 && cTimes.length > 0) {
        // 재생 시간(초) → beat 변환: beat = seconds × (BPM / 60)
        const currentBeat = origSec * (bpm / 60);

        // cursorTimes에서 currentBeat 이하인 마지막 인덱스 찾기
        let step = 0;
        for (let i = cTimes.length - 1; i >= 0; i--) {
          if (cTimes[i] <= currentBeat + 0.01) { // 부동소수점 오차 허용
            step = i;
            break;
          }
        }
        return Math.min(step, totalStepsRef.current - 1);
      }

      // ── fallback: 기존 비례 매핑 (BPM 없는 곡) ──
      const mTimes = melodyTimes;
      if (!mTimes || mTimes.length === 0) {
        const totalDur = 34;
        return Math.floor((origSec / totalDur) * totalStepsRef.current);
      }

      const adjusted = origSec + 0.05;
      let noteIdx = 0;
      for (let i = mTimes.length - 1; i >= 0; i--) {
        if (mTimes[i] <= adjusted) {
          noteIdx = i;
          break;
        }
      }

      const ratio = noteIdx / Math.max(1, mTimes.length - 1);
      const targetStep = Math.round(ratio * (totalStepsRef.current - 1));
      return Math.min(targetStep, totalStepsRef.current - 1);
    },
    [melodyTimes]
  );

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !playing || totalStepsRef.current === 0) return;

    const target = getCursorTarget(originalTime);

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
  }, [originalTime, playing, getCursorTarget, scrollToCursor, forceCursorVisible]);

  // ── 반복 재생 시 cursor 처음으로 리셋 ──
  useEffect(() => {
    if (currentLoop > 0 && osmdRef.current) {
      try {
        osmdRef.current.cursor.reset();
        osmdRef.current.cursor.show();
        cursorIdxRef.current = 0;
        forceCursorVisible();
        // 부드러운 시각 효과: 악보 처음으로 스크롤
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
