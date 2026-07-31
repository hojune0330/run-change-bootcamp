import { Badge, type BadgeTone, Card } from "../../components/primitives/index.ts"
import type { ParticipantDetailViewModel } from "./types.ts"
import "./coach-detail.css"
import "./coach-participants.css"

export type ParticipantDetailProps = {
  readonly participant?: ParticipantDetailViewModel
}

function assertNeverMetric(metric: never): never {
  throw new TypeError(`처리할 수 없는 공유 항목: ${String(metric)}`)
}

export function ParticipantDetail({ participant }: ParticipantDetailProps) {
  if (participant === undefined) {
    return (
      <aside aria-label="참가자 상세" className="coach-detail coach-empty">
        <p role="status">참가자를 선택하면 공유 범위와 기록을 볼 수 있습니다.</p>
      </aside>
    )
  }

  return (
    <aside aria-label={`${participant.name} 상세`} className="coach-detail">
      <Card eyebrow={participant.cohortLabel} title={participant.name}>
        <dl className="coach-detail__identity">
          <div>
            <dt>연락처</dt>
            <dd className="coach-detail__contact">{participant.contactLabel}</dd>
          </div>
          <div>
            <dt>코치 메모</dt>
            <dd className="coach-detail__note">{participant.coachNote}</dd>
          </div>
        </dl>

        <section aria-labelledby="stakeholder-scope-title" className="coach-detail__section">
          <div className="coach-detail__section-heading">
            <h3 id="stakeholder-scope-title">관계자 공유 범위</h3>
            <Badge tone="neutral">항목별 동의</Badge>
          </div>
          <p className="coach-detail__helper">
            철회된 항목은 값 대신 상태만 표시하며 감사 기록은 유지합니다.
          </p>
          <ul className="coach-consent-list">
            {participant.stakeholderMetrics.map((metric) => {
              switch (metric.kind) {
                case "shared":
                  return (
                    <li key={metric.id}>
                      <div>
                        <strong>{metric.label}</strong>
                        <span>{metric.audienceLabel}</span>
                      </div>
                      <div className="coach-consent-list__value">
                        <Badge tone="success">공유 중</Badge>
                        <strong>{metric.value}</strong>
                        <span>{metric.updatedLabel}</span>
                      </div>
                    </li>
                  )
                case "private": {
                  const label = metric.reason === "revoked" ? "공유 철회" : "동의 없음"
                  const tone: BadgeTone = metric.reason === "revoked" ? "critical" : "neutral"

                  return (
                    <li key={metric.id}>
                      <div>
                        <strong>{metric.label}</strong>
                        <span>{metric.audienceLabel}</span>
                      </div>
                      <div className="coach-consent-list__value">
                        <Badge tone={tone}>{label}</Badge>
                        <strong>비공개</strong>
                        <span>{metric.updatedLabel}</span>
                      </div>
                    </li>
                  )
                }
                default:
                  return assertNeverMetric(metric)
              }
            })}
          </ul>
        </section>

        <section aria-labelledby="audit-title" className="coach-detail__section">
          <h3 id="audit-title">접근 감사 기록</h3>
          {participant.auditEvents.length === 0 ? (
            <p className="coach-detail__helper" role="status">
              아직 기록이 없습니다.
            </p>
          ) : (
            <ol aria-label="접근 감사 기록" className="coach-audit-list">
              {participant.auditEvents.map((event) => (
                <li key={event.id}>
                  <span
                    aria-hidden
                    className={`coach-audit-list__marker coach-audit-list__marker--${event.kind}`}
                  />
                  <div>
                    <div className="coach-audit-list__heading">
                      <strong>{event.title}</strong>
                      <time>{event.occurredAtLabel}</time>
                    </div>
                    <p>{event.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </Card>
    </aside>
  )
}
