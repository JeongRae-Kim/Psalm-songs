# CLAUDE.md

## 프로젝트 개요

**시편 찬송 (psalm-songs)** — 시편/이사야 본문에 곡을 붙여 만든 한국어 찬송곡을
모바일·데스크톱에서 보고 부를 수 있도록 만든 PWA(Progressive Web App).
사용자는 곡 목록에서 검색/필터링하여 원하는 곡을 찾고, 상세 페이지에서 악보(이미지)
또는 가사를 탭으로 전환해 볼 수 있다. 즐겨찾기·최근 본 곡·곡별 메모는 로컬에 저장된다.

### 단계와 목표
- **현재(시범 단계)**: 5곡 수록 (시편 40 / 42:1-5 / 42:6-11 / 90, 이사야 40).
  모두 김준범 편곡(2026).
- **장기 목표**: 약 **600곡** 수록.
- **악보 워크플로**: 현재 작업자가 Finale로 악보를 제작 중이며,
  추후 **MusicXML 기반 파이프라인**으로의 전환을 검토 중이다
  (지금은 PNG/PDF 정적 자산을 직접 서빙).
- **플랫폼**: 현재 React + PWA. 향후 **Flutter 전환** 가능성을 열어두고 있다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | React 19.2 (StrictMode) |
| 빌드 | Vite 8 + `@vitejs/plugin-react` |
| 라우팅 | react-router-dom 7 (`BrowserRouter`) |
| 스타일 | Tailwind CSS 3.4 + CSS 변수 기반 테마 |
| PWA | `vite-plugin-pwa` (autoUpdate, Workbox) |
| 줌/팬 | 자체 구현 (`react-zoom-pan-pinch`는 설치되어 있으나 미사용) |
| 영속화 | `localStorage` (접두사 `psalm-app:`) |
| 린트 | ESLint 10 + react-hooks / react-refresh 플러그인 |

백엔드는 없으며, 데이터는 정적 JSON을 fetch로 읽는다.

## 디렉토리 구조

```
psalm-songs/
├─ public/
│  ├─ songs.json              # ✦ 데이터 소스 (곡 메타데이터 + 가사)
│  ├─ sheets/                 # 곡별 악보 .png / .pdf
│  ├─ icons/                  # PWA 아이콘 (192/512)
│  └─ favicon.svg
├─ src/
│  ├─ main.jsx                # 엔트리, ThemeProvider 주입
│  ├─ App.jsx                 # 라우터 정의
│  ├─ index.css               # Tailwind + 테마 import + 전역 폰트 변수
│  ├─ pages/
│  │   ├─ HomePage.jsx        # 목록 + 검색/필터/정렬
│  │   ├─ SongDetailPage.jsx  # 상세 (악보/가사 탭, 메모, 이전·다음)
│  │   └─ SettingsPage.jsx    # 테마/다크모드/글꼴/글자크기
│  ├─ components/             # SongCard, SearchBar, FilterChips, SortDropdown,
│  │                          # SheetView, LyricsView, MemoEditor, InstallBanner
│  ├─ contexts/ThemeContext.jsx
│  ├─ hooks/                  # useSongs, useFavorites, useRecent, useMemos
│  ├─ themes/themes.css       # minimal/paper/modern × 라이트/다크 (CSS 변수)
│  └─ utils/storage.js        # localStorage 래퍼
├─ vite.config.js             # PWA manifest + Workbox 캐싱 룰
├─ tailwind.config.js         # CSS 변수를 색상 토큰으로 매핑
└─ eslint.config.js
```

**데이터 소스**: `public/songs.json` (현재 빌드에 정적으로 포함). 곡 추가 시 이 파일과
`public/sheets/`의 png/pdf 쌍을 함께 갱신한다.

## 핵심 아키텍처

### 전역 상태 — `ThemeContext`
- `theme` / `darkMode` / `font` / `fontSize`를 관리.
- `<html>`에 `data-theme`, `data-dark` 속성을 주입하고, `--font-family`·`--font-size`
  CSS 변수를 설정. 모든 색상은 Tailwind 토큰(`bg-page`, `text-t-primary` 등)이 CSS
  변수에 매핑되는 구조라 테마 추가/수정은 `themes/themes.css`만 손대면 된다.
- `darkMode === "auto"`일 때는 `prefers-color-scheme` 미디어 쿼리를 구독한다.

### 영속화 — `localStorage`
- 모든 키에 `psalm-app:` 접두사. JSON으로 직렬화하며 try/catch로 안전하게 폴백.
- 저장 키: `theme`, `darkMode`, `font`, `fontSize`, `favorites`(배열), `recent`(최대 10),
  `memos`(`{ [songId]: text }`).

### 라우팅 — `BrowserRouter`
- `/` → `HomePage`
- `/song/:id` → `SongDetailPage` (진입 시 자동으로 최근 본 곡에 추가)
- `/settings` → `SettingsPage`
- 전역 하단에 `InstallBanner` 항상 마운트 (PWA 설치 유도).

### PWA / 캐싱 — Workbox
- precache: `**/*.{js,css,html,png,pdf,json,svg}`.
- runtime: `.png`·`.pdf`는 `CacheFirst`(`sheets-cache`, 50개·30일).
- `registerType: 'autoUpdate'` — 새 빌드 배포 시 자동 갱신.

## 코딩 컨벤션

- **언어**: JavaScript + JSX (TypeScript 미도입). 컴포넌트는 `.jsx`, 훅·유틸은 `.js`.
- **컴포넌트**: 함수형 + 훅. `export default` 단일 컴포넌트 1파일 1개.
- **스타일링**: Tailwind 유틸리티 우선. 색상은 직접 색을 쓰지 말고 의미론적 토큰
  (`bg-card`, `text-t-secondary`, `border-b-light`, `bg-accent` 등)을 사용.
  복잡한 레이아웃·애니메이션은 인라인 `style`로 작성한 곳도 있다(`SongDetailPage`,
  `SheetView`).
- **상태 저장**: 로컬 영속화는 반드시 `utils/storage.js`의 `getItem`/`setItem` 경유.
  훅 내부에서 `useState` 초기값을 `getItem`으로, 변경 시 `setItem`으로 동기화하는
  패턴을 그대로 따른다.
- **데이터 페칭**: `useSongs`가 단일 진입점. 다른 컴포넌트는 `songs.json`을 직접
  fetch하지 않는다.
- **UI 언어**: 모든 사용자 노출 문자열은 한국어.
- **모바일 우선**: `max-w-3xl mx-auto`로 가운데 정렬, `overscroll-behavior: none`으로
  바운스 차단. 터치 제스처(핀치/더블탭)는 `SheetView`에 캡슐화.

## 빌드/실행 명령

```bash
npm run dev       # Vite 개발 서버 (HMR)
npm run build     # 프로덕션 빌드 (PWA 매니페스트·서비스워커 포함)
npm run preview   # 빌드 결과물 로컬 프리뷰
npm run lint      # ESLint
```

## 향후 계획 및 주의사항

- **600곡 확장 시 데이터 구조 재검토 필요**.
  현재 `songs.json`을 한 번에 fetch해 메모리에 올리는 구조는 5곡 규모 기준이며,
  600곡 규모에서는 다음을 고려해야 한다:
  - 인덱스(요약)와 본문(가사·악보 메타) 분리 로딩
  - 검색 인덱스 사전 생성, 필요 시 lunr 등 도입
  - 페이지네이션 또는 가상 스크롤
  - 즐겨찾기/최근/메모 키가 `songId` 기반이므로, ID 네이밍 규칙을 미리 확정해야
    이후 마이그레이션 비용을 줄일 수 있음.
- **MusicXML 도입 검토 중**.
  Finale → MusicXML 익스포트를 거쳐 웹에서 렌더링(예: OpenSheetMusicDisplay,
  Verovio)하는 파이프라인을 검토 중. 도입 시 `sheetImage`/`sheetPdf` 경로 외에
  `sheetXml` 같은 필드 추가와 `SheetView`의 렌더러 분기가 필요하다.
  PNG/PDF 자산은 폴백으로 당분간 유지될 가능성이 높다.
- **Flutter 전환 가능성**.
  현재 React/PWA로 구현되어 있으나 장기적으로 Flutter 네이티브 앱으로의 전환을
  열어두고 있다. 새 기능을 React 전용 API에 깊게 결합시키지 말고, 데이터 모델
  (`songs.json` 스키마)과 비즈니스 로직(즐겨찾기·메모 규칙 등)은 가능한 한
  플랫폼 중립적으로 유지한다.
- **악보 자산 캐시**: Workbox가 `.png/.pdf`를 CacheFirst로 캐싱하므로, 같은 파일명
  으로 악보를 교체하면 사용자에게 즉시 반영되지 않을 수 있다. 곡을 갱신할 때는
  파일명 변경(또는 쿼리스트링)을 고려.
