/**
 * useHybridPlayer.js v0.3 (옵션 B PoC)
 *
 * 옵션 B: cursor는 MXL 단일 원천에서 파생, 소리는 MIDI 파일 재생
 *
 * 구조:
 *   - 재생(소리)        ← useMidiPlayer를 그대로 활용 (velocity 가변, rit./fermata 자동 반영)
 *   - cursor 데이터     ← MXL에서 OSMD 임시 인스턴스로 음표 데이터(notesData) 추출
 *   - cursor 매핑       ← midi.currentTime → beat → notesData[stepIdx]
 *   - 절 단위 강제 동기화 ← useMidiPlayer가 절 끝마다 currentTime을 0으로 리셋 → 누적 차단
 *
 * 두 시간축은 절 시작에서만 동기, 절 내부에서는 자유롭게 진행됨.
 * 절 끝(rit./fermata 구간)에서 cursor가 마지막 음표에 정지한 채 소리가 늘어지는 것은 의도된 동작.
 * 절 시작의 빈 공백(intro_offset) 동안에도 cursor가 첫 음표에 정지한 채 무음이 흐르는 것은 의도된 동작.
 *
 * 작성 배경: 옵션B_PoC_작업계획서_v1.md §3
 * PoC 평가 곡: psalm-090 (1차), psalm-040 (2차), psalm-119-73 (대조군), psalm-023 (중간 케이스)
 *
 * 변경 이력:
 *   v0.1 (2026-05-09) — 초기 작성
 *   v0.2 (2026-05-09) — 매핑 분모를 lastBeat(마지막 음표 시작) → lastBeatEnd(마지막 음표 끝)로 보정.
 *                       v0.1에서는 마지막 음표가 totalSec에 매핑되어 시각적 체류 시간이 0이었음.
 *                       v0.2부터는 마지막 음표가 본인 duration 만큼 표시되며, rit./fermata 곡에서는
 *                       cursor가 마지막 음표에 일찍 도달해 fermata 동안 정지함.
 *   v0.3 (2026-05-09) — 매핑 시간축에 intro_offset(midi.melodyTimes[0]) 보정 추가.
 *                       MIDI 첫 음표 onset 이전(앞 공백 구간) 동안 cursor를 첫 음표에 정지시키고,
 *                       이후 활성 구간(intro_offset ~ totalSec)을 lastBeatEnd 비례로 매핑.
 *                       11곡 분석 결과 6곡(isaiah-040, psalm-006/042-6/090/119-41/119-73)이
 *                       0.5~1.7s의 앞 공백을 가짐. 평가 곡 중 psalm-090(1.643s), 119-73(1.714s)에
 *                       가장 큰 영향. 앞 공백 ≈0인 곡(psalm-040, 023)에서는 v0.2와 동일하게 동작.
 */
import { useEffect, useState, useRef, useMemo } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import useMidiPlayer from "./useMidiPlayer";

export default function useHybridPlayer(mxlUrl, midiUrl, totalLoops = 1) {
  // ─────────────────────────────────────────────────────────
  // 1. MIDI 재생 (useMidiPlayer 그대로 활용)
  //    - velocity 가변 (n.velocity * 127)
  //    - tempo 메타 이벤트 자동 반영 (rit./fermata 시간 변형)
  //    - currentLoop 메커니즘 (절 단위 강제 동기화)
  //    - melodyTimes[0] = 첫 멜로디 음표 onset(초) — v0.3 intro_offset 산출원
  // ─────────────────────────────────────────────────────────
  const midi = useMidiPlayer(midiUrl, totalLoops);

  // ─────────────────────────────────────────────────────────
  // 2. MXL에서 cursor 데이터 추출 (재생은 안 함, OSMD 임시 인스턴스)
  // ─────────────────────────────────────────────────────────
  const [notesData, setNotesData] = useState([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [mxlReady, setMxlReady] = useState(false);
  const [mxlError, setMxlError] = useState(null);
  // v0.2: 마지막 음표의 *끝* timeBeat (= timeBeat + durationBeat). 매핑 분모로 사용.
  // v0.1에서는 마지막 음표 시작 timeBeat을 사용하여 마지막 음표가 totalSec에 매핑되는 문제가 있었음.
  const lastBeatEndRef = useRef(0);

  useEffect(() => {
    if (!mxlUrl) {
      setMxlReady(false);
      return;
    }
    let cancelled = false;
    setMxlReady(false);
    setMxlError(null);
    setNotesData([]);
    setTotalSteps(0);

    // 화면 밖 임시 OSMD 컨테이너
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-99999px";
    tempContainer.style.width = "800px";  // SkyBottomLine 경고 방지
    tempContainer.style.height = "100px";
    document.body.appendChild(tempContainer);

    let osmd;
    try {
      osmd = new OpenSheetMusicDisplay(tempContainer, {
        autoResize: false,
        drawTitle: false,
        drawComposer: false,
        drawLyricist: false,
      });
    } catch (e) {
      console.error("[Hybrid] OSMD 인스턴스 생성 실패:", e);
      setMxlError(`OSMD 생성 실패: ${e.message}`);
      try { tempContainer.parentNode?.removeChild(tempContainer); } catch (_) {}
      return;
    }

    fetch(mxlUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`MXL 로드 실패 status=${r.status}`);
        return r.arrayBuffer();
      })
      .then(async (buf) => {
        if (cancelled) return;

        // OSMD 로드 (ArrayBuffer 우선, 실패 시 URL fallback) — useMxlPlayer와 동일 패턴
        try {
          await osmd.load(buf);
        } catch (e1) {
          try {
            await osmd.load(mxlUrl);
          } catch (e2) {
            throw new Error(`OSMD 로드 실패: ${e2.message}`);
          }
        }
        if (cancelled) return;

        // render 호출 (cursor 사용 전제)
        try {
          osmd.render();
        } catch (e) {
          throw new Error(`OSMD render 실패: ${e.message}`);
        }
        if (cancelled) return;

        if (!osmd.cursor) {
          throw new Error("osmd.cursor가 undefined (render 누락 가능)");
        }

        // notesData 수집 (useMxlPlayer M1 검증 결과 그대로 적용)
        const data = [];
        osmd.cursor.reset();
        let stepIdx = 0;

        while (!osmd.cursor.iterator.endReached) {
          const ts = osmd.cursor.iterator.currentTimeStamp;
          const timeBeat = ts ? ts.realValue : null;
          const ns = osmd.cursor.NotesUnderCursor() || [];

          if (timeBeat !== null) {
            ns.forEach((n) => {
              let isRest = false;
              try {
                isRest = typeof n.isRest === "function" ? n.isRest() : !!n.isRest;
              } catch (_) {
                isRest = false;
              }
              if (isRest) return;
              if (typeof n.halfTone !== "number") return;
              const durationBeat = n.length?.realValue || 0.25;
              data.push({
                stepIdx,
                midi: n.halfTone + 12,
                timeBeat,
                durationBeat,
              });
            });
          }
          osmd.cursor.next();
          stepIdx++;
        }

        if (cancelled) return;

        // v0.2: 매핑 분모로 마지막 음표의 *끝* timeBeat을 사용.
        //  - lastBeatStart = 마지막 음표 시작 (v0.1 기준)
        //  - lastBeatEnd   = 마지막 음표 시작 + duration (v0.2 기준)
        //  - lastBeatStart을 분모로 쓰면 마지막 음표가 totalSec에 매핑되어 체류 시간이 0이 됨.
        //  - lastBeatEnd를 분모로 쓰면 마지막 음표 시작은 totalSec 이전에 매핑되고,
        //    마지막 음표 시작~끝 구간이 cursor 정지 구간이 됨(rit./fermata가 들리는 동안).
        const lastNote = data.length > 0 ? data[data.length - 1] : null;
        const lastBeatStart = lastNote ? lastNote.timeBeat : 0;
        const lastBeatEnd = lastNote
          ? lastNote.timeBeat + (lastNote.durationBeat || 0)
          : 0;
        lastBeatEndRef.current = lastBeatEnd;
        setNotesData(data);
        setTotalSteps(stepIdx);
        setMxlReady(true);

        console.log(
          `[Hybrid] MXL 음표=${data.length}, totalSteps=${stepIdx}, ` +
          `lastBeatStart=${lastBeatStart.toFixed(2)}, ` +
          `lastBeatEnd=${lastBeatEnd.toFixed(2)} (매핑 분모)`
        );
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[Hybrid] MXL 파싱 실패:", e.message);
          setMxlError(e.message);
          setMxlReady(true);
        }
      })
      .finally(() => {
        try {
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
        } catch (_) {}
      });

    return () => {
      cancelled = true;
      try {
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      } catch (_) {}
    };
  }, [mxlUrl]);

  // ─────────────────────────────────────────────────────────
  // 3. cursor 매핑: midi.currentTime → cursor stepIdx
  //
  //    v0.3 매핑 방식: intro_offset 보정 + lastBeatEnd 비례 매핑
  //
  //    intro_offset = midi.melodyTimes[0]  (MIDI 첫 멜로디 음표 onset 시각, 초)
  //    effective_total = totalSec - intro_offset
  //
  //    elapsed < intro_offset (앞 공백 구간):
  //      → cursor = notesData[0].stepIdx (첫 음표 자리에서 정지, 무음 대기)
  //
  //    elapsed >= intro_offset (활성 구간):
  //      → noteSec_i = intro_offset + timeBeat_i × effective_total / lastBeatEnd
  //      → target = max stepIdx where noteSec_i <= elapsed
  //
  //    rit./fermata 구간 동작 (v0.2 그대로):
  //      - 소리(MIDI)는 점점 느려져 마지막 음표에서 길게 늘어짐
  //      - cursor는 평균 BPM 기준이라 rit. 구간보다 빨리 마지막 음표 도달
  //      - 마지막 음표 시작~MIDI 종료 사이 동안 cursor가 마지막 음표에 정지
  //      - 결과: cursor가 마지막 음표에서 정지한 채 fermata가 들리는 자연스러운 마무리
  //
  //    절 전환 시:
  //      - useMidiPlayer가 currentTime을 0으로 리셋
  //      - useMemo가 자동 재계산되어 cursor도 첫 음표 자리로 이동
  //      - intro_offset 동안 cursor는 첫 음표에 정지 → 다음 절 첫 소리와 동기 시작
  //      - 누적 0초 (절 단위 강제 동기화)
  // ─────────────────────────────────────────────────────────
  // v0.3: intro_offset 산출 (앞 공백 시간)
  const introOffset = (midi.melodyTimes && midi.melodyTimes.length > 0)
    ? midi.melodyTimes[0]
    : 0;

  const currentStepIdx = useMemo(() => {
    if (notesData.length === 0) return 0;
    if (midi.originalDuration <= 0) return 0;
    const lastBeatEnd = lastBeatEndRef.current;
    if (lastBeatEnd <= 0) return 0;

    const totalSec = midi.originalDuration;
    const elapsed = midi.currentTime;  // 절 내 시간 (원본 BPM 기준 초)

    // v0.3: 앞 공백 구간에서 cursor를 첫 음표 자리에 정지
    if (elapsed < introOffset) {
      return notesData[0].stepIdx;
    }

    // v0.3: 활성 구간을 effective_total로 정규화
    const effectiveTotal = totalSec - introOffset;
    if (effectiveTotal <= 0) return notesData[0].stepIdx;

    // 평균 BPM 기준 beat → time 비례 매핑 (v0.3: intro_offset 시프트 + lastBeatEnd 분모)
    let target = 0;
    for (let i = notesData.length - 1; i >= 0; i--) {
      const noteSec =
        introOffset + notesData[i].timeBeat * effectiveTotal / lastBeatEnd;
      if (noteSec <= elapsed + 0.01) {
        target = notesData[i].stepIdx;
        break;
      }
    }
    return target;
  }, [notesData, midi.currentTime, midi.originalDuration, introOffset]);

  // ─────────────────────────────────────────────────────────
  // 4. 측정용 로깅 (PoC 평가 데이터 수집)
  //    절 시작 시점, 절 끝 시점에 cursor와 MIDI의 시간 차 기록
  // ─────────────────────────────────────────────────────────
  const lastLoopRef = useRef(-1);
  useEffect(() => {
    if (midi.currentLoop !== lastLoopRef.current) {
      lastLoopRef.current = midi.currentLoop;
      console.log(
        `[Hybrid] 절 전환: currentLoop=${midi.currentLoop}, ` +
        `currentTime=${midi.currentTime.toFixed(3)}s, ` +
        `intro_offset=${introOffset.toFixed(3)}s, ` +
        `currentStepIdx=${currentStepIdx}, totalSteps=${totalSteps}`
      );
    }
  }, [midi.currentLoop, midi.currentTime, currentStepIdx, totalSteps, introOffset]);

  // 절 끝 어긋남 측정 (cursor가 마지막 음표 도달 시점 vs MIDI 종료 시점)
  const reachedLastNoteAtRef = useRef(null);
  useEffect(() => {
    if (notesData.length === 0) return;
    const lastStepIdx = notesData[notesData.length - 1].stepIdx;
    if (currentStepIdx === lastStepIdx && reachedLastNoteAtRef.current === null) {
      reachedLastNoteAtRef.current = midi.currentTime;
      const remaining = midi.originalDuration - midi.currentTime;
      console.log(
        `[Hybrid] cursor 마지막 음표 도달 시점: ${midi.currentTime.toFixed(3)}s, ` +
        `MIDI 남은 시간: ${remaining.toFixed(3)}s ` +
        `(이 시간이 옵션 B의 절 끝 어긋남 = 마지막 음표 체류 시간)`
      );
    }
    if (currentStepIdx === 0 || (notesData[0] && currentStepIdx === notesData[0].stepIdx)) {
      reachedLastNoteAtRef.current = null;  // 새 절 시작 시 리셋
    }
  }, [currentStepIdx, notesData, midi.currentTime, midi.originalDuration]);

  // v0.3: intro_offset 보정 효과 측정 — 첫 음표가 실제 소리내는 순간 cursor 위치 확인용
  const introMeasuredRef = useRef(false);
  useEffect(() => {
    if (notesData.length === 0) return;
    if (introOffset <= 0.01) return;  // 앞 공백 거의 없는 곡은 측정 의미 없음
    if (introMeasuredRef.current) return;
    if (midi.currentTime >= introOffset && midi.currentTime < introOffset + 0.1) {
      introMeasuredRef.current = true;
      console.log(
        `[Hybrid] intro_offset 도달: elapsed=${midi.currentTime.toFixed(3)}s, ` +
        `intro_offset=${introOffset.toFixed(3)}s, ` +
        `currentStepIdx=${currentStepIdx} (첫 소리 시점, cursor가 첫 음표 위치여야 정상)`
      );
    }
    if (midi.currentTime < 0.05) {
      introMeasuredRef.current = false;  // 새 절 시작 시 리셋
    }
  }, [midi.currentTime, currentStepIdx, introOffset, notesData]);

  // ─────────────────────────────────────────────────────────
  // 5. 출력 (useMxlPlayer 인터페이스와 호환 — OsmdViewMxl + 미니 플레이어 그대로 사용 가능)
  // ─────────────────────────────────────────────────────────
  return {
    // 재생 컨트롤 (useMidiPlayer 그대로)
    loading: midi.loading,
    ready: midi.ready && mxlReady && notesData.length > 0,
    error: midi.error || mxlError,
    playing: midi.playing,
    play: midi.play,
    pause: midi.pause,
    stop: midi.stop,
    seekTo: midi.seekTo,
    changeTempo: midi.changeTempo,
    tempo: midi.tempo,

    // 시간/진행률 (useMidiPlayer 기반)
    currentTime: midi.currentTime,
    originalTime: midi.currentTime,
    originalDuration: midi.originalDuration,
    duration: midi.duration,
    displayTime: midi.displayTime,
    progress: midi.progress,

    // 절 정보
    currentLoop: midi.currentLoop,
    totalLoops,

    // cursor (옵션 B 핵심 — OsmdViewMxl이 그대로 사용)
    currentStepIdx,
    totalSteps,

    // 인터페이스 호환
    melodyTimes: midi.melodyTimes,
  };
}