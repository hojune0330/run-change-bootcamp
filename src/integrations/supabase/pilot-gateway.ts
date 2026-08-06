import { z } from "zod"
import {
  createPilotAuthGateway,
  type PilotOperationError,
  type PilotOperationResult,
  type PilotSessionState,
} from "./pilot-auth.ts"
import type { PilotClient, PilotClientSession } from "./pilot-client.ts"
import type { SupabasePublicConfig } from "./runtime-config.ts"

export type {
  PilotBlockedReason,
  PilotMembership,
  PilotOperationError,
  PilotOperationResult,
  PilotRole,
  PilotSessionState,
} from "./pilot-auth.ts"
export type {
  PilotClient,
  PilotClientSession,
  PilotDataRequest,
  PilotFunctionRequest,
  PilotPage,
  PilotPageRequest,
  PilotRpcRequest,
} from "./pilot-client.ts"

export type PilotConsentReference = { readonly id: string }

export type PilotAuditEvent = {
  readonly entityId: string | null
  readonly entityType: string
  readonly eventType: string
  readonly id: number
  readonly occurredAt: string
}

export type PilotCoachRisk = "none" | "pain" | "risk"
export type PilotCoachClassification = "low_risk" | "training_change" | "pain" | "risk"

export type PilotCoachRosterParticipant = {
  readonly displayName: string
  readonly email: string | null
  readonly joinedAt: string
  readonly latestMetricAt: string | null
  readonly membershipId: string
  readonly metricCount14d: number
  readonly metricCountPrev14d: number
  readonly missingHomeworkCount: number
  readonly pendingFeedbackCount: number
  readonly profileId: string
  readonly risk: PilotCoachRisk
}

export type PilotCoachFeedbackQueueItem = {
  readonly body: string
  readonly classification: PilotCoachClassification
  readonly createdAt: string
  readonly feedbackId: string
  readonly participantId: string
  readonly participantName: string
}

export type PilotCoachTimeTrial = {
  readonly decidedAt: string
  readonly initialSessionNumber: 1 | 2
  readonly protocol: "12_minute" | "3k" | "5k"
}

export type PilotCoachDashboard = {
  readonly feedbackQueue: readonly PilotCoachFeedbackQueueItem[]
  readonly participants: readonly PilotCoachRosterParticipant[]
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly title: string
  }
  readonly summary: {
    readonly missingHomeworkCount: number
    readonly painRiskCount: number
    readonly pendingFeedbackCount: number
    readonly staleDataCount: number
    readonly totalParticipants: number
  }
  readonly timeTrial: PilotCoachTimeTrial | null
}

export type PilotCoachSharedMetric = {
  readonly metricType: string
  readonly observedAt: string | null
  readonly unit: string
  readonly value: number
}

export type PilotCoachAuditEvent = {
  readonly details: Readonly<Record<string, unknown>>
  readonly entityId: string | null
  readonly entityType: string
  readonly eventType: string
  readonly occurredAt: string
}

export type PilotCoachParticipantDetail = {
  readonly auditEvents: readonly PilotCoachAuditEvent[]
  readonly consentedMetricTypes: readonly string[]
  readonly healthMetricTypes: readonly string[]
  readonly profile: {
    readonly displayName: string
    readonly email: string | null
    readonly profileId: string
  }
  readonly sharedMetrics: readonly PilotCoachSharedMetric[]
}

export type PilotSubmitReference = { readonly id: string }
export type PilotTimeTrialSaveReference = { readonly programId: string }
export type PilotUploadReference = {
  readonly draftCount: number
  readonly uploadId: string
}

export type PilotBacklogAssignment = {
  readonly assignmentId: string
  readonly assignmentKind: "health" | "reflection" | "running"
  readonly completed: boolean
  readonly dueAt: string | null
  readonly title: string
}

export type PilotParticipantToday = {
  readonly announcement: {
    readonly announcementId: string
    readonly body: string
    readonly pinned: boolean
    readonly publishedAt: string
    readonly title: string
  } | null
  readonly assignment: {
    readonly assignmentId: string
    readonly assignmentKind: "health" | "reflection" | "running"
    readonly completed: boolean
    readonly dueAt: string | null
    readonly instructions: string
    readonly title: string
  } | null
  readonly backlog: readonly PilotBacklogAssignment[]
  readonly dateLabel: string
  readonly profile: { readonly displayName: string; readonly profileId: string }
  readonly program: { readonly title: string }
  readonly streakDays: number
}

export type PilotFeedComment = {
  readonly authorName: string
  readonly body: string
  readonly commentId: string
  readonly createdAt: string
}

export type PilotFeedPost = {
  readonly authorName: string
  readonly authorProfileId: string
  readonly body: string
  readonly comments: readonly PilotFeedComment[]
  readonly createdAt: string
  readonly heartCount: number
  readonly isHearted: boolean
  readonly postId: string
}

export type PilotParticipantFeed = {
  readonly posts: readonly PilotFeedPost[]
}

export type PilotParticipantMetric = {
  readonly count14d: number
  readonly metricType: string
  readonly observedAt: string | null
  readonly previousObservedAt: string | null
  readonly previousValue: number | null
  readonly unit: string
  readonly value: number
}

export type PilotParticipantFeedback = {
  readonly body: string
  readonly classification: "low_risk" | "training_change" | "pain" | "risk"
  readonly feedbackId: string
  readonly origin: "ai" | "coach"
  readonly publishedAt: string | null
}

export type PilotConsentAuditEvent = {
  readonly auditEventId: number
  readonly eventType: string
  readonly occurredAt: string
}

export type PilotParticipantChange = {
  readonly completionPercent: number
  readonly consentHistory: readonly PilotConsentAuditEvent[]
  readonly feedback: readonly PilotParticipantFeedback[]
  readonly heartRateConsented: boolean
  readonly metrics: readonly PilotParticipantMetric[]
  readonly profile: { readonly displayName: string; readonly profileId: string }
}

export type PilotParticipantRecord = {
  readonly recordedOn: string
  readonly supportedExtensions: readonly string[]
}

export type PilotConsentToggleResult = {
  readonly auditEventId: number | null
  readonly auditEventType: string | null
  readonly status: "disabled" | "enabled" | "unavailable"
}

export type PilotAdminMember = {
  readonly completionPercent: number
  readonly displayName: string
  readonly heartRateShared: boolean
  readonly joinedAt: string
  readonly profileId: string
  readonly role: "participant" | "coach" | "admin" | "stakeholder"
  readonly status: "active" | "paused" | "ended"
}

export type PilotAdminActivity = {
  readonly actorRole: "coach" | "admin"
  readonly auditEventId: number
  readonly eventType: string
  readonly occurredAt: string
  readonly summary: string
}

export type PilotAdminOverview = {
  readonly activity: readonly PilotAdminActivity[]
  readonly members: readonly PilotAdminMember[]
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly status: "active" | "archived" | "completed" | "draft"
    readonly title: string
  }
  readonly summary: {
    readonly assignmentsCount: number
    readonly consentedCount: number
    readonly painRiskCount: number
    readonly pendingFeedbackCount: number
    readonly totalParticipants: number
  }
  readonly timeTrial: {
    readonly decidedAt: string
    readonly initialSessionNumber: 1 | 2
    readonly protocol: "12_minute" | "3k" | "5k"
  } | null
}

export type PilotAdminMembers = {
  readonly members: readonly {
    readonly completionPercent: number
    readonly displayName: string
    readonly email: string | null
    readonly heartRateShared: boolean
    readonly joinedAt: string
    readonly membershipId: string
    readonly profileId: string
    readonly role: "participant" | "coach" | "admin" | "stakeholder"
    readonly status: "active" | "paused" | "ended"
  }[]
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly status: "active" | "archived" | "completed" | "draft"
    readonly title: string
  }
  readonly summary: {
    readonly activeCoaches: number
    readonly activeParticipants: number
    readonly consentedCount: number
    readonly totalMembers: number
  }
}

export type PilotAdminSchedule = {
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly status: "active" | "archived" | "completed" | "draft"
    readonly title: string
  }
  readonly sessions: readonly {
    readonly scheduledAt: string
    readonly sessionId: string
    readonly sessionKind:
      | "easy"
      | "onboarding"
      | "recovery"
      | "retest"
      | "technique"
      | "time_trial"
      | "training"
    readonly sessionNumber: number
    readonly title: string
  }[]
  readonly summary: {
    readonly pastCount: number
    readonly timeTrial: {
      readonly decidedAt: string
      readonly initialSessionNumber: 1 | 2
      readonly protocol: "12_minute" | "3k" | "5k"
    } | null
    readonly totalSessions: number
    readonly upcomingCount: number
  }
}

export type PilotAdminSettings = {
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly status: "active" | "archived" | "completed" | "draft"
    readonly title: string
  }
  readonly timeTrial: {
    readonly decidedAt: string
    readonly initialSessionNumber: 1 | 2
    readonly protocol: "12_minute" | "3k" | "5k"
  } | null
  readonly summary: {
    readonly deletionRequestCount: number
    readonly failedNotificationCount: number
  }
  readonly deletionRequests: readonly {
    readonly deletionRequestId: string
    readonly profileId: string
    readonly displayName: string
    readonly status: "cancelled" | "completed" | "processing" | "requested"
    readonly requestedAt: string
  }[]
  readonly failedNotifications: readonly {
    readonly outboxId: string
    readonly notificationId: string
    readonly channel: "in_app" | "push"
    readonly title: string
    readonly status: "cancelled" | "failed" | "pending" | "processing" | "sent"
    readonly lastErrorCode: string | null
    readonly attemptCount: number
    readonly createdAt: string
  }[]
}

export type PilotAdminReportCell = {
  readonly columnKey: string
  readonly numericValue: number | null
  readonly participantCount: number | null
  readonly rowKey: string
  readonly suppressed: boolean
  readonly suppressionReason: "complementary" | "primary" | null
}

export type PilotAdminReportSnapshot = {
  readonly calculationVersion: string
  readonly cells: readonly PilotAdminReportCell[]
  readonly frozenAt: string | null
  readonly generatedAt: string
  readonly releasedAt: string | null
  readonly snapshotId: string
  readonly status: "draft" | "frozen" | "released" | "superseded"
}

export type PilotAdminReport = {
  readonly program: {
    readonly endsOn: string
    readonly startsOn: string
    readonly status: "active" | "archived" | "completed" | "draft"
    readonly title: string
  }
  readonly summary: {
    readonly releasedCount: number
    readonly reportCount: number
  }
  readonly snapshots: readonly PilotAdminReportSnapshot[]
}

export interface PilotGateway {
  addPostComment(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  changeMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentToggleResult>>
  completeAssignment(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  completeAuthCallback(input: unknown): Promise<PilotOperationResult<PilotSessionState>>
  decideFeedback(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  getCoachDashboard(programId: string): Promise<PilotOperationResult<PilotCoachDashboard>>
  getCoachParticipantDetail(
    programId: string,
    participantId: string,
  ): Promise<PilotOperationResult<PilotCoachParticipantDetail>>
  getParticipantRecord(programId: string): Promise<PilotOperationResult<PilotParticipantRecord>>
  getParticipantChange(programId: string): Promise<PilotOperationResult<PilotParticipantChange>>
  getParticipantFeed(programId: string): Promise<PilotOperationResult<PilotParticipantFeed>>
  getParticipantToday(programId: string): Promise<PilotOperationResult<PilotParticipantToday>>
  getAdminOverview(programId: string): Promise<PilotOperationResult<PilotAdminOverview>>
  getAdminActivity(programId: string): Promise<PilotOperationResult<readonly PilotAdminActivity[]>>
  getAdminMembers(programId: string): Promise<PilotOperationResult<PilotAdminMembers>>
  getAdminSchedule(programId: string): Promise<PilotOperationResult<PilotAdminSchedule>>
  getAdminSettings(programId: string): Promise<PilotOperationResult<PilotAdminSettings>>
  getAdminReport(programId: string): Promise<PilotOperationResult<PilotAdminReport>>
  getSession(): Promise<PilotOperationResult<PilotSessionState>>
  importActivityDraft(input: unknown): Promise<PilotOperationResult<PilotUploadReference>>
  grantMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  listAuditEvents(): Promise<PilotOperationResult<readonly PilotAuditEvent[]>>
  publishAnnouncement(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  publishAssignment(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  requestEmailOtp(input: unknown): Promise<PilotOperationResult<void>>
  revokeMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  saveActivityDraft(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  saveManualMetric(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  saveTimeTrial(input: unknown): Promise<PilotOperationResult<PilotTimeTrialSaveReference>>
  setPostHeart(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  signOut(): Promise<PilotOperationResult<void>>
  subscribeToSession(listener: (session: PilotSessionState) => void): () => void
}

export type PilotGatewayFactory = (config: SupabasePublicConfig) => PilotGateway

const ConsentGrantInputSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }),
    granteeProfileId: z.uuid(),
    granteeRole: z.enum(["admin", "coach", "stakeholder"]),
    metricRecordId: z.uuid(),
    purpose: z.string().trim().min(1).max(240),
  })
  .strict()
  .readonly()
const ConsentRevocationInputSchema = z
  .object({
    consentId: z.uuid(),
    reason: z.string().trim().min(1).max(500).optional(),
    revokedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .readonly()
const ConsentReferenceSchema = z.object({ id: z.uuid() }).strict().readonly()
const AuditEventRowsSchema = z
  .array(
    z
      .object({
        entity_id: z.uuid().nullable(),
        entity_type: z.string().min(1).max(80),
        event_type: z.string().min(3).max(100),
        id: z.number().int().positive(),
        occurred_at: z.iso.datetime({ offset: true }),
      })
      .strict()
      .readonly(),
  )
  .readonly()
const CoachDashboardSnapshotSchema = z
  .object({
    feedback_queue: z
      .array(
        z
          .object({
            body: z.string().min(1).max(2000),
            classification: z.enum(["low_risk", "training_change", "pain", "risk"]),
            created_at: z.iso.datetime({ offset: true }),
            feedback_id: z.uuid(),
            participant_id: z.uuid(),
            participant_name: z.string().min(1).max(80),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    participants: z
      .array(
        z
          .object({
            display_name: z.string().min(1).max(80),
            email: z.email().nullable(),
            joined_at: z.iso.datetime({ offset: true }),
            latest_metric_at: z.iso.datetime({ offset: true }).nullable(),
            membership_id: z.uuid(),
            metric_count_14d: z.number().int().nonnegative(),
            metric_count_prev_14d: z.number().int().nonnegative(),
            missing_homework_count: z.number().int().nonnegative(),
            pending_feedback_count: z.number().int().nonnegative(),
            profile_id: z.uuid(),
            risk: z.enum(["none", "pain", "risk"]),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    summary: z
      .object({
        missing_homework_count: z.number().int().nonnegative(),
        pain_risk_count: z.number().int().nonnegative(),
        pending_feedback_count: z.number().int().nonnegative(),
        stale_data_count: z.number().int().nonnegative(),
        total_participants: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
    time_trial: z
      .object({
        decided_at: z.iso.datetime({ offset: true }),
        initial_session_number: z.union([z.literal(1), z.literal(2)]),
        protocol: z.enum(["12_minute", "3k", "5k"]),
      })
      .strict()
      .readonly()
      .nullable(),
  })
  .strict()
  .readonly()
const CoachParticipantDetailSnapshotSchema = z
  .object({
    audit_events: z
      .array(
        z
          .object({
            details: z.record(z.string(), z.unknown()),
            entity_id: z.uuid().nullable(),
            entity_type: z.string().min(1).max(80),
            event_type: z.string().min(3).max(100),
            occurred_at: z.iso.datetime({ offset: true }),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    consented_metric_types: z.array(z.string().min(1)).readonly(),
    health_metric_types: z.array(z.string().min(1)).readonly(),
    profile: z
      .object({
        display_name: z.string().min(1).max(80),
        email: z.email().nullable(),
        profile_id: z.uuid(),
      })
      .strict()
      .readonly(),
    shared_metrics: z
      .array(
        z
          .object({
            metric_type: z.string().min(1).max(40),
            observed_at: z.iso.datetime({ offset: true }).nullable(),
            unit: z.string().min(1).max(10),
            value: z.number().nonnegative(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
  })
  .strict()
  .readonly()
const FeedbackDecisionInputSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    feedbackId: z.uuid(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .readonly()
const AssignmentPublishInputSchema = z
  .object({
    category: z.enum(["running", "health", "reflection"]),
    dueAt: z.iso.datetime({ offset: true }),
    instructions: z.string().trim().min(1).max(4000),
    programId: z.uuid(),
    title: z.string().trim().min(1).max(160),
  })
  .strict()
  .readonly()
const AnnouncementPublishInputSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    pinned: z.boolean(),
    programId: z.uuid(),
    title: z.string().trim().min(1).max(160),
  })
  .strict()
  .readonly()
const TimeTrialSaveInputSchema = z
  .object({
    programId: z.uuid(),
    protocol: z.enum(["12_minute", "3k", "5k"]),
    sessionNumber: z.union([z.literal(1), z.literal(2)]),
  })
  .strict()
  .readonly()
const SubmitReferenceSchema = z.object({ id: z.uuid() }).strict().readonly()
const TimeTrialSaveReferenceSchema = z.object({ program_id: z.uuid() }).strict().readonly()
const FeedbackReferenceSchema = z.uuid()
const ParticipantTodaySnapshotSchema = z
  .object({
    announcement: z
      .object({
        announcement_id: z.uuid(),
        body: z.string().min(1).max(5000),
        pinned: z.boolean(),
        published_at: z.iso.datetime({ offset: true }),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly()
      .nullable(),
    assignment: z
      .object({
        assignment_id: z.uuid(),
        assignment_kind: z.enum(["health", "reflection", "running"]),
        completed: z.boolean(),
        due_at: z.iso.datetime({ offset: true }).nullable(),
        instructions: z.string().min(1).max(4000),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly()
      .nullable(),
    backlog: z
      .array(
        z
          .object({
            assignment_id: z.uuid(),
            assignment_kind: z.enum(["health", "reflection", "running"]),
            completed: z.boolean(),
            due_at: z.iso.datetime({ offset: true }).nullable(),
            title: z.string().min(1).max(160),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    date_label: z.string().min(1).max(40),
    streak_days: z.number().int().nonnegative(),
    profile: z
      .object({
        display_name: z.string().min(1).max(80),
        profile_id: z.uuid(),
      })
      .strict()
      .readonly(),
    program: z
      .object({ title: z.string().min(1).max(160) })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()
const ParticipantFeedSnapshotSchema = z
  .object({
    posts: z
      .array(
        z
          .object({
            author_name: z.string().min(1).max(80),
            author_profile_id: z.uuid(),
            body: z.string().min(1).max(2000),
            comments: z
              .array(
                z
                  .object({
                    author_name: z.string().min(1).max(80),
                    body: z.string().min(1).max(1000),
                    comment_id: z.uuid(),
                    created_at: z.iso.datetime({ offset: true }),
                  })
                  .strict()
                  .readonly(),
              )
              .readonly(),
            created_at: z.iso.datetime({ offset: true }),
            heart_count: z.number().int().nonnegative(),
            is_hearted: z.boolean(),
            post_id: z.uuid(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
  })
  .strict()
  .readonly()
const ParticipantChangeSnapshotSchema = z
  .object({
    completion_percent: z.number().int().min(0).max(100),
    consent_history: z
      .array(
        z
          .object({
            audit_event_id: z.number().int().positive(),
            event_type: z.string().min(3).max(100),
            occurred_at: z.iso.datetime({ offset: true }),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    feedback: z
      .array(
        z
          .object({
            body: z.string().min(1).max(2000),
            classification: z.enum(["low_risk", "training_change", "pain", "risk"]),
            feedback_id: z.uuid(),
            origin: z.enum(["ai", "coach"]),
            published_at: z.iso.datetime({ offset: true }).nullable(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    heart_rate_consented: z.boolean(),
    metrics: z
      .array(
        z
          .object({
            count_14d: z.number().int().nonnegative(),
            metric_type: z.string().min(1).max(40),
            observed_at: z.iso.datetime({ offset: true }).nullable(),
            previous_observed_at: z.iso.datetime({ offset: true }).nullable(),
            previous_value: z.number().nonnegative().nullable(),
            unit: z.string().min(1).max(10),
            value: z.number().nonnegative(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    profile: z
      .object({
        display_name: z.string().min(1).max(80),
        profile_id: z.uuid(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()
const ParticipantRecordSnapshotSchema = z
  .object({
    recorded_on: z.iso.date(),
    supported_extensions: z.array(z.enum(["csv", "fit", "gpx", "tcx", "xml", "json"])).readonly(),
  })
  .strict()
  .readonly()
const ConsentToggleResultSchema = z
  .object({
    audit_event_id: z.number().int().positive().nullable().optional(),
    audit_event_type: z.string().min(3).max(100).nullable().optional(),
    status: z.enum(["disabled", "enabled", "unavailable"]),
  })
  .strict()
  .readonly()
const AdminOverviewSnapshotSchema = z
  .object({
    activity: z
      .array(
        z
          .object({
            actor_role: z.enum(["coach", "admin"]),
            audit_event_id: z.number().int().positive(),
            event_type: z.string().min(3).max(100),
            occurred_at: z.iso.datetime({ offset: true }),
            summary: z.string().min(1).max(2000),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    members: z
      .array(
        z
          .object({
            completion_percent: z.number().int().min(0).max(100),
            display_name: z.string().min(1).max(80),
            heart_rate_shared: z.boolean(),
            joined_at: z.iso.datetime({ offset: true }),
            profile_id: z.uuid(),
            role: z.enum(["participant", "coach", "admin", "stakeholder"]),
            status: z.enum(["active", "paused", "ended"]),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        status: z.enum(["draft", "active", "completed", "archived"]),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    summary: z
      .object({
        assignments_count: z.number().int().nonnegative(),
        consented_count: z.number().int().nonnegative(),
        pain_risk_count: z.number().int().nonnegative(),
        pending_feedback_count: z.number().int().nonnegative(),
        total_participants: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
    time_trial: z
      .object({
        decided_at: z.iso.datetime({ offset: true }),
        initial_session_number: z.union([z.literal(1), z.literal(2)]),
        protocol: z.enum(["12_minute", "3k", "5k"]),
      })
      .strict()
      .readonly()
      .nullable(),
  })
  .strict()
  .readonly()
const AdminActivitySnapshotSchema = z
  .array(
    z
      .object({
        actor_role: z.enum(["coach", "admin"]),
        audit_event_id: z.number().int().positive(),
        event_type: z.string().min(3).max(100),
        occurred_at: z.iso.datetime({ offset: true }),
        summary: z.string().min(1).max(2000),
      })
      .strict()
      .readonly(),
  )
  .readonly()
const AdminMembersSnapshotSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            completion_percent: z.number().int().min(0).max(100),
            display_name: z.string().min(1).max(80),
            email: z.email().nullable(),
            heart_rate_shared: z.boolean(),
            joined_at: z.iso.datetime({ offset: true }),
            membership_id: z.uuid(),
            profile_id: z.uuid(),
            role: z.enum(["participant", "coach", "admin", "stakeholder"]),
            status: z.enum(["active", "paused", "ended"]),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        status: z.enum(["draft", "active", "completed", "archived"]),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    summary: z
      .object({
        active_coaches: z.number().int().nonnegative(),
        active_participants: z.number().int().nonnegative(),
        consented_count: z.number().int().nonnegative(),
        total_members: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()
const AdminScheduleSnapshotSchema = z
  .object({
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        status: z.enum(["draft", "active", "completed", "archived"]),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    sessions: z
      .array(
        z
          .object({
            scheduled_at: z.iso.datetime({ offset: true }),
            session_id: z.uuid(),
            session_kind: z.enum([
              "easy",
              "onboarding",
              "recovery",
              "retest",
              "technique",
              "time_trial",
              "training",
            ]),
            session_number: z.number().int().positive(),
            title: z.string().min(1).max(160),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    summary: z
      .object({
        past_count: z.number().int().nonnegative(),
        time_trial: z
          .object({
            decided_at: z.iso.datetime({ offset: true }),
            initial_session_number: z.union([z.literal(1), z.literal(2)]),
            protocol: z.enum(["12_minute", "3k", "5k"]),
          })
          .strict()
          .readonly()
          .nullable(),
        total_sessions: z.number().int().nonnegative(),
        upcoming_count: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()
const AdminSettingsSnapshotSchema = z
  .object({
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        status: z.enum(["draft", "active", "completed", "archived"]),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    time_trial: z
      .object({
        decided_at: z.iso.datetime({ offset: true }),
        initial_session_number: z.union([z.literal(1), z.literal(2)]),
        protocol: z.enum(["12_minute", "3k", "5k"]),
      })
      .strict()
      .readonly()
      .nullable(),
    summary: z
      .object({
        deletion_request_count: z.number().int().nonnegative(),
        failed_notification_count: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
    deletion_requests: z
      .array(
        z
          .object({
            deletion_request_id: z.uuid(),
            profile_id: z.uuid(),
            display_name: z.string().min(1).max(80),
            status: z.enum(["cancelled", "completed", "processing", "requested"]),
            requested_at: z.iso.datetime({ offset: true }),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    failed_notifications: z
      .array(
        z
          .object({
            outbox_id: z.uuid(),
            notification_id: z.uuid(),
            channel: z.enum(["in_app", "push"]),
            title: z.string().min(1).max(160),
            status: z.enum(["cancelled", "failed", "pending", "processing", "sent"]),
            last_error_code: z.string().nullable(),
            attempt_count: z.number().int().nonnegative(),
            created_at: z.iso.datetime({ offset: true }),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
  })
  .strict()
  .readonly()
const AdminReportSnapshotSchema = z
  .object({
    program: z
      .object({
        ends_on: z.iso.date(),
        starts_on: z.iso.date(),
        status: z.enum(["draft", "active", "completed", "archived"]),
        title: z.string().min(1).max(160),
      })
      .strict()
      .readonly(),
    summary: z
      .object({
        released_count: z.number().int().nonnegative(),
        report_count: z.number().int().nonnegative(),
      })
      .strict()
      .readonly(),
    snapshots: z
      .array(
        z
          .object({
            snapshot_id: z.uuid(),
            calculation_version: z.string().min(1).max(80),
            status: z.enum(["draft", "frozen", "released", "superseded"]),
            generated_at: z.iso.datetime({ offset: true }),
            frozen_at: z.iso.datetime({ offset: true }).nullable(),
            released_at: z.iso.datetime({ offset: true }).nullable(),
            cells: z
              .array(
                z
                  .object({
                    row_key: z.string().min(1).max(80),
                    column_key: z.string().min(1).max(80),
                    participant_count: z.number().int().nonnegative().nullable(),
                    numeric_value: z.number().nullable(),
                    suppressed: z.boolean(),
                    suppression_reason: z.enum(["complementary", "primary"]).nullable(),
                  })
                  .strict()
                  .readonly(),
              )
              .readonly(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
  })
  .strict()
  .readonly()
const CompleteAssignmentInputSchema = z
  .object({ assignmentId: z.uuid(), programId: z.uuid() })
  .strict()
  .readonly()
const PostHeartInputSchema = z
  .object({ hearted: z.boolean(), postId: z.uuid() })
  .strict()
  .readonly()
const FeedCommentInputSchema = z
  .object({ body: z.string().trim().min(1).max(1000), postId: z.uuid() })
  .strict()
  .readonly()
const ManualMetricInputSchema = z
  .object({
    metricKey: z.enum(["distance_km", "duration_min", "resting_heart_rate", "sleep_hours"]),
    programId: z.uuid(),
    // 화면은 date-only(YYYY-MM-DD)를, 이전 클라이언트는 전체 datetime을 보낼 수 있다.
    recordedOn: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
    value: z.number().positive(),
  })
  .strict()
  .readonly()
const MetricConsentToggleInputSchema = z
  .object({ enabled: z.boolean(), programId: z.uuid() })
  .strict()
  .readonly()
const ImportActivityDraftInputSchema = z
  .object({
    draftRecords: z
      .array(
        z
          .object({
            metricType: z.enum(["distance_m", "duration_s", "heart_rate_bpm"]),
            numericValue: z.number().nonnegative(),
            observedAt: z.iso.datetime({ offset: true }),
            unit: z.enum(["bpm", "m", "s"]),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(50)
      .readonly(),
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().min(1).max(15_728_640),
    programId: z.uuid(),
    uploadKind: z.enum(["csv", "fit", "gpx", "json", "tcx", "xml"]),
  })
  .strict()
  .readonly()
const SaveActivityDraftInputSchema = z
  .object({ programId: z.uuid(), uploadId: z.uuid() })
  .strict()
  .readonly()
const ImportActivityDraftResultSchema = z
  .object({
    draft_count: z.number().int().nonnegative(),
    upload_id: z.uuid(),
  })
  .strict()
  .readonly()
const SaveActivityDraftResultSchema = z
  .object({
    accepted_count: z.number().int().positive(),
    status: z.literal("accepted"),
  })
  .strict()
  .readonly()
type CoachDashboardSnapshot = z.infer<typeof CoachDashboardSnapshotSchema>
type CoachParticipantDetailSnapshot = z.infer<typeof CoachParticipantDetailSnapshotSchema>
type ParticipantTodaySnapshot = z.infer<typeof ParticipantTodaySnapshotSchema>
type ParticipantFeedSnapshot = z.infer<typeof ParticipantFeedSnapshotSchema>
type ParticipantChangeSnapshot = z.infer<typeof ParticipantChangeSnapshotSchema>
type ParticipantRecordSnapshot = z.infer<typeof ParticipantRecordSnapshotSchema>
type ImportActivityDraftResult = z.infer<typeof ImportActivityDraftResultSchema>
type SaveActivityDraftResult = z.infer<typeof SaveActivityDraftResultSchema>
type ConsentToggleResult = z.infer<typeof ConsentToggleResultSchema>
type AdminOverviewSnapshot = z.infer<typeof AdminOverviewSnapshotSchema>
type AdminActivitySnapshot = z.infer<typeof AdminActivitySnapshotSchema>
type AdminMembersSnapshot = z.infer<typeof AdminMembersSnapshotSchema>
type AdminScheduleSnapshot = z.infer<typeof AdminScheduleSnapshotSchema>
type AdminSettingsSnapshot = z.infer<typeof AdminSettingsSnapshotSchema>
type AdminReportSnapshot = z.infer<typeof AdminReportSnapshotSchema>

function failure(
  kind: PilotOperationError["kind"],
  retryable = false,
): PilotOperationResult<never> {
  return { error: { kind, retryable }, ok: false }
}

async function authenticatedSession(
  client: PilotClient,
): Promise<PilotOperationResult<PilotClientSession>> {
  const result = await client.auth.getSession()
  if (!result.ok)
    return failure(
      result.error.kind === "network" ? "network" : "provider_error",
      result.error.retryable,
    )
  return result.value === null ? failure("signed_out") : { ok: true, value: result.value }
}

function consentResult(
  result: Awaited<ReturnType<PilotClient["execute"]>>,
): PilotOperationResult<PilotConsentReference> {
  if (!result.ok)
    return failure(
      result.error.kind === "network" ? "network" : "provider_error",
      result.error.retryable,
    )
  const parsed = ConsentReferenceSchema.safeParse(result.value)
  return parsed.success ? { ok: true, value: parsed.data } : failure("invalid_response")
}

function rpcFailure(
  result: Awaited<ReturnType<PilotClient["invokeRpc"]>>,
): PilotOperationResult<never> {
  if (result.ok) return failure("invalid_response")
  return failure(
    result.error.kind === "network" ? "network" : "provider_error",
    result.error.retryable,
  )
}

function executeFailure(
  result: Awaited<ReturnType<PilotClient["execute"]>>,
): PilotOperationResult<never> {
  if (result.ok) return failure("invalid_response")
  return failure(
    result.error.kind === "network" ? "network" : "provider_error",
    result.error.retryable,
  )
}

function submitResult(
  result: Awaited<ReturnType<PilotClient["execute"]>>,
): PilotOperationResult<PilotSubmitReference> {
  if (!result.ok) return executeFailure(result)
  const parsed = SubmitReferenceSchema.safeParse(result.value)
  return parsed.success ? { ok: true, value: parsed.data } : failure("invalid_response")
}

const PostReferenceSchema = z.object({ post_id: z.uuid() }).strict().readonly()

function postReference(
  result: Awaited<ReturnType<PilotClient["execute"]>>,
): PilotOperationResult<PilotSubmitReference> {
  if (!result.ok) return executeFailure(result)
  const parsed = PostReferenceSchema.safeParse(result.value)
  return parsed.success
    ? { ok: true, value: { id: parsed.data.post_id } }
    : failure("invalid_response")
}

function importActivityDraftFromResult(result: ImportActivityDraftResult): PilotUploadReference {
  return { draftCount: result.draft_count, uploadId: result.upload_id }
}

function saveActivityDraftFromResult(result: SaveActivityDraftResult): PilotSubmitReference {
  return { id: result.status }
}

function consentToggleFromResult(result: ConsentToggleResult): PilotConsentToggleResult {
  return {
    auditEventId: result.audit_event_id ?? null,
    auditEventType: result.audit_event_type ?? null,
    status: result.status,
  }
}

/** date-only(YYYY-MM-DD)는 자정(UTC) datetime으로 정규화해 metric_records.observed_at에 넣는다. */
function normalizeObservedAt(recordedOn: string): string {
  return recordedOn.length === 10 ? `${recordedOn}T00:00:00.000Z` : recordedOn
}

function manualMetricMapping(input: z.infer<typeof ManualMetricInputSchema>): {
  readonly metricType: "distance_m" | "duration_s" | "heart_rate_bpm" | "sleep_hours"
  readonly numericValue: number
  readonly sensitivity: "activity" | "health"
  readonly unit: "h" | "m" | "s" | "bpm"
  readonly verificationStatus: "accepted"
} {
  switch (input.metricKey) {
    case "distance_km":
      return {
        metricType: "distance_m",
        numericValue: input.value * 1000,
        sensitivity: "activity",
        unit: "m",
        verificationStatus: "accepted",
      }
    case "duration_min":
      return {
        metricType: "duration_s",
        numericValue: input.value * 60,
        sensitivity: "activity",
        unit: "s",
        verificationStatus: "accepted",
      }
    case "resting_heart_rate":
      return {
        metricType: "heart_rate_bpm",
        numericValue: input.value,
        sensitivity: "health",
        unit: "bpm",
        verificationStatus: "accepted",
      }
    case "sleep_hours":
      return {
        metricType: "sleep_hours",
        numericValue: input.value,
        sensitivity: "health",
        unit: "h",
        verificationStatus: "accepted",
      }
  }
}

function coachDashboardFromSnapshot(snapshot: CoachDashboardSnapshot): PilotCoachDashboard {
  return {
    feedbackQueue: snapshot.feedback_queue.map((item) => ({
      body: item.body,
      classification: item.classification,
      createdAt: item.created_at,
      feedbackId: item.feedback_id,
      participantId: item.participant_id,
      participantName: item.participant_name,
    })),
    participants: snapshot.participants.map((participant) => ({
      displayName: participant.display_name,
      email: participant.email,
      joinedAt: participant.joined_at,
      latestMetricAt: participant.latest_metric_at,
      membershipId: participant.membership_id,
      metricCount14d: participant.metric_count_14d,
      metricCountPrev14d: participant.metric_count_prev_14d,
      missingHomeworkCount: participant.missing_homework_count,
      pendingFeedbackCount: participant.pending_feedback_count,
      profileId: participant.profile_id,
      risk: participant.risk,
    })),
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      title: snapshot.program.title,
    },
    summary: {
      missingHomeworkCount: snapshot.summary.missing_homework_count,
      painRiskCount: snapshot.summary.pain_risk_count,
      pendingFeedbackCount: snapshot.summary.pending_feedback_count,
      staleDataCount: snapshot.summary.stale_data_count,
      totalParticipants: snapshot.summary.total_participants,
    },
    timeTrial:
      snapshot.time_trial === null
        ? null
        : {
            decidedAt: snapshot.time_trial.decided_at,
            initialSessionNumber: snapshot.time_trial.initial_session_number,
            protocol: snapshot.time_trial.protocol,
          },
  }
}

function participantTodayFromSnapshot(snapshot: ParticipantTodaySnapshot): PilotParticipantToday {
  return {
    announcement:
      snapshot.announcement === null
        ? null
        : {
            announcementId: snapshot.announcement.announcement_id,
            body: snapshot.announcement.body,
            pinned: snapshot.announcement.pinned,
            publishedAt: snapshot.announcement.published_at,
            title: snapshot.announcement.title,
          },
    assignment:
      snapshot.assignment === null
        ? null
        : {
            assignmentId: snapshot.assignment.assignment_id,
            assignmentKind: snapshot.assignment.assignment_kind,
            completed: snapshot.assignment.completed,
            dueAt: snapshot.assignment.due_at,
            instructions: snapshot.assignment.instructions,
            title: snapshot.assignment.title,
          },
    backlog: snapshot.backlog.map((item) => ({
      assignmentId: item.assignment_id,
      assignmentKind: item.assignment_kind,
      completed: item.completed,
      dueAt: item.due_at,
      title: item.title,
    })),
    dateLabel: snapshot.date_label,
    profile: {
      displayName: snapshot.profile.display_name,
      profileId: snapshot.profile.profile_id,
    },
    program: { title: snapshot.program.title },
    streakDays: snapshot.streak_days,
  }
}

function participantFeedFromSnapshot(snapshot: ParticipantFeedSnapshot): PilotParticipantFeed {
  return {
    posts: snapshot.posts.map((post) => ({
      authorName: post.author_name,
      authorProfileId: post.author_profile_id,
      body: post.body,
      comments: post.comments.map((comment) => ({
        authorName: comment.author_name,
        body: comment.body,
        commentId: comment.comment_id,
        createdAt: comment.created_at,
      })),
      createdAt: post.created_at,
      heartCount: post.heart_count,
      isHearted: post.is_hearted,
      postId: post.post_id,
    })),
  }
}

function participantRecordFromSnapshot(
  snapshot: ParticipantRecordSnapshot,
): PilotParticipantRecord {
  return {
    recordedOn: snapshot.recorded_on,
    supportedExtensions: snapshot.supported_extensions,
  }
}

function participantChangeFromSnapshot(
  snapshot: ParticipantChangeSnapshot,
): PilotParticipantChange {
  return {
    completionPercent: snapshot.completion_percent,
    consentHistory: snapshot.consent_history.map((event) => ({
      auditEventId: event.audit_event_id,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
    })),
    feedback: snapshot.feedback.map((item) => ({
      body: item.body,
      classification: item.classification,
      feedbackId: item.feedback_id,
      origin: item.origin,
      publishedAt: item.published_at,
    })),
    heartRateConsented: snapshot.heart_rate_consented,
    metrics: snapshot.metrics.map((metric) => ({
      count14d: metric.count_14d,
      metricType: metric.metric_type,
      observedAt: metric.observed_at,
      previousObservedAt: metric.previous_observed_at,
      previousValue: metric.previous_value,
      unit: metric.unit,
      value: metric.value,
    })),
    profile: {
      displayName: snapshot.profile.display_name,
      profileId: snapshot.profile.profile_id,
    },
  }
}

function adminOverviewFromSnapshot(snapshot: AdminOverviewSnapshot): PilotAdminOverview {
  return {
    activity: snapshot.activity.map((entry) => ({
      actorRole: entry.actor_role,
      auditEventId: entry.audit_event_id,
      eventType: entry.event_type,
      occurredAt: entry.occurred_at,
      summary: entry.summary,
    })),
    members: snapshot.members.map((member) => ({
      completionPercent: member.completion_percent,
      displayName: member.display_name,
      heartRateShared: member.heart_rate_shared,
      joinedAt: member.joined_at,
      profileId: member.profile_id,
      role: member.role,
      status: member.status,
    })),
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      status: snapshot.program.status,
      title: snapshot.program.title,
    },
    summary: {
      assignmentsCount: snapshot.summary.assignments_count,
      consentedCount: snapshot.summary.consented_count,
      painRiskCount: snapshot.summary.pain_risk_count,
      pendingFeedbackCount: snapshot.summary.pending_feedback_count,
      totalParticipants: snapshot.summary.total_participants,
    },
    timeTrial:
      snapshot.time_trial === null
        ? null
        : {
            decidedAt: snapshot.time_trial.decided_at,
            initialSessionNumber: snapshot.time_trial.initial_session_number,
            protocol: snapshot.time_trial.protocol,
          },
  }
}

function adminActivityFromSnapshot(snapshot: AdminActivitySnapshot): readonly PilotAdminActivity[] {
  return snapshot.map((entry) => ({
    actorRole: entry.actor_role,
    auditEventId: entry.audit_event_id,
    eventType: entry.event_type,
    occurredAt: entry.occurred_at,
    summary: entry.summary,
  }))
}

function adminMembersFromSnapshot(snapshot: AdminMembersSnapshot): PilotAdminMembers {
  return {
    members: snapshot.members.map((member) => ({
      completionPercent: member.completion_percent,
      displayName: member.display_name,
      email: member.email,
      heartRateShared: member.heart_rate_shared,
      joinedAt: member.joined_at,
      membershipId: member.membership_id,
      profileId: member.profile_id,
      role: member.role,
      status: member.status,
    })),
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      status: snapshot.program.status,
      title: snapshot.program.title,
    },
    summary: {
      activeCoaches: snapshot.summary.active_coaches,
      activeParticipants: snapshot.summary.active_participants,
      consentedCount: snapshot.summary.consented_count,
      totalMembers: snapshot.summary.total_members,
    },
  }
}

function adminScheduleFromSnapshot(snapshot: AdminScheduleSnapshot): PilotAdminSchedule {
  return {
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      status: snapshot.program.status,
      title: snapshot.program.title,
    },
    sessions: snapshot.sessions.map((session) => ({
      scheduledAt: session.scheduled_at,
      sessionId: session.session_id,
      sessionKind: session.session_kind,
      sessionNumber: session.session_number,
      title: session.title,
    })),
    summary: {
      pastCount: snapshot.summary.past_count,
      timeTrial:
        snapshot.summary.time_trial === null
          ? null
          : {
              decidedAt: snapshot.summary.time_trial.decided_at,
              initialSessionNumber: snapshot.summary.time_trial.initial_session_number,
              protocol: snapshot.summary.time_trial.protocol,
            },
      totalSessions: snapshot.summary.total_sessions,
      upcomingCount: snapshot.summary.upcoming_count,
    },
  }
}

function adminSettingsFromSnapshot(snapshot: AdminSettingsSnapshot): PilotAdminSettings {
  return {
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      status: snapshot.program.status,
      title: snapshot.program.title,
    },
    timeTrial:
      snapshot.time_trial === null
        ? null
        : {
            decidedAt: snapshot.time_trial.decided_at,
            initialSessionNumber: snapshot.time_trial.initial_session_number,
            protocol: snapshot.time_trial.protocol,
          },
    summary: {
      deletionRequestCount: snapshot.summary.deletion_request_count,
      failedNotificationCount: snapshot.summary.failed_notification_count,
    },
    deletionRequests: snapshot.deletion_requests.map((request) => ({
      deletionRequestId: request.deletion_request_id,
      profileId: request.profile_id,
      displayName: request.display_name,
      status: request.status,
      requestedAt: request.requested_at,
    })),
    failedNotifications: snapshot.failed_notifications.map((outbox) => ({
      outboxId: outbox.outbox_id,
      notificationId: outbox.notification_id,
      channel: outbox.channel,
      title: outbox.title,
      status: outbox.status,
      lastErrorCode: outbox.last_error_code,
      attemptCount: outbox.attempt_count,
      createdAt: outbox.created_at,
    })),
  }
}

function adminReportFromSnapshot(snapshot: AdminReportSnapshot): PilotAdminReport {
  return {
    program: {
      endsOn: snapshot.program.ends_on,
      startsOn: snapshot.program.starts_on,
      status: snapshot.program.status,
      title: snapshot.program.title,
    },
    summary: {
      releasedCount: snapshot.summary.released_count,
      reportCount: snapshot.summary.report_count,
    },
    snapshots: snapshot.snapshots.map((item) => ({
      calculationVersion: item.calculation_version,
      cells: item.cells.map((cell) => ({
        columnKey: cell.column_key,
        numericValue: cell.numeric_value,
        participantCount: cell.participant_count,
        rowKey: cell.row_key,
        suppressed: cell.suppressed,
        suppressionReason: cell.suppression_reason,
      })),
      frozenAt: item.frozen_at,
      generatedAt: item.generated_at,
      releasedAt: item.released_at,
      snapshotId: item.snapshot_id,
      status: item.status,
    })),
  }
}

function coachParticipantDetailFromSnapshot(
  snapshot: CoachParticipantDetailSnapshot,
): PilotCoachParticipantDetail {
  return {
    auditEvents: snapshot.audit_events.map((event) => ({
      details: event.details,
      entityId: event.entity_id,
      entityType: event.entity_type,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
    })),
    consentedMetricTypes: snapshot.consented_metric_types,
    healthMetricTypes: snapshot.health_metric_types,
    profile: {
      displayName: snapshot.profile.display_name,
      email: snapshot.profile.email,
      profileId: snapshot.profile.profile_id,
    },
    sharedMetrics: snapshot.shared_metrics.map((metric) => ({
      metricType: metric.metric_type,
      observedAt: metric.observed_at,
      unit: metric.unit,
      value: metric.value,
    })),
  }
}

export function createPilotGateway(client: PilotClient): PilotGateway {
  return {
    ...createPilotAuthGateway(client),
    grantMetricConsent: async (input) => {
      const parsed = ConsentGrantInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request")
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      return consentResult(
        await client.execute({
          kind: "grant_metric_consent",
          returning: "id",
          table: "metric_consents",
          values: {
            expires_at: parsed.data.expiresAt,
            grantee_profile_id: parsed.data.granteeProfileId,
            grantee_role: parsed.data.granteeRole,
            metric_record_id: parsed.data.metricRecordId,
            owner_profile_id: session.value.userId,
            purpose: parsed.data.purpose,
          },
        }),
      )
    },
    listAuditEvents: async () => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        columns: "id,event_type,entity_type,entity_id,occurred_at",
        kind: "list_audit_events",
        order: { ascending: false, column: "occurred_at" },
        page: { limit: 25, offset: 0 },
        table: "audit_events",
      })
      if (!result.ok)
        return failure(
          result.error.kind === "network" ? "network" : "provider_error",
          result.error.retryable,
        )
      const parsed = AuditEventRowsSchema.safeParse(result.value)
      if (!parsed.success) return failure("invalid_response")
      return {
        ok: true,
        value: parsed.data.map((event) => ({
          entityId: event.entity_id,
          entityType: event.entity_type,
          eventType: event.event_type,
          id: event.id,
          occurredAt: event.occurred_at,
        })),
      }
    },
    revokeMetricConsent: async (input) => {
      const parsed = ConsentRevocationInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request")
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const values =
        parsed.data.reason === undefined
          ? { revoked_at: parsed.data.revokedAt }
          : { revocation_reason: parsed.data.reason, revoked_at: parsed.data.revokedAt }
      return consentResult(
        await client.execute({
          filters: { id: parsed.data.consentId },
          kind: "revoke_metric_consent",
          returning: "id",
          table: "metric_consents",
          values,
        }),
      )
    },
    getCoachDashboard: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "coach_dashboard_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = CoachDashboardSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: coachDashboardFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getCoachParticipantDetail: async (programId, participantId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: {
          target_participant: participantId,
          target_program: programId,
        },
        function: "coach_participant_detail_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = CoachParticipantDetailSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: coachParticipantDetailFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    publishAssignment: async (input) => {
      const parsed = AssignmentPublishInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        kind: "publish_assignment",
        returning: "id",
        table: "assignments",
        values: {
          assignment_kind: parsed.data.category,
          created_by: session.value.userId,
          due_at: parsed.data.dueAt,
          instructions: parsed.data.instructions,
          program_id: parsed.data.programId,
          published_at: new Date().toISOString(),
          title: parsed.data.title,
        },
      })
      return submitResult(result)
    },
    publishAnnouncement: async (input) => {
      const parsed = AnnouncementPublishInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        kind: "publish_announcement",
        returning: "id",
        table: "announcements",
        values: {
          body: parsed.data.body,
          created_by: session.value.userId,
          pinned: parsed.data.pinned,
          program_id: parsed.data.programId,
          published_at: new Date().toISOString(),
          title: parsed.data.title,
        },
      })
      return submitResult(result)
    },
    decideFeedback: async (input) => {
      const parsed = FeedbackDecisionInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: {
          target_decision: parsed.data.decision,
          target_feedback: parsed.data.feedbackId,
          ...(parsed.data.note === undefined ? {} : { review_note: parsed.data.note }),
        },
        function: "review_feedback",
      })
      if (!result.ok) return rpcFailure(result)
      const reference = FeedbackReferenceSchema.safeParse(result.value)
      return reference.success
        ? { ok: true, value: { id: reference.data } }
        : failure("invalid_response", false)
    },
    saveTimeTrial: async (input) => {
      const parsed = TimeTrialSaveInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        filters: { program_id: parsed.data.programId },
        kind: "save_time_trial",
        onConflict: "program_id",
        returning: "program_id",
        table: "time_trial_decisions",
        values: {
          decided_at: new Date().toISOString(),
          decided_by: session.value.userId,
          initial_session_number: parsed.data.sessionNumber,
          program_id: parsed.data.programId,
          protocol: parsed.data.protocol,
        },
      })
      if (!result.ok) return executeFailure(result)
      const reference = TimeTrialSaveReferenceSchema.safeParse(result.value)
      return reference.success
        ? { ok: true, value: { programId: reference.data.program_id } }
        : failure("invalid_response", false)
    },
    getParticipantToday: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "participant_today_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = ParticipantTodaySnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: participantTodayFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminOverview: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_overview_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminOverviewSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminOverviewFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminActivity: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_activity_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminActivitySnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminActivityFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminMembers: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_members_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminMembersSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminMembersFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminSchedule: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_schedule_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminScheduleSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminScheduleFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminSettings: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_settings_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminSettingsSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminSettingsFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getAdminReport: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "admin_report_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = AdminReportSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: adminReportFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getParticipantFeed: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "participant_feed_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = ParticipantFeedSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: participantFeedFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getParticipantRecord: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "participant_record_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = ParticipantRecordSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: participantRecordFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    getParticipantChange: async (programId) => {
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: { target_program: programId },
        function: "participant_change_snapshot",
      })
      if (!result.ok) return rpcFailure(result)
      const parsed = ParticipantChangeSnapshotSchema.safeParse(result.value)
      return parsed.success
        ? { ok: true, value: participantChangeFromSnapshot(parsed.data) }
        : failure("invalid_response", false)
    },
    completeAssignment: async (input) => {
      const parsed = CompleteAssignmentInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        kind: "complete_assignment",
        returning: "id",
        table: "homework_submissions",
        values: {
          assignment_id: parsed.data.assignmentId,
          participant_id: session.value.userId,
          program_id: parsed.data.programId,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        },
      })
      return submitResult(result)
    },
    setPostHeart: async (input) => {
      const parsed = PostHeartInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      if (parsed.data.hearted) {
        const result = await client.execute({
          kind: "heart_post",
          returning: "post_id",
          table: "feed_reactions",
          values: {
            author_profile_id: session.value.userId,
            post_id: parsed.data.postId,
            reaction: "heart",
          },
        })
        return postReference(result)
      }
      const result = await client.execute({
        filters: {
          author_profile_id: session.value.userId,
          post_id: parsed.data.postId,
        },
        kind: "unheart_post",
        returning: "post_id",
        table: "feed_reactions",
      })
      return postReference(result)
    },
    addPostComment: async (input) => {
      const parsed = FeedCommentInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.execute({
        kind: "add_feed_comment",
        returning: "id",
        table: "feed_comments",
        values: {
          author_profile_id: session.value.userId,
          body: parsed.data.body,
          post_id: parsed.data.postId,
        },
      })
      return submitResult(result)
    },
    importActivityDraft: async (input) => {
      const parsed = ImportActivityDraftInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: {
          draft_records: parsed.data.draftRecords.map((record) => ({
            metric_type: record.metricType,
            numeric_value: record.numericValue,
            observed_at: record.observedAt,
            unit: record.unit,
          })),
          file_name: parsed.data.fileName,
          file_size: parsed.data.fileSize,
          target_program: parsed.data.programId,
          upload_kind: parsed.data.uploadKind,
        },
        function: "import_activity_draft",
      })
      if (!result.ok) return rpcFailure(result)
      const parsedResult = ImportActivityDraftResultSchema.safeParse(result.value)
      return parsedResult.success
        ? { ok: true, value: importActivityDraftFromResult(parsedResult.data) }
        : failure("invalid_response", false)
    },
    saveActivityDraft: async (input) => {
      const parsed = SaveActivityDraftInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: {
          target_program: parsed.data.programId,
          target_upload_id: parsed.data.uploadId,
        },
        function: "save_activity_draft",
      })
      if (!result.ok) return rpcFailure(result)
      const parsedResult = SaveActivityDraftResultSchema.safeParse(result.value)
      return parsedResult.success
        ? { ok: true, value: saveActivityDraftFromResult(parsedResult.data) }
        : failure("invalid_response", false)
    },
    saveManualMetric: async (input) => {
      const parsed = ManualMetricInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const mapped = manualMetricMapping(parsed.data)
      const result = await client.execute({
        kind: "save_manual_metric",
        returning: "id",
        table: "metric_records",
        values: {
          metric_type: mapped.metricType,
          numeric_value: mapped.numericValue,
          observed_at: normalizeObservedAt(parsed.data.recordedOn),
          owner_profile_id: session.value.userId,
          program_id: parsed.data.programId,
          sensitivity: mapped.sensitivity,
          source: "manual",
          unit: mapped.unit,
          verification_status: mapped.verificationStatus,
        },
      })
      return submitResult(result)
    },
    changeMetricConsent: async (input) => {
      const parsed = MetricConsentToggleInputSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const result = await client.invokeRpc({
        args: {
          target_enabled: parsed.data.enabled,
          target_program: parsed.data.programId,
        },
        function: "participant_set_metric_consent",
      })
      if (!result.ok) return rpcFailure(result)
      const parsedResult = ConsentToggleResultSchema.safeParse(result.value)
      return parsedResult.success
        ? { ok: true, value: consentToggleFromResult(parsedResult.data) }
        : failure("invalid_response", false)
    },
  }
}
