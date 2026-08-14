# PLUS Run 파일럿 배선 로드맵

## 현재 기준선 (2026-08-14)

- 공개 프리뷰는 배포된 `main` source `51cc142`와 성공한 Pages run `31398439150`을 기준으로 합니다. 현재 작업 브랜치는 미공개 로컬 브랜치이며 공개 프리뷰에 포함되지 않습니다.
- 참여자 슬라이스와 관리자 슬라이스는 완료되었습니다.
- 활동 파일 가져오기·초안 처리는 부분 완료이며, 추출/운영 자동화는 남아 있습니다.
- Garmin/FIT 연동과 호스팅 Supabase·실제 계정/데이터를 사용하는 운영은 보류되었습니다.

## 왜 파일럿인가

데모(preview)는 localStorage 기반(zod 검증)이라 건강 데이터(심박수·체중·통증 등)의
운영 안전성 — RLS, 감사(audit), 동의(consent) — 을 검증할 수 없습니다.

파일럿은 실제 Supabase 스키마 + RLS + 감사 트리거 + security-definer RPC 위에서
동작을 검증하여 POC → 프로덕션 이관 근거를 확보합니다.

### 파일럿 원칙

1. **프런트는 테이블을 직접 SELECT/조작하지 않는다.** 모든 읽기는 RPC 1회 왕복,
   쓰기도 RPC(권한·감사 필요) 또는 RLS로 안전하게 열린 좁은 표면(narrow surface)만 사용.
2. **건강(raw) 값은 스냅샷에 최소화.** 코치 화면에는 타임스탬프/카운트만 노출하고,
   값이 필요한 곳은 명시적 동의가 있을 때만 포함.
3. **스네이크(SQL) → 캐멀(프런트) 매핑은 게이트웨이 한 곳에서.**
4. **클라이언트는 본인 확인(identity)·프로그램을 주입하지 못한다.** 게이트웨이가
   인증 세션에서 파생하고, zod strict로 요청을 검증.
5. **구현 불가한 흐름은 정직한 오류로 경계를 표시**하고 데모와 섞지 않는다.

### 슬라이스 단위 진행

역할 1개 × 화면 묶음을 "완결된 세로 슬라이스"로 처리합니다.

| 단계 | 내용 |
| --- | --- |
| 1 | SQL 마이그레이션(RPC + 스키마) |
| 2 | 파일럿 클라이언트 계약 확장(`pilot-client.ts`) |
| 3 | 브라우저 클라이언트(`browser-client.ts`) |
| 4 | 게이트웨이(zod 스키마 + 매핑 + 메서드) |
| 5 | 워크스페이스 + 라우팅(`PilotAuthShell`) |
| 6 | 테스트 + typecheck/lint/test:unit |
| 7 | main 커밋 + push + 링크 |

---

## 완료 — Phase 1: 코치 대시보드 (커밋 `cf8168e`)

- SQL: `coach_dashboard_snapshot(uuid)`, `coach_participant_detail_snapshot(uuid, uuid)`,
  `announcements.pinned` 추가 — `202608050001_coach_dashboard_snapshot.sql`
- 계약: `PilotRpcRequest` union 4종, `PilotDataRequest` write 3종
- 게이트웨이: 타입 ~15종, zod 스키마 9종, 메서드 6종
- 프런트: `pilot-coach-models.ts`, `PilotCoachWorkspace.tsx`, role=coach 라우팅
- 테스트 8건 추가 (51파일 / 357건 통과)

---

## 완료 — Phase 2: 참여자 슬라이스 (본 문서의 상세 설계)

### 2.1 범위

참여자 화면 4종을 실제 RPC/RLS로 배선합니다.

| 화면 | 라우트 | 실제 배선 | 경계(파일럿 밖, 정직한 오류) |
| --- | --- | --- | --- |
| 오늘 | `/today` | 과제 조회 + 완료 처리 | — |
| 함께 | `/feed` | 피드 조회 + 하트/댓글 | 공유는 클라이언트(Web Share/복사) |
| 기록 | `/record` | 수동 입력 저장 | 파일/스크린샷 초안(엣지 함수 필요) |
| 내 변화 | `/change` | 내 지표/피드백/동의 상태 + 심박수 공유 동의 토글 | AI 피드백 |

### 2.2 SQL — `202608050002_participant_snapshot.sql`

**스키마 확장**(기존 `metric_records` 체크 제약 재정의):
- `metric_type`에 `'sleep_hours'` 추가, `unit`에 `'h'` 추가
  (데모 수동 입력 `sleep_hours`를 수용)

**RPC 4종** (모두 `security definer`, `set search_path=''`, participant 권한 게이트,
`private.record_audit`):

1. `participant_today_snapshot(target_program uuid) → jsonb`
   - 본인 프로필/프로그램 타이틀, 최신 발행 과제(+본인 완료 여부), 최신 발행 공지(+pinned)
2. `participant_feed_snapshot(target_program uuid) → jsonb`
   - 본인 프로그램 `visibility='cohort'` 피드: 글·작성자·하트 수·본인 하트 여부·댓글
3. `participant_change_snapshot(target_program uuid) → jsonb`
   - 본인 지표(유형별 최신 값 + 14일/이전 14일 카운트), 발행 피드백,
     심박수 동의 상태(`heart_rate_bpm_consented`), 동의 이력(감사)
4. `participant_set_metric_consent(target_program uuid, target_enabled boolean) → jsonb`
   - 본인 최신 `heart_rate_bpm` 레코드에 프로그램 **코치 전원**에게 명시적 동의 부여/철회
     (동의는 레코드 단위이므로, 파이럿에서는 유형 단위 토글을 레코드 단위로 매핑)
   - 심박수 레코드가 없으면 `{status:'unavailable'}` 반환 → 게이트웨이가 사용자 메시지로 변환
   - 부여: `insert ... on conflict (metric_record_id, grantee_profile_id) do nothing`
   - 철회: 해당 레코드×코치의 미철회 동의 `revoked_at = now()` 갱신
   - 감사는 기존 `metric_consents_audit` 트리거(`consent.granted`/`consent.revoked`)가 기록

**권한**: 각 RPC `revoke all ... from public, anon; grant execute ... to authenticated;`

### 2.3 계약 확장 — `pilot-client.ts`

- `PilotRpcRequest` union에 4종 추가
  (`participant_today_snapshot` | `participant_feed_snapshot` |
  `participant_change_snapshot` | `participant_set_metric_consent`)
- `PilotDataRequest` write 5종 추가 (모두 RLS로 안전한 좁은 쓰기):
  - `complete_assignment` — `homework_submissions` insert(본인, submitted)
  - `heart_post` — `feed_reactions` insert
  - `unheart_post` — `feed_reactions` delete(본인)
  - `add_feed_comment` — `feed_comments` insert(본인)
  - `save_manual_metric` — `metric_records` insert(본인, source='manual')

### 2.4 게이트웨이 — `pilot-gateway.ts`

- 타입: `PilotParticipantToday`, `PilotParticipantFeed`(+`PilotFeedPost`),
  `PilotParticipantChange`(+지표/피드백/동의 이력), `PilotConsentState`
- zod strict 스키마: 스냅샷 3종 + 입력 4종(과제 완료/하트/댓글/수동 지표/동의 토글)
- 메서드 9종:
  `getParticipantToday`, `getParticipantFeed`, `getParticipantChange`,
  `completeAssignment`, `setPostHeart`(hearted로 insert/delete 분기),
  `addPostComment`, `saveManualMetric`(km·분·bpm·시간 → DB 단위 m·s·bpm·h 변환),
  `changeMetricConsent`
- `createShareServices`는 데모의 순수 함수를 재사용(상태 비접촉)

### 2.5 프런트 — `pilot-participant-models.ts` + `PilotParticipantWorkspace.tsx`

- 매핑: 스냅샷 → `TodayViewModel`/`FeedViewModel`/`MyChangeViewModel` (id 프리픽스
  `assignment-`/`post-`/`comment-`/`feedback-`/`consent-`/`audit-`는 기존 타입과 일치)
- 값 포맷(거리·시간·페이스·심박수)은 `pilot-coach-models.ts`의 `metricLabel`/`metricValue`를
  export하여 재사용
- 워크스페이스: 라우트별 화면 `Loadable` 상태, 상호작용 후 `ActionResult`/`DraftResult`/
  `ConsentChangeResult` 계약 유지, AppShell `mode="participant"`
- `PilotAuthShell`: `role === "participant"` early return 추가
- 기록 화면의 `recordedOn`/`supportedExtensions`는 로컬 계산(민감 데이터 아님)

### 2.6 실패 처리 (정직한 경계)

- 파일/스크린샷 초안: `DraftResult { kind: "error", message: "파일 가져오기는 파일럿 준비 중이에요." }`
- 동의 토글 시 심박수 레코드 없음: `ConsentChangeResult { kind: "error", message: ... }`
- 비인증/비참여자: 게이트웨이/RPC에서 거부(42501), 기존 오류 메시지 표시

### 2.7 테스트

- `pilot-gateway.test.ts`: 스냅샷 3종 매핑, 쓰기 직렬화(과제/하트/댓글/수동 지표의 단위 변환),
  동의 토글 RPC 인자, 비인증 거부 — 신규 8건 내외
- `App.runtime.test.tsx`: `createGateway()` mock에 신규 메서드 9종 추가

### 2.8 검증

`pnpm typecheck` · `pnpm lint` · `pnpm test:unit` 전체 통과 후 main 커밋 + push + 링크.

---

## 완료 — Phase 3: 관리자 슬라이스

- `/admin/overview`(KPI)·`/admin/reports`(운영 보고)·`/admin/people`(멤버십 관리)를
  실제 RPC로 배선. `admin_*` 스냅샷 RPC + 감사 중심.
- 파일럿 초대/멤버십 생명주기 화면.

## 부분 완료 — Phase 4: 활동 가져오기·초안 및 운영·이해관계자

- 파일/스크린샷 초안 → 데이터 업로드 + 엣지 함수(추출) 배선
- AI 피드백 대기열 자동화, 푸시 알림(웹 푸시), 주간 리포트 생성.

## 보류 — Garmin/FIT 및 호스팅 운영

- Garmin/FIT 연결·가져오기와 호스팅 Supabase, 실제 계정·참가자 데이터 기반 운영은 아직 활성화하지 않습니다.
