import { type ChangeEvent, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "../../components/primitives/index.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { assertParticipantNever, type RecordHandlers, type ReviewDraftViewModel } from "./models.ts"
import { ReviewDraft } from "./ReviewDraft.tsx"

type FileImportFormProps = {
  readonly handlers: RecordHandlers
  readonly supportedExtensions: readonly string[]
}

export function FileImportForm({ handlers, supportedExtensions }: FileImportFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ReviewDraftViewModel>()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.item(0)
    if (selectedFile === null || selectedFile === undefined) {
      return
    }
    const parsed = z
      .instanceof(File)
      .refine((candidate) => {
        const extension = candidate.name.toLowerCase().split(".").at(-1)
        return (
          extension !== undefined &&
          supportedExtensions.some((supported) => supported.toLowerCase() === extension)
        )
      })
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
        setFeedback({ kind: "error", message: "지원하지 않는 파일이에요." })
        break
      default:
        assertParticipantNever(parsed)
    }
  }

  const importFile = async () => {
    if (file === null || actionPending.current) {
      return
    }
    actionPending.current = true
    setBusy(true)
    try {
      const result = await handlers.onImportFile(file)
      switch (result.kind) {
        case "success":
          setDraft(result.draft)
          setFeedback({ kind: "status", message: "파일을 기록 초안으로 바꾸었어요." })
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
        rejectedActionFeedback(actionError, "파일을 가져오지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="participant-stack">
      <div className="participant-field">
        <label htmlFor="participant-activity-file">활동 파일</label>
        <input
          accept={supportedExtensions.map((extension) => `.${extension}`).join(",")}
          id="participant-activity-file"
          onChange={selectFile}
          type="file"
        />
      </div>
      <p className="participant-form__hint">
        지원: {supportedExtensions.map((extension) => extension.toUpperCase()).join(", ")}
      </p>
      {file === null ? null : <p className="participant-selected-file">선택한 파일: {file.name}</p>}
      <Button busy={busy} disabled={file === null} onClick={importFile}>
        초안 만들기
      </Button>
      <ActionFeedback feedback={feedback} />
      {draft === undefined ? null : (
        <ReviewDraft draft={draft} handlers={handlers} key={draft.id} />
      )}
    </div>
  )
}
