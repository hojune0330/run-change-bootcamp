export class PrivacyTransitionError extends Error {
  readonly code: "forbidden" | "invalid_transition" | "sensitive_source" | "exact_copy_required"
  constructor(code: PrivacyTransitionError["code"]) {
    super(code)
    this.code = code
    this.name = "PrivacyTransitionError"
  }
}
