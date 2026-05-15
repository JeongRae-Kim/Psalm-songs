/**
 * playerEngineUtils.js v1 — 재생 엔진 공통 순수 함수 (6-1 부분 통합)
 *
 * 배경:
 *   useMidiPlayer.js(선형 절 재생)와 useAccompanistPlayer.js(intro/body/amen
 *   phase 머신)는 서로 다른 재생 특성을 갖지만, 두 가지 순수 함수
 *   — createInstrument, computeMeasureBoundaries — 는 글자 단위로
 *   중복되어 있었다. 한쪽만 고치고 다른 쪽을 빠뜨리면 두 엔진 동작이
 *   어긋나는 위험이 있어, 공통 순수 함수만 이 모듈로 추출한다.
 *
 * 범위:
 *   - 이 모듈은 "입력만 받아 출력을 내는 순수 함수"만 담는다. 훅이 아니므로
 *     use 접두사를 쓰지 않고, React에 의존하지 않는다.
 *   - ensurePiano(pianoRef/instrumentRef 등 훅 내부 ref에 결합), 마지막
 *     음표 duration 보정(두 훅에서 코드 형태가 다름)은 추출 대상이 아니며
 *     각 훅에 그대로 남아 있다.
 *
 * 출처:
 *   두 함수 모두 useMidiPlayer.js의 구현을 그대로 옮긴 것이다. 알고리즘은
 *   한 줄도 바꾸지 않았다. useAccompanistPlayer.js 버전의
 *   computeMeasureBoundaries에 있던 tempoEvents 수집 블록은 함수 내
 *   어디에서도 사용되지 않는 죽은 코드였으므로 가져오지 않았다(동작 동일).
 */
import { SplendidGrandPiano, ElectricPiano, Soundfont } from "smplr";

/* ── 악기 인스턴스 생성 헬퍼 ── */
export async function createInstrument(ctx, instrumentKey) {
  let inst;
  switch (instrumentKey) {
    case "epiano":
      inst = new ElectricPiano(ctx, { instrument: "CP80" });
      break;
    case "organ":
      inst = new Soundfont(ctx, { instrument: "church_organ" });
      break;
    case "harpsichord":
      inst = new Soundfont(ctx, { instrument: "harpsichord" });
      break;
    case "celesta":
      inst = new Soundfont(ctx, { instrument: "celesta" });
      break;
    case "piano":
    default:
      inst = new SplendidGrandPiano(ctx);
      break;
  }
  await inst.load;
  return inst;
}

/* ── 마디 경계 계산 (마지막 음표 보정용) ── */
export function computeMeasureBoundaries(midi) {
  const tpb = midi.header.ppq;
  const tsEvents = (midi.header.timeSignatures || [])
    .map((ts) => ({ ticks: ts.ticks, num: ts.timeSignature[0], den: ts.timeSignature[1] }))
    .sort((a, b) => a.ticks - b.ticks);
  if (tsEvents.length === 0) tsEvents.push({ ticks: 0, num: 4, den: 4 });

  let totalTicks = 0;
  midi.tracks.forEach((track) => {
    track.notes.forEach((n) => {
      const endTick = midi.header.secondsToTicks(n.time + n.duration);
      if (endTick > totalTicks) totalTicks = endTick;
    });
  });
  if (totalTicks === 0) totalTicks = midi.header.secondsToTicks(midi.duration);

  const measures = [];
  let currentTick = 0;
  let tsIdx = 0;
  while (currentTick < totalTicks) {
    while (tsIdx < tsEvents.length - 1 && tsEvents[tsIdx + 1].ticks <= currentTick) tsIdx++;
    const { num, den } = tsEvents[tsIdx];
    const measureTicks = Math.round(num * (4 / den) * tpb);
    const nextTsTick = tsIdx < tsEvents.length - 1 ? tsEvents[tsIdx + 1].ticks : totalTicks + 1;
    const endTick = Math.min(currentTick + measureTicks, nextTsTick);
    const actualTicks = endTick - currentTick;
    measures.push({ startTick: currentTick, endTick, num, den, actualTicks, measureTicks });
    currentTick = endTick;
  }

  const validMeasures = measures.filter((m) => m.actualTicks >= m.measureTicks * 0.1);
  const tickToSec = (tick) => midi.header.ticksToSeconds(tick);

  return validMeasures.map((m) => ({
    startSec: tickToSec(m.startTick),
    endSec: tickToSec(m.endTick),
    ts: `${m.num}/${m.den}`,
  }));
}
