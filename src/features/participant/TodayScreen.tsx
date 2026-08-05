import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle"
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone"
import { useRef, useState } from "react"
import { Badge, Button, Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { LoadableBoundary } from "./LoadableBoundary.tsx"
import {
  type AssignmentViewModel,
  assertParticipantNever,
  type Loadable,
  type TodayHandlers,
  type TodayViewModel,
} from "./models.ts"
import "./participant.css"

export type TodayScreenProps = {
  readonly brand?: BrandConfig
  readonly state: Loadable<TodayViewModel>
  readonly handlers: TodayHandlers
  readonly onRetry: () => void
}

type AssignmentCardProps = {
  readonly assignment: AssignmentViewModel
  readonly handlers: TodayHandlers
}

type CompletionUpdate = {
  readonly assignmentId: AssignmentViewModel["id"]
  readonly sourceStatus: AssignmentViewModel["status"]
}

function AssignmentCard({ assignment, handlers }: AssignmentCardProps) {
  const [completionUpdate, setCompletionUpdate] = useState<CompletionUpdate>()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)
  const hasCurrentCompletionUpdate =
    completionUpdate?.assignmentId === assignment.id &&
    completionUpdate.sourceStatus === assignment.status
  if (completionUpdate !== undefined && !hasCurrentCompletionUpdate) {
    setCompletionUpdate(undefined)
  }
  const completed = assignment.status === "completed" || hasCurrentCompletionUpdate

  const completeAssignment = async () => {
    if (actionPending.current || completed) {
      return
    }

    actionPending.current = true
    setBusy(true)
    try {
      const result = await handlers.onCompleteAssignment(assignment.id)
      switch (result.kind) {
        case "success":
          setCompletionUpdate({ assignmentId: assignment.id, sourceStatus: assignment.status })
          setFeedback({ kind: "status", message: "오늘 과제를 완료했어요." })
          break
        case "error":
          setFeedback({ kind: "error", message: result.message })
          break
        default:
          assertParticipantNever(result)
      }
    } catch (error: unknown) {
      const actionError = error instanceof Error ? error : undefined
      setFeedback(
        rejectedActionFeedback(actionError, "과제를 완료하지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  return (
    <Card
      action={<Badge tone={completed ? "success" : "warning"}>{completed ? "완료" : "오늘"}</Badge>}
      eyebrow="오늘의 과제"
      title={assignment.title}
    >
      <div className="participant-stack">
        <p>{assignment.summary}</p>
        <dl className="participant-inline-details">
          <div>
            <dt>예상 시간</dt>
            <dd>{assignment.durationLabel}</dd>
          </div>
          <div>
            <dt>마감</dt>
            <dd>{assignment.dueLabel}</dd>
          </div>
        </dl>
        <Button
          aria-label={completed ? "완료됨" : "과제 완료"}
          busy={busy}
          disabled={completed}
          icon={<CheckCircleIcon aria-hidden size={20} weight="bold" />}
          onClick={completeAssignment}
        >
          {completed ? "완료됨" : "과제 완료"}
        </Button>
        <ActionFeedback feedback={feedback} />
      </div>
    </Card>
  )
}

export function TodayScreen({ brand = DEFAULT_BRAND, state, handlers, onRetry }: TodayScreenProps) {
  return (
    <section aria-labelledby="participant-today-title" className="participant-screen">
      <header className="participant-screen__header">
        <p className="participant-screen__eyebrow">{brand.productName} · 오늘의 러닝</p>
        <h1 id="participant-today-title">오늘</h1>
      </header>
      <LoadableBoundary onRetry={onRetry} state={state}>
        {(model) => (
          <div className="participant-screen__content">
            <div className="participant-greeting">
              <p className="participant-greeting__date">{model.dateLabel}</p>
              <p className="participant-greeting__name">{model.displayName}, 하나만 완료해요.</p>
            </div>

            {model.assignment === undefined ? (
              <Card eyebrow="오늘의 과제" title="쉬어가는 날" tone="muted">
                <p className="participant-empty-copy">오늘 할 과제가 없어요.</p>
              </Card>
            ) : (
              <AssignmentCard
                assignment={model.assignment}
                handlers={handlers}
                key={model.assignment.id}
              />
            )}

            {model.announcement === undefined ? (
              <Card eyebrow="공지" title="새 공지가 없어요" tone="muted">
                <p className="participant-empty-copy">새로 확인할 내용이 없어요.</p>
              </Card>
            ) : (
              <Card
                action={<MegaphoneIcon aria-hidden size={22} weight="bold" />}
                eyebrow={model.announcement.publishedLabel}
                title={model.announcement.title}
              >
                <p>{model.announcement.body}</p>
              </Card>
            )}
          </div>
        )}
      </LoadableBoundary>
    </section>
  )
}
