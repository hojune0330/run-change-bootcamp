import { useEffect, useState } from "react"
import { Badge, Button, Card } from "../../components/primitives/index.ts"
import { ACTIVITY_INSIGHT_TEMPLATES } from "../../domain/activity-insight.ts"
import type {
  PilotParticipantActivityInsight as ParticipantActivityInsight,
  PilotGateway,
  PilotOperationError,
} from "../../integrations/supabase/pilot-gateway.ts"
import "./PilotParticipantActivityInsight.css"

type ActivityInsightState =
  | { readonly kind: "empty" }
  | { readonly kind: "error" }
  | { readonly kind: "loading" }
  | { readonly insight: ParticipantActivityInsight; readonly kind: "ready" }
  | { readonly kind: "revoked" }

type PilotParticipantActivityInsightProps = {
  readonly gateway: Pick<PilotGateway, "listParticipantActivityInsights">
  readonly participantProfileId: string
  readonly programId: string
}

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Seoul",
  year: "numeric",
})
const DISTANCE_FORMATTER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 })

class UnexpectedActivityInsightVariantError extends Error {
  readonly name = "UnexpectedActivityInsightVariantError"
}

function assertNever(value: never): never {
  throw new UnexpectedActivityInsightVariantError(
    `Unexpected activity insight variant: ${String(value)}`,
  )
}

function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(`${value}T00:00:00+09:00`))
}

function formatDuration(durationS: number): string {
  const totalSeconds = Math.round(durationS)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`
  if (hours > 0) return `${hours}시간`
  if (minutes > 0) return `${minutes}분`
  return `${seconds}초`
}

function stateForFailure(error: PilotOperationError): ActivityInsightState {
  switch (error.kind) {
    case "deleted":
    case "nonmember":
    case "suspended":
    case "withdrawn":
      return { kind: "revoked" }
    case "aborted":
    case "expired_link":
    case "invalid_request":
    case "invalid_response":
    case "malformed_callback":
    case "network":
    case "provider_error":
    case "replayed_link":
    case "resend_guard":
    case "signed_out":
      return { kind: "error" }
    default:
      return assertNever(error.kind)
  }
}

export function PilotParticipantActivityInsight({
  gateway,
  participantProfileId,
  programId,
}: PilotParticipantActivityInsightProps) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ActivityInsightState>({ kind: "loading" })

  useEffect(() => {
    void revision
    let active = true
    setState({ kind: "loading" })
    void gateway.listParticipantActivityInsights(programId).then((result) => {
      if (!active) return
      switch (result.ok) {
        case false:
          setState(stateForFailure(result.error))
          return
        case true: {
          const insight = result.value.find(
            (candidate) =>
              candidate.participantProfileId === participantProfileId &&
              candidate.programId === programId,
          )
          setState(insight === undefined ? { kind: "empty" } : { insight, kind: "ready" })
          return
        }
        default:
          return assertNever(result)
      }
    })
    return () => {
      active = false
    }
  }, [gateway, participantProfileId, programId, revision])

  switch (state.kind) {
    case "loading":
      return (
        <div className="pilot-activity-insight">
          <Card eyebrow="검토된 활동 기록" title="활동 기록 요약" tone="muted">
            <p aria-live="polite" className="pilot-activity-insight__state">
              내 활동 요약을 확인하고 있어요.
            </p>
          </Card>
        </div>
      )
    case "empty":
      return (
        <div className="pilot-activity-insight">
          <Card eyebrow="검토된 가져오기" title="아직 표시할 요약이 없어요" tone="muted">
            <p className="pilot-activity-insight__state">
              검토된 가져오기 기록이 없어요.
              <br /> 데이터 처리 동의가 철회되면 요약은{" "}
              <span className="pilot-activity-insight__keep-together">표시되지 않아요.</span>
            </p>
          </Card>
        </div>
      )
    case "revoked":
      return (
        <div className="pilot-activity-insight">
          <Card eyebrow="데이터 처리 동의" title="활동 요약이 제거되었어요" tone="muted">
            <p className="pilot-activity-insight__state" role="status">
              동의가 철회되었거나 참여 상태가 바뀌었어요.
              <br /> 이전 활동 요약은 이 화면에 남기지 않아요.
            </p>
          </Card>
        </div>
      )
    case "error":
      return (
        <div className="pilot-activity-insight">
          <Card eyebrow="검토된 활동 기록" title="활동 요약을 불러오지 못했어요" tone="muted">
            <p className="pilot-activity-insight__state" role="alert">
              잠시 후 다시 확인해 주세요. 이전 요약은 화면에 남기지 않아요.
            </p>
            <div className="pilot-activity-insight__retry">
              <Button onClick={() => setRevision((current) => current + 1)} variant="secondary">
                다시 시도
              </Button>
            </div>
          </Card>
        </div>
      )
    case "ready": {
      const { insight } = state
      const content = ACTIVITY_INSIGHT_TEMPLATES[insight.contentVariant]
      return (
        <section aria-label="검토된 주간 활동 요약" className="pilot-activity-insight">
          <Card
            action={<Badge tone="neutral">검토된 가져오기 {insight.sourceCount}건</Badge>}
            eyebrow={insight.isPartialWeek ? "이번 주 · 진행 중" : "주간 활동 · 집계 완료"}
            id="pilot-activity-insight"
            title={content.title}
          >
            <div className="pilot-activity-insight__content">
              <dl className="pilot-activity-insight__provenance">
                <div>
                  <dt>기간</dt>
                  <dd>
                    <time dateTime={insight.weekStart}>{formatDate(insight.weekStart)}</time>
                    <span aria-hidden="true">–</span>
                    <time dateTime={insight.weekEnd}>{formatDate(insight.weekEnd)} 미만</time>
                  </dd>
                </div>
                <div>
                  <dt>기준</dt>
                  <dd>서울 시간 (Asia/Seoul)</dd>
                </div>
              </dl>

              <p className="pilot-activity-insight__summary">{content.summary}</p>

              <ol aria-label="주간 활동 집계" className="pilot-activity-insight__metrics">
                <li>
                  <span>활동일</span>
                  <strong>{insight.activityDays}일</strong>
                  <small>활동 기록이 확인된 날짜 수</small>
                </li>
                <li>
                  <span>총 거리</span>
                  <strong>{DISTANCE_FORMATTER.format(insight.distanceM / 1_000)} km</strong>
                  <small>검토된 기록의 주간 합계</small>
                </li>
                <li>
                  <span>총 시간</span>
                  <strong>{formatDuration(insight.durationS)}</strong>
                  <small>검토된 기록의 주간 합계</small>
                </li>
              </ol>

              <p className="pilot-activity-insight__next-step">{content.nextStep}</p>
              <p className="pilot-activity-insight__disclosure">
                출처는 검토된 가져오기 기록입니다.
                <br /> 계정 동기화 데이터가 아닙니다.
                <br /> 이 요약은 의료 조언이나 건강 상태 판단을{" "}
                <span className="pilot-activity-insight__keep-together">제공하지 않습니다.</span>
              </p>
            </div>
          </Card>
        </section>
      )
    }
    default:
      return assertNever(state)
  }
}
