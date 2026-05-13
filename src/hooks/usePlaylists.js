/**
 * usePlaylists 호환 레이어
 *
 * 이전 버전: 컴포넌트별 독립 useState (race condition 발생)
 * 현재 버전: PlaylistContext에서 단일 인스턴스 사용
 *
 * 기존 import 경로 호환을 위해 re-export만 수행.
 * 새 코드는 ../contexts/PlaylistContext 에서 직접 import 권장.
 */
export { default } from "../contexts/PlaylistContext";
