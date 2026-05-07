# 시편 찬송 앱 아이콘 스타일 가이드

홈 버튼(`HomeIcon.jsx`)과 동일한 시각 언어로 다른 헤더 아이콘들을 작업하기 위한 공통 규칙입니다. 다음 작업(설정/즐겨찾기/전체화면)에 그대로 적용해 주세요.

## 디자인 토큰

| 항목 | 값 | 비고 |
|---|---|---|
| viewBox | `0 0 24 24` | 모든 아이콘 공통 |
| 표시 크기 | `22px` (헤더), `24px` (일반) | `size` prop 으로 조절 |
| `fill` | `"none"` | 라인 아이콘이므로 채움 없음 |
| `stroke` | `"currentColor"` | 부모의 `color` 상속 |
| `stroke-width` | `2` (기본), `1.75` (어두운 배경 시 가독성 향상 옵션) | 한 화면 내 아이콘끼리는 같은 값 |
| `stroke-linecap` | `"round"` | 끝단 둥글게 |
| `stroke-linejoin` | `"round"` | 모서리 둥글게 |

## 컴포넌트 시그니처 (공통)

```jsx
const XxxIcon = ({ size = 24, strokeWidth = 2, className = "", title = "...", ...rest }) => ( ... );
export default XxxIcon;
```

- `title` prop 으로 `<title>` 태그를 채워 스크린리더 접근성 확보
- `aria-label` 은 `<button>` 쪽에 두는 것을 권장 (아이콘 자체는 `role="img"`)

## 안전 영역 (Padding)

24x24 viewBox 에서 실제 그래픽은 **3~21 사이**에 그리는 것을 권장합니다. 현재 `HomeIcon` 도 십자가 끝(y=1.5)을 제외하면 모두 이 범위 안에 있습니다.

## 다음 단계 - 권장 아이콘 디자인

같은 분위기를 유지하면서 만들 수 있는 동반 아이콘 제안:

### 1. 즐겨찾기 (FavoriteIcon)
- 단순 별 또는 하트 윤곽선
- 활성 상태는 `fill="currentColor"` 토글로 처리
- 예: `<path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z" />`

### 2. 설정 (SettingsIcon)
- 톱니바퀴 또는 슬라이더 아이콘
- 톱니바퀴는 복잡하므로 슬라이더(가로선 3개 + 점) 추천
- 예: 세 줄의 `<line>` + 각 줄 위에 `<circle r="1.5">`

### 3. 전체화면 (FullscreenIcon)
- 네 모서리 꺾쇠 (Material Design `fullscreen` 스타일)
- 예: `<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />`

### 4. 곡 목록 (PlaylistIcon, 보조)
- 가로선 3~4개 (햄버거 메뉴와 차별화 위해 마지막 줄을 짧게 또는 점 추가)

## 파일 구조 권장

```
시편 앱 작성/
├─ icons/
│   ├─ HomeIcon.jsx         ← 이번 작업
│   ├─ FavoriteIcon.jsx     ← 다음 단계
│   ├─ SettingsIcon.jsx     ← 다음 단계
│   ├─ FullscreenIcon.jsx   ← 다음 단계
│   └─ index.js             ← 통합 export
└─ ...
```

`icons/index.js` 예시:
```js
export { default as HomeIcon } from "./HomeIcon";
export { default as FavoriteIcon } from "./FavoriteIcon";
export { default as SettingsIcon } from "./SettingsIcon";
export { default as FullscreenIcon } from "./FullscreenIcon";
```

사용처:
```jsx
import { HomeIcon, SettingsIcon } from "./icons";
```

## 시각 검증 체크리스트

새 아이콘을 만든 뒤 아래를 확인해 주세요.

- [ ] 22px 헤더 크기에서 디테일이 뭉개지지 않는가
- [ ] 어두운 배경(`#4a3322`)에서 충분히 보이는가
- [ ] 다른 아이콘들과 시각적 무게감(굵기, 여백)이 비슷한가
- [ ] `currentColor` 가 잘 작동하는가 (부모 색상 변경 테스트)
- [ ] 키보드 포커스 시 윤곽선이 보이는가 (버튼 쪽 스타일)

## 진행 상태

- [x] HomeIcon (옵션 B - 교회 + 십자가)
- [ ] FavoriteIcon
- [ ] SettingsIcon
- [ ] FullscreenIcon
- [ ] icons/index.js 통합

다음에 작업할 때 어떤 아이콘부터 만들지 알려주시면 같은 톤으로 이어가겠습니다.
