import { createContext, useContext } from "react";

/**
 * PlayerContext v1 — 재생 엔진 전역화 (단계 A: 골격)
 *
 * 목적:
 *   재생 엔진(useMidiPlayer / useAccompanistPlayer)을 페이지가 아닌
 *   앱 전역 레벨에서 보유하기 위한 Provider.
 *   페이지 이동 시에도 재생 엔진과 상태가 소멸하지 않도록 한다.
 *
 * 단계 A 현재 상태:
 *   - Provider 골격만 존재. 실제 재생 엔진은 아직 SongDetailPage에 있음.
 *   - 이 단계의 목적은 트리에 Provider를 끼워넣어도 빌드/동작이
 *     깨지지 않는지 확인하는 것.
 *   - 실제 엔진 이동은 단계 B에서 수행.
 */

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // 단계 A: value는 placeholder. 단계 B에서 재생 엔진으로 채운다.
  const value = {
    // (단계 B에서 추가될 예정)
    // ready, playing, currentTime, duration, progress,
    // currentLoop, totalLoops, phase, phaseLabel,
    // play, pause, stop, seekTo, toggleInfiniteLoop, ...
    _stage: "A", // 단계 식별용 임시 플래그 (단계 B에서 제거)
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export default function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer는 PlayerProvider 내부에서만 사용 가능합니다");
  }
  return ctx;
}
