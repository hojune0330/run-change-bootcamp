# 런클럽 구성 · 사용환경 참조 (RUN CHANGE Bootcamp ↔ RunClub Manager)

이 디렉터리는 GitHub 사용자 `hojune0330`의 런클럽 생태계 저장소에서
`run-change-bootcamp`(PLUS Run 부트캠프 PoC) 운영에 참고가 되는 구성과
사용환경을 큐레이션해 옮겨 둔 **참조 아카이브**입니다.

> 정본(source of truth)은 각 원본 저장소에 있습니다. 여기 파일은 스냅샷
> 복사본이며, 원본 위치를 확실히 알 수 있도록 아래 매트릭스에 기록합니다.

## 생태계 저장소 매트릭스 (2026-08-07 기준)

| 저장소 | 공개 | 역할 · 내용 | 로컬 클론 위치 |
|---|---|---|---|
| `hojune0330/run-change-bootcamp` | public | **이 워크스페이스** — PLUS Run 부트캠프 PoC (React 19 + Vite + TS, preview/pilot) | `/home/user/webapp` |
| `hojune0330/runclub` | private | **런클럽매니저** — 런클럽 일정·수강권·출석·링크 전용 이벤트룸·사진/영상 전달 (Next.js 16 + Render + PostgreSQL 16) | `$HOME/sb-git-refs/runclub` |
| `hojune0330/athletetime` | public | 애슬리트 타임 — 대한민국 육상 선수·기록·커뮤니티 플랫폼 (750 commits) | `$HOME/sb-git-refs/athletetime` |
| `hojune0330/TRAINORACLE` | public | TrainOracle — AI 코치 디자인·스펙 핸드오프 저장소 (318 commits, `PRODUCT_NORTH_STAR.md` 우선) | `$HOME/sb-git-refs/TRAINORACLE` |
| `hojune0330/jindo-coach` | private | 진도군청 육상단 Codex 스킬 (행정문서 검토·수정·분석) | `$HOME/sb-git-refs/jindo-coach` |
| `hojune0330/aaclub` | private | AAC Club 계약·운영 문서 및 디자인 자산 아카이브 | `$HOME/sb-git-refs/aaclub` |
| `hojune0330/2026-first-item` | private | 아이오매거진/AthleTime 핸드오프 (작업 완료, prod는 athletetime) | `$HOME/sb-git-refs/2026-first-item` |
| `hojune0330/AT-codex` | public | AthleTime Codex 아카이브 (웹앱 zip) | `$HOME/sb-git-refs/AT-codex` |
| `hojune0330/vite-react-template` | public | Cloudflare Workers(vite plugin) 기반 Vite+React 템플릿 | `$HOME/sb-git-refs/vite-react-template` |
| `hojune0330/athletetime1` | public | 빈(empty) 저장소 (초기 흔적) | `$HOME/sb-git-refs/athletetime1` |

> 모든 원본 저장소는 `gh repo clone hojune0330/<name>`으로 `$HOME/sb-git-refs/`에
> 전체 클론해 두었습니다 (private 포함, 2026-08-07 기준 완료).

## 반입 방식 (본 디렉터리 = 색인만, 원문은 로컬 클론)

> **보안 원칙**: 이 워크스페이스(`run-change-bootcamp`)는 **public** 저장소입니다.
> `hojune0330/runclub` 등 **private 저장소의 운영 문서·env 시크릿 목록·배포
> 절차는 여기에 커밋하지 않습니다.** 원문 파일은 로컬 클론
> `$HOME/sb-git-refs/<repo>`에 보관하고, 여기에는 색인·요약만 둡니다.

| 문서 (원본 위치 `$HOME/sb-git-refs/runclub/`) | 용도 |
|---|---|
| `CLAUDE.md` | 운영·배포 브랜치 정책(`genspark_ai_developer` = 운영, main = FF 미러), UI 정책(shadcn 우선) |
| `DEPLOY.md` + `render.yaml` | Render Blueprint 배포 절차, 시드 토큰 일회성 사용, 환경 변수 체크리스트 |
| `.env.example` | 운영 env 키 구성표 (DB/JWT, 시드 게이트, 구글 시트, Toss, Strava/Garmin, R2/Stream, 미디어 시크릿) |
| `docs/coaching-platform-plan.md` | 코칭 플랫폼 기획 (홈워크·피드백·멤버십) — 부트캠프 기능 로드맵 참조 |
| `docs/solo-run-4-handoff.md` | 링크 전용 이벤트룸 인수인계 (출석·짝 공개·검증/배포) |
| `docs/PASS_MANAGEMENT.md` | 수강권(3개월권) 운영: 발급·취소·결제 환불 구분 |

## runclub 핵심 구성 요약 (Next.js 16 + Render)

- **배포**: Render Blueprint (`render.yaml`) — 웹 서비스 `runclub-manager`(Starter $7/mo) + PostgreSQL `runclub-db`(basic-256mb $7/mo, Singapore). 운영 브랜치 `genspark_ai_developer` watch, autoDeploy.
- **브랜치 정책**: 운영 = `genspark_ai_developer`, `main` = fast-forward 미러 (히스토리 정렬용). "main이 정석 아니냐" 재논의 금지.
- **표준 워크플로우**: `genspark_ai_developer`에서 작업/커밋 → push → Render 자동 재배포 → `main`으로 FF merge → push → 복귀.
- **주요 도메인**: 일정(sessions), 수강권(passes/pass-products, Toss 결제), 출석(attendance, QR), 링크 전용 이벤트룸(solo-run, invite `[code]`), 사진/영상(media, R2+Stream), 홈워크·피드백(homeworks/encouragements), 마일리지, 공지/알림, 구글 시트 동기화.
- **보안**: 시드 엔드포인트는 `ALLOW_SEED` + `SEED_TOKEN` 1회성 게이트, `SEED_MODE=production`은 관리자만 생성. `JWT_SECRET ≥ 32자` 부팅 검사. 보안 헤더(clickjacking/XSS/HTTPS) 전역, 매체 서명(media signing) 키 순환 절차.
- **통합**: Strava(라이브), Garmin/Apple 준비, Google Sheets 관리자 미러, Firebase 푸시, Toss 결제.

## 관련 경험·규칙 (다른 저장소에서 발췌 요약)

- **athletetime**: `WORKFLOW.md`가 개발 플로우·저장소 역사·작업 규칙의 정본. 핸드오프 저장소보다 prod 저장소가 진실 공급원.
- **TRAINORACLE**: `PRODUCT_NORTH_STAR.md`가 최우선 문서 — "기록 보관함이 아니라 AI 코치".
- **jindo-coach**: 실제 선수 자료는 저장하지 않고 재사용 가능한 절차·검증 규칙·자동화 스크립트만 보관 (개인정보 원칙).
- **공통 AI 작업 규칙**: 결정된 브랜치·배포 정책은 재논의하지 않고 지시대로 진행하며, 작업 시작 전 브랜치 질문을 하지 않는다.

## 갱신 방법

새 저장소가 생기거나 구성이 바뀌면:

```bash
gh repo list hojune0330 --limit 100          # 생태계 전수 조사
gh repo clone hojune0330/<name> $HOME/sb-git-refs/<name>
```

그리고 본 README의 매트릭스·문서 색인을 갱신합니다. private 저장소의 원문
파일은 워크스페이스에 복사하지 않고 `$HOME/sb-git-refs/<name>` 경로만
기록합니다 (public 저장소에 private 내용이 커밋되지 않도록).
