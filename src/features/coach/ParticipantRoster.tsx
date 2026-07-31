import { Badge, type BadgeTone } from "../../components/primitives/index.ts"
import type { ParticipantId, ParticipantStatusViewModel } from "./types.ts"
import "./coach-participants.css"

export type ParticipantRosterProps = {
  readonly participants: readonly ParticipantStatusViewModel[]
  readonly selectedParticipantId?: ParticipantId
  readonly onSelectParticipant: (participantId: ParticipantId) => void
}

function changeTone(change: ParticipantStatusViewModel["change"]): BadgeTone {
  switch (change.kind) {
    case "improved":
      return "success"
    case "steady":
    case "no_data":
      return "neutral"
    case "declined":
      return "warning"
  }
}

function riskLabel(risk: ParticipantStatusViewModel["risk"]): string {
  switch (risk) {
    case "none":
      return "위험 없음"
    case "pain":
      return "통증 확인"
    case "risk":
      return "위험 검토"
  }
}

function riskTone(risk: ParticipantStatusViewModel["risk"]): BadgeTone {
  return risk === "none" ? "success" : "critical"
}

type StatusBadgesProps = {
  readonly participant: ParticipantStatusViewModel
}

function StatusBadges({ participant }: StatusBadgesProps) {
  const changeValue = participant.change.kind === "no_data" ? null : participant.change.value

  return (
    <div className="coach-statuses">
      <Badge tone={participant.missingHomeworkCount === 0 ? "success" : "warning"}>
        {participant.missingHomeworkCount === 0
          ? "미제출 없음"
          : `미제출 ${participant.missingHomeworkCount}건`}
      </Badge>
      <Badge tone={participant.isDataStale ? "warning" : "success"}>
        {participant.isDataStale
          ? `데이터 지연 · ${participant.dataFreshnessLabel}`
          : "데이터 최신"}
      </Badge>
      <Badge tone={riskTone(participant.risk)}>{riskLabel(participant.risk)}</Badge>
      <Badge tone={participant.pendingFeedbackCount === 0 ? "neutral" : "warning"}>
        {participant.pendingFeedbackCount === 0
          ? "피드백 대기 없음"
          : `피드백 대기 ${participant.pendingFeedbackCount}건`}
      </Badge>
      <Badge tone={changeTone(participant.change)}>
        {participant.change.label}
        {changeValue === null ? "" : ` ${changeValue}`}
      </Badge>
    </div>
  )
}

export function ParticipantRoster({
  onSelectParticipant,
  participants,
  selectedParticipantId,
}: ParticipantRosterProps) {
  if (participants.length === 0) {
    return (
      <div className="coach-empty" role="status">
        조건에 맞는 참가자가 없습니다. 필터를 바꿔 보세요.
      </div>
    )
  }

  return (
    <section aria-labelledby="coach-roster-title" className="coach-roster">
      <div className="coach-section-heading">
        <div>
          <p className="coach-eyebrow">COHORT SCAN</p>
          <h2 id="coach-roster-title">참가자 상태</h2>
        </div>
        <span>{participants.length}명</span>
      </div>

      <div className="coach-roster__table-region">
        <table aria-label="참가자 상태">
          <colgroup>
            <col className="coach-roster__name-column" />
            <col className="coach-roster__cohort-column" />
            <col span={5} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">참가자</th>
              <th scope="col">코호트</th>
              <th scope="col">과제</th>
              <th scope="col">데이터</th>
              <th scope="col">안전</th>
              <th scope="col">피드백</th>
              <th scope="col">변화</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.id}>
                <th scope="row">
                  <button
                    aria-label={`${participant.name} 상세 보기`}
                    aria-pressed={participant.id === selectedParticipantId}
                    className="coach-name-button"
                    onClick={() => onSelectParticipant(participant.id)}
                    title={participant.name}
                    type="button"
                  >
                    {participant.name}
                  </button>
                </th>
                <td>{participant.cohortLabel}</td>
                <td>
                  <Badge tone={participant.missingHomeworkCount === 0 ? "success" : "warning"}>
                    {participant.missingHomeworkCount === 0
                      ? "완료"
                      : `${participant.missingHomeworkCount}건 미제출`}
                  </Badge>
                </td>
                <td>
                  <Badge tone={participant.isDataStale ? "warning" : "success"}>
                    {participant.isDataStale ? participant.dataFreshnessLabel : "최신"}
                  </Badge>
                </td>
                <td>
                  <Badge tone={riskTone(participant.risk)}>{riskLabel(participant.risk)}</Badge>
                </td>
                <td>{participant.pendingFeedbackCount}건</td>
                <td>
                  <Badge tone={changeTone(participant.change)}>
                    {participant.change.kind === "no_data"
                      ? participant.change.label
                      : `${participant.change.label} ${participant.change.value}`}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="참가자 상태 카드" className="coach-roster__cards">
        {participants.map((participant) => (
          <li key={participant.id}>
            <article
              aria-current={participant.id === selectedParticipantId ? "true" : undefined}
              className="coach-participant-card"
            >
              <div className="coach-participant-card__heading">
                <div>
                  <p>{participant.cohortLabel}</p>
                  <h3>{participant.name}</h3>
                </div>
                <button
                  aria-label={`${participant.name} 상세 보기`}
                  aria-pressed={participant.id === selectedParticipantId}
                  className="coach-detail-button"
                  onClick={() => onSelectParticipant(participant.id)}
                  type="button"
                >
                  상세
                </button>
              </div>
              <StatusBadges participant={participant} />
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
