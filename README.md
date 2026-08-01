# RUN CHANGE 부트캠프 PoC

RUN CHANGE 부트캠프 PoC는 8주 러닝 부트캠프 운영을 위해 만든 공개용 로컬 데모입니다. 참가자는 오늘 할 일, 피드, 기록 제출, 나의 변화 화면을 확인하고, 코치는 참가자 상태, 과제/공지 발행, 피드백 승인, 첫 기록 측정 결정을 검토할 수 있습니다.

이 저장소는 제품 검증용 스냅샷입니다. 실제 참가자 데이터, 운영 키, 배포 설정, 비공개 자산은 포함하지 않습니다.

## 주요 기능

- 참가자 데모: 오늘의 과제, 피드, 수동 기록, 스크린샷 기반 기록 초안 검토, 공유 동의 흐름
- 코치 데모: 20명 시드 코호트 상태판, 참가자 상세, 과제/공지 발행, 피드백 승인 큐
- 타임 트라이얼 결정: 1회차 또는 2회차 중 첫 기록 측정 시점을 고르고, 12분/3K/5K 중 하나의 프로토콜을 선택합니다.
- 8주차 재측정: 첫 기록과 동일한 프로토콜로 재측정하도록 미리보기와 변경 확인을 제공합니다.
- 접근성/반응형: 모바일 375px, 태블릿 768px, 데스크톱 1280px 시나리오를 기준으로 테스트합니다.

## 기술 스택

- React 19, TypeScript, Vite
- Vitest, Testing Library, Playwright
- Biome
- Supabase SQL migrations 및 Edge Function 초안
- OpenAI Responses API 연동 계약 초안

## 로컬 실행

필수 런타임은 Node.js 22.22.2 이상 23 미만(22.x)과 pnpm 11.9입니다. 저장소의 `.node-version`에
고정된 Node.js 22.23.2를 사용하면 로컬 실행과 GitHub Pages 워크플로가 같은 런타임을 사용합니다.

```bash
pnpm install
pnpm test
pnpm test:deployment
pnpm typecheck
pnpm lint
pnpm test:e2e
pnpm dev
```

`pnpm test:e2e`는 Pages용 `dist`를 새로 빌드한 뒤 정적 호스트 충실도 서버에서 전체
Playwright 시나리오를 실행합니다. 따라서 앞서 어떤 모드로 빌드했는지에 의존하지 않습니다.

빌드와 미리보기 모드는 다음처럼 짝을 맞춥니다.

```bash
# 기본값: GitHub Pages 경로(/run-change-bootcamp/)용 dist
pnpm build
pnpm preview

# 원점 루트(/)용 .artifacts/local-preview
pnpm build:local
pnpm preview:local
pnpm test:e2e:local
```

개발 중에는 `pnpm dev`가 원점 루트에서 실행됩니다. Pages 정적 호스트의 실제 404 응답까지
확인하려면 `pnpm build` 후 `pnpm serve:pages`를 사용합니다. PR과 배포 워크플로의 현재 상태,
명령 계약, 직접 경로 검증은 [GitHub Pages 배포 문서](docs/github-pages.md)에 정리되어 있습니다.

## 데모 접근

첫 화면에서 참가자 또는 코치 세션을 선택합니다.

- 참가자: 드롭다운에서 시드 참가자를 선택한 뒤 `참가자로 시작`을 누릅니다.
- 코치: `코치로 시작`을 누르면 코치 대시보드로 들어갑니다.
- 데모 상태는 브라우저 `localStorage`에 저장되며, 첫 화면의 초기화 버튼으로 리셋할 수 있습니다.

## 타임 트라이얼 프로토콜

현재 프로그램의 첫 기록 측정은 의도적으로 미정 상태에서 시작합니다. 코치는 다음 두 가지 축을 함께 결정해야 합니다.

- 세션: 1회차 측정 또는 2회차 측정
- 프로토콜: 12분, 3K, 5K

1회차를 선택하면 첫날에 기록을 측정하고 2회차는 회복/러닝 기술 세션으로 둡니다. 2회차를 선택하면 1회차는 오리엔테이션과 적응 세션으로 두고 2회차에 기록을 측정합니다. 어떤 선택이든 8주차에는 같은 프로토콜로 재측정하는 전제로 표시됩니다.

## 데이터, 개인정보, AI 안전

프론트엔드 데모는 시드 데이터와 브라우저 저장소만 사용합니다. 실제 건강정보, 계정, 파일 업로드, 알림 토큰은 포함하지 않습니다.

`supabase/`와 `docs/backend/`에는 운영 백엔드 설계를 위한 SQL/RLS, 저장소, 감사 로그, 동의, AI 초안 처리 계약이 들어 있습니다. OpenAI 연동은 서버 Edge Function에서만 키를 사용하고, `store: false`, 엄격한 JSON 스키마, 비식별 텍스트, 코치/관리자 승인 전 draft-only 저장을 전제로 합니다. 스크린샷은 운영 전 서버 측 OCR/마스킹 검토가 필요합니다.

## 현재 한계

- 이 저장소는 로컬 데모 중심이며 프로덕션 배포를 주장하지 않습니다.
- Supabase 마이그레이션과 Edge Function은 설계/초안 상태입니다. 운영 전 Supabase CLI, Docker, Deno, 인증 토큰 기반 시나리오, 개인정보 영향 검토가 필요합니다.
- AI 결과는 자동 게시되지 않고 코치/관리자 승인 흐름을 전제로 합니다.
- 공개 저장소이므로 비밀키, `.env*`, 실제 참가자 데이터, 내부 운영 문서, 생성 산출물을 커밋하지 마세요.

## 저장소 공개 범위

커밋 대상은 소스, 테스트, 문서, 설정, Supabase 초안입니다. `.omo/`, `.artifacts/`, `dev-dist/`, `dist/`, `node_modules/`, Playwright 리포트, 환경 파일, 토큰, 자격 증명은 Git에서 제외합니다.
