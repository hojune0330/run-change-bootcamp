export type ActionFeedbackState =
  | { readonly kind: "status"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }

export function rejectedActionFeedback(error: unknown, message: string): ActionFeedbackState {
  if (error instanceof Error && error.name === "AbortError") {
    return { kind: "error", message: "요청이 취소됐어요. 다시 시도해 주세요." }
  }

  return { kind: "error", message }
}
