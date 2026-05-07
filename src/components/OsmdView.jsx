/**
 * OsmdView.jsx v7
 * MXL → OSMD 악보 렌더링 + 커서 동기화 + 자동 스크롤
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [커서 동기화 — 현재 방식: 비례 매핑]                              │
 * │                                                                 │
 * │ targetStep = (noteIdx / melodyNotes) × totalCursorSteps         │
 * │                                                                 │
 * │ MIDI 노트 수(예: 54)와 OSMD 커서 스텝 수(예: 59)가 다를 때       │
 * │ 비례 변환으로 매핑. 대부분의 찬송가에서 잘 동작하지만,              │
 * │ 노트 밀도가 곡 구간별로 크게 다르면 오차 발생 가능.               │
 * │                                                                 │
 * │ [업그레이드: beat 기반 매칭]                                      │
 * │                                                                 │
 * │ 더 정확한 방식은 OSMD 커서의 각 스텝에서 수집한                    │
 * │ cursorTimesRef (beat 값)를 MIDI 시간(초)으로 변환하여              │
 * │ 직접 매칭하는 것:                                                │
 * │                                                                 │
 * │ 1. cursorTimesRef[i] = OSMD beat 값 (realValue)                 │
 * │ 2. beat → 초 변환: seconds = beat × (60 / BPM)                  │
 * │    ※ 변박곡은 구간별 BPM이 다르므로 MIDI의 time_signature/        │
 * │      set_tempo 이벤트를 파싱하여 구간별 변환 필요                  │
 * │ 3. 각 커서 스텝의 시간(초)과 현재 재생 시간(초)을 비교:            │
 * │    for (i = cursorTimes.length - 1; i >= 0; i--)                │
 * │      if (cursorSeconds[i] <= currentOrigSec) return i;          │
 * │                                                                 │
 * │ 구현 시 수정 포인트:                                              │
 * │ - OSMD 로드 시 cursorTimesRef에 beat 값 수집 (이미 구현됨)        │
 * │ - useMidiPlayer에서 BPM 정보 전달 (이미 구현됨)                   │
 * │ - getCursorTarget()에서 beat→초 변환 후 이진 검색                 │
 * │ - 변박곡 대응: MIDI header의 tempos 배열로 구간별 BPM 매핑         │
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── 커서 DOM 강제 표시 (height 1px 버그 수정) ──
  const forceCursorVisible = useCallback(() => {
    const cursorImg = document.getElementById("cursorImg-0");
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

        // 리셋
        osmd.cursor.reset();
        osmd.cursor.show();
        cursorIdxRef.current = 0;

        // 변경 5: 페이드인 타이밍 보강
        // 커서를 먼저 강제 표시한 뒤 한 프레임 대기 → DOM 안정화 후 페이드인 시작
        forceCursorVisible();
        await new Promise((r) => requestAnimationFrame(r));
        forceCursorVisible();

        console.log("OSMD 준비:", times.length, "커서 스텝");
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
    const cursorEl = document.getElementById("cursorImg-0");
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

  // ── 커서 동기화: 비례 매핑 방식 ──
  // (beat 기반 매칭으로 업그레이드 시 이 함수를 교체 — 상단 주석 참고)
  const getCursorTarget = useCallback(
    (origSec) => {
      if (totalStepsRef.current === 0) return 0;

      const mTimes = melodyTimes;
      if (!mTimes || mTimes.length === 0) {
        // 멜로디 타이밍 없으면 시간 비례
        const totalDur = 34;
        return Math.floor((origSec / totalDur) * totalStepsRef.current);
      }

      // 현재 시간 → 멜로디 노트 인덱스
      const adjusted = origSec + 0.05;
      let noteIdx = 0;
      for (let i = mTimes.length - 1; i >= 0; i--) {
        if (mTimes[i] <= adjusted) {
          noteIdx = i;
          break;
        }
      }

      // 비례 변환: noteIdx / melodyNotes ≈ cursorStep / totalSteps
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
