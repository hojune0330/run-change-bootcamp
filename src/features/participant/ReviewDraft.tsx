import { useRef, useState } from "react"
import { Badge, Button, Card } from "../../components/primitives/index.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { assertParticipantNever, type RecordHandlers, type ReviewDraftViewModel } from "./models.ts"

type ReviewDraftProps = {
  readonly draft: ReviewDraftViewModel
  readonly handlers: RecordHandlers
}

export function ReviewDraft({ draft, handlers }: ReviewDraftProps) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)

  const saveDraft = async () => {
    if (actionPending.current || saved) {
      return
    }
    actionPending.current = true
    setBusy(true)
    try {
      const result = await handlers.onSaveDraft(draft.id)
      switch (result.kind) {
        case "success":
          setSaved(true)
          setFeedback({ kind: "status", message: "검토한 내용을 초안으로 보관했어요." })
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
        rejectedActionFeedback(actionError, "초안을 보관하지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  return (
    <Card
      action={<Badge tone="warning">검토 필요</Badge>}
      eyebrow={draft.source === "file" ? "FILE DRAFT" : "SCREENSHOT DRAFT"}
      title="검토할 기록 초안"
      tone="muted"
    >
      <div className="participant-stack">
        <p className="participant-draft-source">{draft.sourceLabel}</p>
        {draft.source === "screenshot" ? (
          draft.previewUrl === undefined ? (
            <div className="participant-preview-fallback">미리보기를 불러오지 못했어요.</div>
          ) : (
            <img
              alt={`${draft.sourceLabel} 스크린샷 미리보기`}
              className="participant-draft-preview"
              height={360}
              src={draft.previewUrl}
              width={640}
            />
          )
        ) : null}
        <dl className="participant-metric-list">
          {draft.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
        {draft.notes.length === 0 ? null : (
          <ul className="participant-note-list">
            {draft.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <p className="participant-draft-warning">기록에 아직 반영되지 않았어요.</p>
        <Button busy={busy} disabled={saved} onClick={saveDraft} variant="secondary">
          {saved ? "초안 보관됨" : "검토 완료 · 초안 보관"}
        </Button>
        <ActionFeedback feedback={feedback} />
      </div>
    </Card>
  )
}
