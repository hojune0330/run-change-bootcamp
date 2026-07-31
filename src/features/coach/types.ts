export type ParticipantId = `participant:${string}`
export type CohortId = `cohort:${string}`
export type FeedbackId = `feedback:${string}`
export type ConsentMetricId = `metric:${string}`
export type AuditEventId = `audit:${string}`

export type ChangeIndicator =
  | { readonly kind: "improved"; readonly label: string; readonly value: string }
  | { readonly kind: "steady"; readonly label: string; readonly value: string }
  | { readonly kind: "declined"; readonly label: string; readonly value: string }
  | { readonly kind: "no_data"; readonly label: string }

export type ParticipantRisk = "none" | "pain" | "risk"

export type ParticipantStatusViewModel = {
  readonly id: ParticipantId
  readonly name: string
  readonly cohortLabel: string
  readonly missingHomeworkCount: number
  readonly dataFreshnessLabel: string
  readonly isDataStale: boolean
  readonly risk: ParticipantRisk
  readonly pendingFeedbackCount: number
  readonly change: ChangeIndicator
}

export type CoachSummaryViewModel = {
  readonly totalParticipants: number
  readonly missingHomeworkCount: number
  readonly staleDataCount: number
  readonly painRiskCount: number
  readonly pendingFeedbackCount: number
}

export type CohortOption = {
  readonly id: CohortId
  readonly label: string
}

export type CoachFilterViewModel = {
  readonly query: string
  readonly cohortId: CohortId | "all"
  readonly cohortOptions: readonly CohortOption[]
  readonly resultCount: number
}

type StakeholderMetricBase = {
  readonly id: ConsentMetricId
  readonly label: string
  readonly audienceLabel: string
  readonly updatedLabel: string
}

export type StakeholderMetric =
  | (StakeholderMetricBase & {
      readonly kind: "shared"
      readonly value: string
    })
  | (StakeholderMetricBase & {
      readonly kind: "private"
      readonly reason: "revoked" | "not_granted"
    })

export type AuditEventKind =
  | "consent_granted"
  | "consent_revoked"
  | "stakeholder_viewed"
  | "coach_feedback"

export type AuditEventViewModel = {
  readonly id: AuditEventId
  readonly kind: AuditEventKind
  readonly title: string
  readonly detail: string
  readonly occurredAtLabel: string
}

export type ParticipantDetailViewModel = {
  readonly id: ParticipantId
  readonly name: string
  readonly cohortLabel: string
  readonly contactLabel: string
  readonly coachNote: string
  readonly stakeholderMetrics: readonly StakeholderMetric[]
  readonly auditEvents: readonly AuditEventViewModel[]
}

export type AssignmentCategory = "running" | "health"

export type AssignmentDraft = {
  readonly title: string
  readonly category: AssignmentCategory
  readonly dueDate: string
  readonly cohortId: CohortId | "all"
  readonly instructions: string
}

export type NoticeDraft = {
  readonly title: string
  readonly body: string
  readonly pinned: boolean
}

type PendingFeedbackBase = {
  readonly id: FeedbackId
  readonly participantName: string
  readonly summary: string
  readonly createdAtLabel: string
}

export type PendingFeedback =
  | (PendingFeedbackBase & { readonly kind: "low_risk" })
  | (PendingFeedbackBase & { readonly kind: "training_change" })
  | (PendingFeedbackBase & { readonly kind: "pain_risk" })

export const TIME_TRIAL_SESSIONS = ["session_1", "session_2"] as const
export type TimeTrialSession = (typeof TIME_TRIAL_SESSIONS)[number]

export const TIME_TRIAL_PROTOCOLS = ["12_minute", "3k", "5k"] as const
export type TimeTrialProtocol = (typeof TIME_TRIAL_PROTOCOLS)[number]

export type TimeTrialDecision =
  | { readonly kind: "undecided" }
  | {
      readonly kind: "decided"
      readonly session: TimeTrialSession
      readonly protocol: TimeTrialProtocol
    }

export type TimeTrialDraft = {
  readonly session: TimeTrialSession | null
  readonly protocol: TimeTrialProtocol | null
}

export type TimeTrialConfirmation = { readonly kind: "idle" } | { readonly kind: "required" }

export type TimeTrialViewModel = {
  readonly currentDecision: TimeTrialDecision
  readonly draft: TimeTrialDraft
  readonly confirmation: TimeTrialConfirmation
}
