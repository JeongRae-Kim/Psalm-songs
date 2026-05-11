/**
 * audioContext.js
 * 전역 AudioContext 싱글턴 — iOS Safari 호환
 *
 * iOS Safari는 AudioContext.resume()을 반드시 사용자 터치/클릭
 * 이벤트 핸들러 안에서 호출해야 합니다.
 * 이 모듈은 첫 번째 사용자 제스처에서 AudioContext를 생성+resume하고,
 * 이후 모든 플레이어 훅이 동일한 ctx를 공유합니다.
 */

let _ctx = null;
let _resumePromise = null;

/**
 * AudioContext를 반환합니다.
 * 아직 생성되지 않았으면 생성하고 resume을 시도합니다.
 * 반드시 사용자 제스처(click/touchend) 핸들러 안에서 호출하세요.
 */
export function getAudioContext() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // iOS에서 suspended 상태면 resume (사용자 제스처 내에서 호출되어야 유효)
  if (_ctx.state === "suspended") {
    if (!_resumePromise) {
      _resumePromise = _ctx.resume().then(() => {
        _resumePromise = null;
      });
    }
  }
  return _ctx;
}

/**
 * AudioContext가 ready 상태인지 확인하고, 아니면 resume을 기다립니다.
 */
export async function ensureAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}
