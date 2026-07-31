import { Badge, type BadgeTone, Button, Card } from "../../components/primitives/index.ts"
import type { FeedbackId, PendingFeedback } from "./types.ts"
import "./coach-queue.css"

export type FeedbackApprovalQueueProps = {
  readonly items: readonly PendingFeedback[]
  readonly onApprove: (feedbackId: FeedbackId) => void
  readonly onAutoApprove: (feedbackId: FeedbackId) => void
  readonly onReject: (feedbackId: FeedbackId) => void
}

type FeedbackPresentation = {
  readonly label: string
  readonly tone: BadgeTone
  readonly approval: "auto" | "coach"
}

function feedbackPresentation(item: PendingFeedback): FeedbackPresentation {
  switch (item.kind) {
    case "low_risk":
      return { label: "저위험 안내", tone: "success", approval: "auto" }
    case "training_change":
      return { label: "훈련 변경", tone: "warning", approval: "coach" }
    case "pain_risk":
      return { label: "통증·위험", tone: "critical", approval: "coach" }
  }
}

export function FeedbackApprovalQueue({
  items,
  onApprove,
  onAutoApprove,
  onReject,
}: FeedbackApprovalQueueProps) {
  return (
    <Card
      action={<Badge tone={items.length === 0 ? "success" : "warning"}>{items.length}건</Badge>}
      eyebrow="APPROVAL QUEUE"
      title="피드백 승인"
    >
      {items.length === 0 ? (
        <p className="coach-queue__empty" role="status">
          검토 대기 피드백이 없습니다.
        </p>
      ) : (
        <ul className="coach-queue">
          {items.map((item) => {
            const presentation = feedbackPresentation(item)

            return (
              <li key={item.id}>
                <div className="coach-queue__heading">
                  <div>
                    <strong>{item.participantName}</strong>
                    <span>{item.createdAtLabel}</span>
                  </div>
                  <Badge tone={presentation.tone}>{presentation.label}</Badge>
                </div>
                <p>{item.summary}</p>
                <div className="coach-queue__actions">
                  <Button
                    aria-label={`${item.participantName} 피드백 반려`}
                    onClick={() => onReject(item.id)}
                    variant="quiet"
                  >
                    반려
                  </Button>
                  {presentation.approval === "auto" ? (
                    <Button
                      aria-label={`${item.participantName} 저위험 피드백 자동 승인`}
                      onClick={() => onAutoApprove(item.id)}
                      variant="secondary"
                    >
                      자동 승인
                    </Button>
                  ) : (
                    <Button
                      aria-label={`${item.participantName} 위험 피드백 검토 후 승인`}
                      onClick={() => onApprove(item.id)}
                    >
                      검토 후 승인
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
