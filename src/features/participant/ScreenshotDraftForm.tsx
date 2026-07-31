import { type ChangeEvent, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "../../components/primitives/index.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { assertParticipantNever, type RecordHandlers, type ReviewDraftViewModel } from "./models.ts"
import { ReviewDraft } from "./ReviewDraft.tsx"

const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const

type ScreenshotDraftFormProps = {
  readonly handlers: RecordHandlers
}

export function ScreenshotDraftForm({ handlers }: ScreenshotDraftFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ReviewDraftViewModel>()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)

  const selectScreenshot = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.item(0)
    if (selectedFile === null || selectedFile === undefined) {
      return
    }
    const parsed = z
      .instanceof(File)
      .refine((candidate) => SCREENSHOT_TYPES.some((type) => type === candidate.type))
      .safeParse(selectedFile)
    switch (parsed.success) {
      case true:
        setFile(parsed.data)
        setDraft(undefined)
        setFeedback(undefined)
        break
      case false:
        setFile(null)
        setDraft(undefined)
        setFeedback({ kind: "error", message: "PNG, JPG, WEBP 이미지만 올릴 수 있어요." })
        break
      default:
        assertParticipantNever(parsed)
    }
  }

  const uploadScreenshot = async () => {
    if (file === null || actionPending.current) {
      return
    }
    actionPending.current = true
    setBusy(true)
    try {
      const result = await handlers.onUploadScreenshot(file)
      switch (result.kind) {
        case "success":
          setDraft(result.draft)
          setFeedback({ kind: "status", message: "추출한 값을 꼭 확인해 주세요." })
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
        rejectedActionFeedback(actionError, "이미지를 읽지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="participant-stack">
      <div className="participant-field">
        <label htmlFor="participant-screenshot">운동 스크린샷</label>
        <input
          accept={SCREENSHOT_TYPES.join(",")}
          id="participant-screenshot"
          onChange={selectScreenshot}
          type="file"
        />
      </div>
      <p className="participant-form__hint">
        이미지의 숫자는 자동 확정하지 않고 검토할 초안으로만 만들어요.
      </p>
      {file === null ? null : (
        <p className="participant-selected-file">선택한 이미지: {file.name}</p>
      )}
      <Button busy={busy} disabled={file === null} onClick={uploadScreenshot}>
        이미지에서 초안 만들기
      </Button>
      <ActionFeedback feedback={feedback} />
      {draft === undefined ? null : (
        <ReviewDraft draft={draft} handlers={handlers} key={draft.id} />
      )}
    </div>
  )
}
