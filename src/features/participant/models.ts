export type Loadable<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly data: T }

export type ActionResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

export type AssignmentId = `assignment-${string}`
export type PostId = `post-${string}`
export type DraftId = `draft-${string}`
export type ConsentKey = `consent-${string}`

export type AnnouncementViewModel = {
  readonly id: `announcement-${string}`
  readonly title: string
  readonly body: string
  readonly publishedLabel: string
}

export type AssignmentViewModel = {
  readonly id: AssignmentId
  readonly title: string
  readonly summary: string
  readonly dueLabel: string
  readonly durationLabel: string
  readonly status: "pending" | "completed"
}

export type BacklogAssignmentViewModel = {
  readonly id: AssignmentId
  readonly title: string
  readonly dueLabel: string
  readonly status: "pending" | "completed"
}

export type MotionInsightChapterViewModel = {
  readonly label: string
  readonly value: string
  readonly description: string
}

export type MotionInsightViewModel = {
  readonly sourceLabel: string
  readonly periodLabel: string
  readonly chapters: readonly MotionInsightChapterViewModel[]
}

export type TodayViewModel = {
  readonly displayName: string
  readonly dateLabel: string
  readonly announcement?: AnnouncementViewModel
  readonly assignment?: AssignmentViewModel
  readonly backlog?: readonly BacklogAssignmentViewModel[]
  readonly motionInsight?: MotionInsightViewModel
  readonly streakDays?: number
}

export type TodayHandlers = {
  readonly onCompleteAssignment: (id: AssignmentId) => Promise<ActionResult>
}

export type FeedCommentViewModel = {
  readonly id: `comment-${string}`
  readonly authorName: string
  readonly body: string
}

export type FeedPostViewModel = {
  readonly id: PostId
  readonly authorName: string
  readonly body: string
  readonly createdLabel: string
  readonly heartCount: number
  readonly isHearted: boolean
  readonly comments: readonly FeedCommentViewModel[]
  readonly shareUrl: string
}

export type FeedViewModel = {
  readonly posts: readonly FeedPostViewModel[]
}

export type FeedHandlers = {
  readonly onHeart: (id: PostId, isHearted: boolean) => Promise<ActionResult>
  readonly onComment: (id: PostId, body: string) => Promise<ActionResult>
}

export type DraftMetricViewModel = {
  readonly label: string
  readonly value: string
}

export type ReviewDraftViewModel = {
  readonly id: DraftId
  readonly source: "file" | "screenshot"
  readonly sourceLabel: string
  readonly metrics: readonly DraftMetricViewModel[]
  readonly notes: readonly string[]
  readonly previewUrl?: string
}

export type DraftResult =
  | { readonly kind: "success"; readonly draft: ReviewDraftViewModel }
  | { readonly kind: "error"; readonly message: string }

export type RecordViewModel = {
  readonly recordedOn: string
  readonly supportedExtensions: readonly string[]
}

export type ManualMetricInput = {
  readonly metricKey: "distance_km" | "duration_min" | "resting_heart_rate" | "sleep_hours"
  readonly value: number
  readonly recordedOn: string
}

export type RecordHandlers = {
  readonly onSaveManual: (input: ManualMetricInput) => Promise<ActionResult>
  readonly onImportFile: (file: File) => Promise<DraftResult>
  readonly onUploadScreenshot: (file: File) => Promise<DraftResult>
  readonly onSaveDraft: (id: DraftId) => Promise<ActionResult>
}

export type ChangeMetricViewModel = {
  readonly id: `metric-${string}`
  readonly label: string
  readonly value: string
  readonly changeLabel: string
  readonly deltaLabel?: string
}

export type FeedbackViewModel = {
  readonly id: `feedback-${string}`
  readonly source: "automated_summary" | "coach_approved"
  readonly title: string
  readonly body: string
}

export type ConsentViewModel = {
  readonly key: ConsentKey
  readonly label: string
  readonly description: string
  readonly enabled?: boolean
}

export type ConsentAuditViewModel = {
  readonly id: `audit-${string}`
  readonly label: string
}

export type MyChangeViewModel = {
  readonly displayName: string
  readonly metrics: readonly ChangeMetricViewModel[]
  readonly feedback: readonly FeedbackViewModel[]
  readonly consents: readonly ConsentViewModel[]
  readonly consentHistory: readonly ConsentAuditViewModel[]
}

export type ConsentChangeRequest = {
  readonly key: ConsentKey
  readonly enabled: boolean
}

export type ConsentChangeResult =
  | { readonly kind: "success"; readonly auditEntry: ConsentAuditViewModel }
  | { readonly kind: "error"; readonly message: string }

export type MyChangeHandlers = {
  readonly onConsentChange: (request: ConsentChangeRequest) => Promise<ConsentChangeResult>
}

export class UnexpectedParticipantVariantError extends Error {
  readonly name = "UnexpectedParticipantVariantError"
}

export function assertParticipantNever(value: never): never {
  throw new UnexpectedParticipantVariantError(`Unexpected participant variant: ${String(value)}`)
}
