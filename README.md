# PLUS Run 부트캠프 PoC

PLUS Run 부트캠프 PoC는 8주 러닝 부트캠프 운영을 위해 만든 공개용 시드 데모입니다. 참가자는 오늘 할 일, 피드, 기록 제출, 나의 변화 화면을 확인하고, 코치는 참가자 상태, 과제/공지 발행, 피드백 승인, 첫 기록 측정 결정을 검토할 수 있습니다.

이 저장소는 제품 검증용 스냅샷입니다. 공개 상태와 데이터 경계는 아래 공개 시드 프리뷰 및 데이터·개인정보·AI 안전 섹션을 기준으로 합니다.

## 2026-08-15 현재 기준선

- 클라이언트 보고 범위와 데모 순서는 [PLUS Run 클라이언트 보고용 POC](docs/PLUS-RUN-POC-REPORT.md)에 정리했습니다.
- 공개 프리뷰의 기준선은 배포된 `main`입니다. 현재 통합 브랜치의 변경 사항은 아직 Pages에 배포되지 않았습니다. Node.js `v22.23.2`와 pnpm `11.9.0`에서 typecheck, unit/integration/deployment 테스트, lint, build, 전체 브라우저 gate를 통과했으며, PostgreSQL 17.10 보안 gate는 로컬 `psql` 런타임 부재로 필수 PR CI에서 확인합니다.
- 공개 프리뷰는 배포된 `main`의 source SHA [`51cc142`](https://github.com/hojune0330/run-change-bootcamp/commit/51cc142ea8174ec4e8a9f488f607549ec52d3d35)에서 생성되었고, [Pages 배포 run 31398439150](https://github.com/hojune0330/run-change-bootcamp/actions/runs/31398439150)가 성공했습니다.
- 호스팅 Supabase와 실제 계정·데이터는 연결하지 않았으며, 운영 승인 전 실제 직원 초대를 활성화하지 않습니다.

## V3 공개 상태: PLUS Run POC 공개 프리뷰

- `V3`는 이 저장소의 현재 공개 시드 프리뷰 문서 상태를 뜻하며, `T9 프로덕션 파일럿`(실제 운영 데이터와 서비스를 연결하는 후속 단계)과는 별도입니다.
- 공개 POC 프리뷰: <https://hojune0330.github.io/run-change-bootcamp/>
- 현재 공개 source: [`51cc142`](https://github.com/hojune0330/run-change-bootcamp/commit/51cc142ea8174ec4e8a9f488f607549ec52d3d35) (full SHA `51cc142ea8174ec4e8a9f488f607549ec52d3d35`) · [배포 기록](https://github.com/hojune0330/run-change-bootcamp/actions/runs/31398439150)
- 위 공개 프리뷰에는 배포된 `main`만 반영되며, 현재 통합 브랜치의 변경 사항은 아직 포함되지 않습니다.
- 배포 기록과 직접 경로의 HTTP 404/SPA 동작은 [GitHub Pages 배포 문서](docs/github-pages.md)에서 확인할 수 있습니다.
- 공개 URL은 운영 계정이나 배포된 백엔드와 연결되지 않은 브라우저 로컬 프리뷰입니다. 입력값·파일 처리·리셋 범위는 아래 데이터·개인정보·AI 안전 섹션에 정리합니다.

## 검증·준비 상태의 표현

| 표현 | 이 저장소에서 뜻하는 범위 | 현재 상태 |
|---|---|---|
| 정적 계약 확인(static contract checked) | 타입, 단위/통합 테스트, SQL/RLS 계약을 로컬에서 검사 | Node 22.23.2/pnpm 11.9.0에서 typecheck·unit/integration/deployment·lint·build·전체 브라우저 gate 통과; PostgreSQL 17.10 보안은 필수 PR CI |
| 로컬 런타임(local runtime) | Node 22 브라우저 프리뷰와 PostgreSQL 17.10 보안 시나리오를 로컬 프로세스로 실행 | Node 22.23.2/pnpm 11.9.0 브라우저 gate 통과; PostgreSQL 17.10 보안은 로컬 `psql` 부재로 PR CI에서 확인 |
| 호스팅 프리뷰(hosted preview) | GitHub Pages의 공개 POC 데모 | 배포된 `main` source `51cc142` · Pages run 31398439150; 통합 브랜치는 미배포 |
| 파일럿 준비(pilot ready) | 호스팅 Supabase, 실제 인증 설정, 마이그레이션/RLS, 운영 계정 시나리오까지 검증 | 호스팅·실제 계정·운영 데이터는 아직 미검증 |

공개 `main`/기존 POC 기록은 파일럿 모드의 설정 차단, 초대 전용 이메일 로그인, 역할 라우팅,
로그아웃, 세션 무효화와 동의·감사 데이터 게이트웨이 계약의 확인 범위를 담습니다. 현재
통합 브랜치에서는 위 Node/type/test/lint/build/브라우저 gate를 통과했지만, PostgreSQL 17.10
보안 gate는 필수 PR CI에서 확인해야 합니다. 이는 실제 자격 증명·이메일 전달이나 호스팅
Supabase를 검증했다는 뜻이 아닙니다. 파일럿 화면에는 운영 데이터 연결이 준비 단계라고 명시합니다.

## 주요 기능

- 참가자 데모: 오늘의 과제, 피드, 수동 기록, 스크린샷 기반 기록 초안 검토, 공유 동의 흐름
- 코치 데모: 20명 시드 코호트 상태판, 참가자 상세, 과제/공지 발행, 피드백 승인 큐
- 타임 트라이얼 결정: 1회차 또는 2회차 중 첫 기록 측정 시점을 고르고, 12분/3K/5K 중 하나의 프로토콜을 선택합니다.
- 8주차 재측정: 첫 기록과 동일한 프로토콜로 재측정하도록 미리보기와 변경 확인을 제공합니다.
- 접근성/반응형: 모바일 375px, 태블릿 768px, 데스크톱 1280px 시나리오를 기준으로 테스트합니다.

## 아키텍처와 기술 스택

- React 19, TypeScript, Vite
- Vitest, Testing Library, Playwright
- Biome
- 공개 프리뷰의 저장·처리 경계는 아래 데이터·개인정보·AI 안전 섹션을 기준으로 합니다.
- Supabase SQL migrations 및 Edge Function 초안
- 공개 URL/공개 키만 받는 Supabase 브라우저 클라이언트와 파일럿 인증 경계
- OpenAI Responses API 연동 계약 초안

## 로컬 실행

필수 런타임은 `package.json`의 엔진 범위인 Node.js `>=22.22.2 <23`(22.x)와 pnpm 11.9입니다.
`.node-version`은 Node.js 22.23.2를 선언하는 파일이며, 모든 셸에서 자동으로 버전을 바꾸지는
않습니다. 로컬에서는 mise, asdf, nvm 또는 동등한 버전 매니저로 이 파일의 버전을 먼저
활성화하세요. GitHub Pages 워크플로는 `actions/setup-node`의 `node-version-file: .node-version`
으로 같은 22.23.2를 명시적으로 사용합니다.

설치와 테스트 전에 다음처럼 런타임을 확인합니다. 두 Node 명령 모두 `v22.23.2`를 출력해야
하며, 다른 버전이면 버전 매니저를 먼저 활성화하고 다시 확인하세요.

```bash
node --version             # v22.23.2
pnpm --version             # 11.9.0
pnpm exec node --version   # v22.23.2
```

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

## 런타임 모드와 공개 설정

`VITE_APP_RUNTIME`은 `preview` 또는 `pilot`만 허용하며, 생략하면 `preview`입니다. 프리뷰는 기존
`DemoRepository`와 `localStorage` 흐름을 그대로 사용합니다. 파일럿은 데모 저장소를 만들거나
읽지 않습니다. 파일럿을 명시했는데 공개 설정이 없거나 잘못되면 로그인 화면 대신 한국어
설정 차단 화면만 표시합니다.

```bash
# 기본 프리뷰
VITE_APP_RUNTIME=preview

# 파일럿 브라우저 경계: 둘 다 공개 가능한 값이어야 함
VITE_APP_RUNTIME=pilot
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

레거시 공개 anon 키는 `VITE_SUPABASE_ANON_KEY`로 대신 줄 수 있지만 두 공개 키 변수를 동시에
설정하면 모호한 설정으로 차단합니다. `.env.example`에는 권장 publishable 키만 예시로 둡니다.
서비스 역할 키, OpenAI 키, VAPID 비공개 키는 서버 전용이며 브라우저 빌드 설정에 넣지 않습니다.

## 데모 접근

공개 URL 또는 로컬 실행 주소를 열고 첫 화면에서 참가자 또는 코치 세션을 선택합니다.

- 참여자: 드롭다운에서 시드 참여자를 선택한 뒤 `참여자로 시작`을 누릅니다.
- 코치: `코치로 시작`을 누르면 코치 대시보드로 들어갑니다.
- 데모 상태는 브라우저 `localStorage`에 저장되며, 첫 화면의 `데모 안전 초기화` 버튼으로 시드 상태에 되돌릴 수 있습니다.

## 타임 트라이얼 프로토콜

현재 프로그램의 첫 기록 측정은 의도적으로 미정 상태에서 시작합니다. 코치는 다음 두 가지 축을 함께 결정해야 합니다.

- 세션: 1회차 측정 또는 2회차 측정
- 프로토콜: 12분, 3K, 5K

1회차를 선택하면 첫날에 기록을 측정하고 2회차는 회복/러닝 기술 세션으로 둡니다. 2회차를 선택하면 1회차는 오리엔테이션과 적응 세션으로 두고 2회차에 기록을 측정합니다. 어떤 선택이든 8주차에는 같은 프로토콜로 재측정하는 전제로 표시됩니다.

## 데이터, 개인정보, AI 안전

프론트엔드 데모는 시드 상태에서 시작하지만, 참여자는 수동 건강값을 입력하고 지원되는 활동
파일이나 스크린샷을 선택할 수 있습니다. 입력값, 파일 내용 처리, 초안 추출은 브라우저 안에서만
이루어지며 이 공개 프리뷰에서 파일은 서버로 업로드되지 않습니다. 수동·파생 값, 선택한 파일명,
데모 상태는 브라우저 `localStorage`에 저장되고 첫 화면의 `데모 안전 초기화` 버튼을 누르거나
브라우저 저장소를 지울 때까지 유지됩니다. 공개 프리뷰에는 실제 개인·건강정보를 입력하거나
실제 파일을 선택하지 마세요.

기본 공개 프리뷰는 Supabase Auth, Database, Storage, Realtime, Edge Functions,
notification/OCR/OpenAI 운영 시크릿, 실제 참가자 데이터와 연결되지 않습니다. 파일럿 모드는
공개 URL과 공개 키가 유효할 때에만 Supabase Auth 세션 확인, 등록 이메일 OTP 요청, 로그아웃을
사용합니다. 운영 참여자·코치 데이터 UI는 연결하지 않았습니다.

`supabase/`와 `docs/backend/`에는 운영 백엔드 설계를 위한 SQL/RLS, 저장소, 감사 로그, 동의, AI 초안 처리 계약이 들어 있습니다. OpenAI 연동은 서버 Edge Function에서만 키를 사용하고, `store: false`, 엄격한 JSON 스키마, 비식별 텍스트, 코치/관리자 승인 전 draft-only 저장을 전제로 합니다. 스크린샷은 운영 전 서버 측 OCR/마스킹 검토가 필요합니다.

## 현재 한계

- T9 첫 경계는 브라우저 파일럿의 설정·인증·동의/감사 계약까지만 구현합니다. 호스팅 프로젝트,
  실제 계정, 이메일 템플릿/OTP 전달, 운영 데이터 UI는 검증하지 않았습니다.
- 파일럿 준비 판정에는 Supabase Auth, Database, Storage, Realtime, Edge Functions와
  notification/OCR/OpenAI 서버 운영 시크릿, 인증 토큰 기반 역할별 시나리오, 개인정보 영향
  검토가 필요합니다. 현재 Supabase 마이그레이션과 Edge Function은 설계/초안 상태입니다.
- AI 결과는 자동 게시되지 않고 코치/관리자 승인 흐름을 전제로 합니다.
- 공개 저장소이므로 비밀키, 실제/로컬 환경 파일(`.env`, `.env.local`, `.env.*.local` 등), 실제 참가자 데이터, 내부 운영 문서, 생성 산출물을 커밋하지 마세요. 저장소에 커밋된 안전한 템플릿 `.env.example`은 문서용으로 허용합니다.

## 저장소 공개 범위

커밋 대상은 소스, 테스트, 문서, 설정, Supabase 초안입니다. `.omo/`, `.artifacts/`, `dev-dist/`, `dist/`, `node_modules/`, Playwright 리포트, 환경 파일, 토큰, 자격 증명은 Git에서 제외합니다.
