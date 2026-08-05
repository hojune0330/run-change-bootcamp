import { Badge, Card } from "../../components/primitives/index.ts"
import { assertParticipantNever, type FeedbackViewModel } from "./models.ts"

type FeedbackPanelProps = {
  readonly feedback: readonly FeedbackViewModel[]
}

function feedbackSource(source: FeedbackViewModel["source"]) {
  switch (source) {
    case "automated_summary":
      return {
        label: "자동 요약",
        note: "훈련 변경 제안이 아니에요.",
        tone: "neutral",
      } as const
    case "coach_approved":
      return {
        label: "코치 승인",
        note: "코치가 확인한 피드백이에요.",
        tone: "success",
      } as const
    default:
      return assertParticipantNever(source)
  }
}

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  if (feedback.length === 0) {
    return (
      <Card eyebrow="피드백" title="피드백" tone="muted">
        <p className="participant-empty-copy">아직 받은 피드백이 없어요.</p>
      </Card>
    )
  }

  return (
    <section aria-labelledby="participant-feedback-title" className="participant-section-stack">
      <div className="participant-section-heading">
        <p>피드백</p>
        <h2 id="participant-feedback-title">피드백</h2>
      </div>
      {feedback.map((item) => {
        const source = feedbackSource(item.source)
        return (
          <Card
            action={<Badge tone={source.tone}>{source.label}</Badge>}
            key={item.id}
            title={item.title}
          >
            <div className="participant-stack">
              <p>{item.body}</p>
              <p className="participant-source-note">{source.note}</p>
            </div>
          </Card>
        )
      })}
    </section>
  )
}
