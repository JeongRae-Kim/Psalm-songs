/**
 * HomeIcon - 시편 찬송 앱 헤더용 홈 버튼 아이콘
 *
 * 디자인: 교회 실루엣 + 지붕 위 십자가 (옵션 B)
 * - 24x24 viewBox 기준
 * - stroke 기반 라인 아이콘
 * - currentColor 로 부모 텍스트 색상 상속
 * - 사용처: 헤더 좌측 "곡 목록으로" 이동 버튼
 *
 * 사용 예시:
 *   <button aria-label="곡 목록으로">
 *     <HomeIcon size={22} />
 *   </button>
 *
 *   // 색상은 부모의 color 또는 className 으로 제어
 *   <HomeIcon size={24} className="text-amber-100" />
 */
import React from "react";

const HomeIcon = ({
  size = 24,
  strokeWidth = 2,
  className = "",
  title = "홈",
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label={title}
    className={className}
    {...rest}
  >
    <title>{title}</title>

    {/* 십자가 - 지붕 위에 얹힘 */}
    <line x1="12" y1="1.5" x2="12" y2="6" />
    <line x1="10" y1="3.25" x2="14" y2="3.25" />

    {/* 교회 본체: 지붕 + 좌우 벽 + 바닥 (단일 path) */}
    <path d="M3 11 L12 6 L21 11 L21 21 L3 21 Z" />

    {/* 아치형 출입문 */}
    <path d="M10 21 L10 17 Q10 14.8 12 14.8 Q14 14.8 14 17 L14 21" />
  </svg>
);

export default HomeIcon;
