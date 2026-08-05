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

export interface PilotGateway {
  completeAuthCallback(input: unknown): Promise<PilotOperationResult<PilotSessionState>>
  decideFeedback(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  getCoachDashboard(programId: string): Promise<PilotOperationResult<PilotCoachDashboard>>
  getCoachParticipantDetail(
    programId: string,
    participantId: string,
  ): Promise<PilotOperationResult<PilotCoachParticipantDetail>>
  getSession(): Promise<PilotOperationResult<PilotSessionState>>
  grantMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  listAuditEvents(): Promise<PilotOperationResult<readonly PilotAuditEvent[]>>
  publishAnnouncement(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  publishAssignment(input: unknown): Promise<PilotOperationResult<PilotSubmitReference>>
  requestEmailOtp(input: unknown): Promise<PilotOperationResult<void>>
  revokeMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  saveTimeTrial(input: unknown): Promise<PilotOperationResult<PilotTimeTrialSaveReference>>
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
type CoachDashboardSnapshot = z.infer<typeof CoachDashboardSnapshotSchema>
type CoachParticipantDetailSnapshot = z.infer<typeof CoachParticipantDetailSnapshotSchema>

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
  }
}
