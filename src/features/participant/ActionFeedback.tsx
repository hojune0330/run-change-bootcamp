import { useEffect, useRef } from "react"
import type { ActionFeedbackState } from "./action-feedback-state.ts"

type ActionFeedbackProps = {
  readonly feedback: ActionFeedbackState | undefined
}

export function ActionFeedback({ feedback }: ActionFeedbackProps) {
  const feedbackRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (feedback?.kind === "error") {
      feedbackRef.current?.focus()
    }
  }, [feedback])

  if (feedback === undefined) {
    return null
  }

  return (
    <p
      className={`participant-feedback participant-feedback--${feedback.kind}`}
      ref={feedbackRef}
      role={feedback.kind === "error" ? "alert" : "status"}
      tabIndex={feedback.kind === "error" ? -1 : undefined}
    >
      {feedback.message}
    </p>
  )
}
