import { describe, expect, it } from "vitest"
import {
  createPilotGateway,
  type PilotClient,
  type PilotClientSession,
  type PilotDataRequest,
} from "./pilot-gateway.ts"

const AUDIT_ID = 17
const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111"
const CONSENT_ID = "33333333-3333-4333-8333-333333333333"
const FEEDBACK_ID = "55555555-5555-4555-8555-555555555555"
const GRANTEE_ID = "22222222-2222-4222-8222-222222222222"
const MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777"
const METRIC_ID = "44444444-4444-4444-8444-444444444444"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"
const NOTICE_ID = "88888888-8888-4888-8888-888888888888"
const ASSIGNMENT_ID = "99999999-9999-4999-8999-999999999999"

const DASHBOARD_SNAPSHOT = {
  feedback_queue: [
    {
      body: "왼쪽 무릎이 아파요",
      classification: "pain",
      created_at: "2026-08-25T09:00:00.000Z",
      feedback_id: FEEDBACK_ID,
      participant_id: GRANTEE_ID,
      participant_name: "김러너",
    },
  ],
  participants: [
    {
      display_name: "김러너",
      email: null,
      joined_at: "2026-08-24T00:00:00+09:00",
      latest_metric_at: "2026-08-25T08:00:00.000Z",
      membership_id: MEMBERSHIP_ID,
      metric_count_14d: 3,
      metric_count_prev_14d: 2,
      missing_homework_count: 1,
      pending_feedback_count: 1,
      profile_id: GRANTEE_ID,
      risk: "pain",
    },
  ],
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    title: "PLUS Run 2026",
  },
  summary: {
    missing_homework_count: 1,
    pain_risk_count: 1,
    pending_feedback_count: 1,
    stale_data_count: 0,
    total_participants: 1,
  },
  time_trial: {
    decided_at: "2026-08-25T09:00:00.000Z",
    initial_session_number: 1,
    protocol: "12_minute",
  },
} as const

const PARTICIPANT_DETAIL_SNAPSHOT = {
  audit_events: [
    {
      details: { metric_type: "heart_rate_bpm" },
      entity_id: CONSENT_ID,
      entity_type: "metric_consent",
      event_type: "consent.granted",
      occurred_at: "2026-08-25T08:00:00.000Z",
    },
    {
      details: {},
      entity_id: FEEDBACK_ID,
      entity_type: "feedback_item",
      event_type: "feedback.approved",
      occurred_at: "2026-08-25T09:00:00.000Z",
    },
  ],
  consented_metric_types: ["heart_rate_bpm"],
  health_metric_types: ["heart_rate_bpm", "weight_kg", "body_fat_pct", "pain_score", "other"],
  profile: {
    display_name: "김러너",
    email: null,
    profile_id: GRANTEE_ID,
  },
  shared_metrics: [
    {
      metric_type: "distance_m",
      observed_at: "2026-08-25T08:00:00.000Z",
      unit: "m",
      value: 5000,
    },
    {
      metric_type: "heart_rate_bpm",
      observed_at: "2026-08-25T07:30:00.000Z",
      unit: "bpm",
      value: 58,
    },
  ],
} as const

type FakePilotClient = PilotClient & {
  readonly dataRequests: PilotDataRequest[]
  readonly otpRequests: unknown[]
  readonly rpcRequests: unknown[]
  readonly signOutCalls: number[]
}

function createFakeClient(session: PilotClientSession | null): FakePilotClient {
  const dataRequests: PilotDataRequest[] = []
  const otpRequests: unknown[] = []
  const rpcRequests: unknown[] = []
  const signOutCalls: number[] = []
  let currentSession = session

  return {
    auth: {
      clearSession: () => undefined,
      exchangeCodeForSession: async () => {
        currentSession = { email: "runner@example.com", userId: AUTH_USER_ID }
        return { ok: true, value: currentSession }
      },
      getSession: async () => ({ ok: true, value: currentSession }),
      signInWithOtp: async (input) => {
        otpRequests.push(input)
        return { ok: true, value: undefined }
      },
      signOut: async () => {
        signOutCalls.push(1)
        return { ok: true, value: undefined }
      },
      subscribeToSession: () => () => undefined,
    },
    dataRequests,
    execute: async (request) => {
      dataRequests.push(request)
      switch (request.kind) {
        case "grant_metric_consent":
        case "revoke_metric_consent":
          return { ok: true, value: { id: CONSENT_ID } }
        case "list_audit_events":
          return {
            ok: true,
            value: [
              {
                entity_id: CONSENT_ID,
                entity_type: "metric_consent",
                event_type: "consent.granted",
                id: AUDIT_ID,
                occurred_at: "2026-08-01T10:00:00.000Z",
              },
            ],
          }
        case "publish_announcement":
          return { ok: true, value: { id: NOTICE_ID } }
        case "publish_assignment":
          return { ok: true, value: { id: ASSIGNMENT_ID } }
        case "save_time_trial":
          return { ok: true, value: { program_id: PROGRAM_ID } }
      }
    },
    invokeFunction: async () => ({ ok: true, value: null }),
    invokeRpc: async (request) => {
      rpcRequests.push(request)
      switch (request.function) {
        case "bootstrap_pilot_membership":
          return {
            ok: true,
            value: {
              membership_id: MEMBERSHIP_ID,
              program_id: PROGRAM_ID,
              role: "participant",
              status: "active",
            },
          }
        case "coach_dashboard_snapshot":
          return { ok: true, value: DASHBOARD_SNAPSHOT }
        case "coach_participant_detail_snapshot":
          return { ok: true, value: PARTICIPANT_DETAIL_SNAPSHOT }
        case "review_feedback":
          return { ok: true, value: FEEDBACK_ID }
      }
    },
    otpRequests,
    rpcRequests,
    signOutCalls,
    subscribe: () => ({
      ready: Promise.resolve({ ok: true, value: { revision: 1 } }),
      unsubscribe: () => undefined,
    }),
  }
}

describe("Supabase pilot gateway", () => {
  it("maps the authenticated provider session into the public auth facade", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getSession()

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "active",
        membership: {
          email: "runner@example.com",
          membershipId: MEMBERSHIP_ID,
          programId: PROGRAM_ID,
          role: "participant",
          route: "/today",
          userId: AUTH_USER_ID,
        },
      },
    })
  })

  it("requests OTP without implicit signup or caller identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.requestEmailOtp({
      callbackUrl: "https://pilot.example.com/auth/callback",
      email: "runner@example.com",
    })

    // Then
    expect(result).toEqual({ ok: true, value: undefined })
    expect(client.otpRequests).toEqual([
      {
        email: "runner@example.com",
        options: {
          emailRedirectTo: "https://pilot.example.com/auth/callback",
          shouldCreateUser: false,
        },
      },
    ])
    expect(client.rpcRequests).toEqual([])
  })

  it("exchanges a callback code and atomically resolves the active membership route", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.completeAuthCallback({
      callbackUrl: "https://pilot.example.com/auth/callback?code=single-use-code",
    })

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "active",
        membership: {
          email: "runner@example.com",
          membershipId: MEMBERSHIP_ID,
          programId: PROGRAM_ID,
          role: "participant",
          route: "/today",
          userId: AUTH_USER_ID,
        },
      },
    })
  })

  it("rejects malformed email and caller identity or service-secret fields", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.requestEmailOtp({
      email: "invalid-email",
      serviceRoleKey: "forbidden",
      userId: AUTH_USER_ID,
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "invalid_request", retryable: false } })
    expect(client.otpRequests).toEqual([])
  })

  it("signs out through the injected auth client", async () => {
    // Given
    const client = createFakeClient({ email: null, userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.signOut()

    // Then
    expect(result).toEqual({ ok: true, value: undefined })
    expect(client.signOutCalls).toEqual([1])
  })

  it("serializes a consent grant with owner identity from auth and SQL column names", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.grantMetricConsent({
      expiresAt: "2026-09-01T10:00:00.000Z",
      granteeProfileId: GRANTEE_ID,
      granteeRole: "coach",
      metricRecordId: METRIC_ID,
      purpose: "주간 훈련 검토",
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: CONSENT_ID } })
    expect(JSON.parse(JSON.stringify(client.dataRequests))).toEqual([
      {
        kind: "grant_metric_consent",
        returning: "id",
        table: "metric_consents",
        values: {
          expires_at: "2026-09-01T10:00:00.000Z",
          grantee_profile_id: GRANTEE_ID,
          grantee_role: "coach",
          metric_record_id: METRIC_ID,
          owner_profile_id: AUTH_USER_ID,
          purpose: "주간 훈련 검토",
        },
      },
    ])
  })

  it("rejects caller identity and service secrets from consent input", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.grantMetricConsent({
      expiresAt: "2026-09-01T10:00:00.000Z",
      granteeProfileId: GRANTEE_ID,
      granteeRole: "coach",
      metricRecordId: METRIC_ID,
      purpose: "주간 훈련 검토",
      serviceRoleKey: "forbidden",
      userId: "55555555-5555-4555-8555-555555555555",
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "invalid_request", retryable: false } })
    expect(client.dataRequests).toEqual([])
  })

  it("fails a consent write when no authenticated identity exists", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.grantMetricConsent({
      expiresAt: "2026-09-01T10:00:00.000Z",
      granteeProfileId: GRANTEE_ID,
      granteeRole: "coach",
      metricRecordId: METRIC_ID,
      purpose: "주간 훈련 검토",
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.dataRequests).toEqual([])
  })

  it("serializes consent revocation without mutable grant or identity fields", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.revokeMetricConsent({
      consentId: CONSENT_ID,
      reason: "운영 검토 종료",
      revokedAt: "2026-08-15T10:00:00.000Z",
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: CONSENT_ID } })
    expect(client.dataRequests).toEqual([
      {
        filters: { id: CONSENT_ID },
        kind: "revoke_metric_consent",
        returning: "id",
        table: "metric_consents",
        values: {
          revocation_reason: "운영 검토 종료",
          revoked_at: "2026-08-15T10:00:00.000Z",
        },
      },
    ])
  })

  it("reads the trigger-owned audit projection without accepting an identity parameter", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.listAuditEvents()

    // Then
    expect(result).toEqual({
      ok: true,
      value: [
        {
          entityId: CONSENT_ID,
          entityType: "metric_consent",
          eventType: "consent.granted",
          id: AUDIT_ID,
          occurredAt: "2026-08-01T10:00:00.000Z",
        },
      ],
    })
    expect(client.dataRequests).toEqual([
      {
        columns: "id,event_type,entity_type,entity_id,occurred_at",
        kind: "list_audit_events",
        order: { ascending: false, column: "occurred_at" },
        page: { limit: 25, offset: 0 },
        table: "audit_events",
      },
    ])
  })

  it("maps the coach dashboard snapshot into the public dashboard model", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getCoachDashboard(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        feedbackQueue: [
          {
            body: "왼쪽 무릎이 아파요",
            classification: "pain",
            createdAt: "2026-08-25T09:00:00.000Z",
            feedbackId: FEEDBACK_ID,
            participantId: GRANTEE_ID,
            participantName: "김러너",
          },
        ],
        participants: [
          {
            displayName: "김러너",
            email: null,
            joinedAt: "2026-08-24T00:00:00+09:00",
            latestMetricAt: "2026-08-25T08:00:00.000Z",
            membershipId: MEMBERSHIP_ID,
            metricCount14d: 3,
            metricCountPrev14d: 2,
            missingHomeworkCount: 1,
            pendingFeedbackCount: 1,
            profileId: GRANTEE_ID,
            risk: "pain",
          },
        ],
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          title: "PLUS Run 2026",
        },
        summary: {
          missingHomeworkCount: 1,
          painRiskCount: 1,
          pendingFeedbackCount: 1,
          staleDataCount: 0,
          totalParticipants: 1,
        },
        timeTrial: {
          decidedAt: "2026-08-25T09:00:00.000Z",
          initialSessionNumber: 1,
          protocol: "12_minute",
        },
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "coach_dashboard_snapshot" },
    ])
  })

  it("maps the participant detail snapshot with shared and private metrics", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getCoachParticipantDetail(PROGRAM_ID, GRANTEE_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.profile).toEqual({
      displayName: "김러너",
      email: null,
      profileId: GRANTEE_ID,
    })
    expect(result.value.consentedMetricTypes).toEqual(["heart_rate_bpm"])
    expect(result.value.sharedMetrics).toEqual([
      {
        metricType: "distance_m",
        observedAt: "2026-08-25T08:00:00.000Z",
        unit: "m",
        value: 5000,
      },
      {
        metricType: "heart_rate_bpm",
        observedAt: "2026-08-25T07:30:00.000Z",
        unit: "bpm",
        value: 58,
      },
    ])
    expect(result.value.auditEvents).toHaveLength(2)
    expect(result.value.auditEvents[0]).toMatchObject({
      entityId: CONSENT_ID,
      entityType: "metric_consent",
      eventType: "consent.granted",
    })
    expect(client.rpcRequests).toEqual([
      {
        args: { target_participant: GRANTEE_ID, target_program: PROGRAM_ID },
        function: "coach_participant_detail_snapshot",
      },
    ])
  })

  it("serializes an assignment publish with coach identity and publish time", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.publishAssignment({
      category: "running",
      dueAt: "2026-09-01T14:59:59.000Z",
      instructions: "이지런 30분, 심박 존 2 유지",
      programId: PROGRAM_ID,
      title: "주 1회 이지런",
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: ASSIGNMENT_ID } })
    const request = client.dataRequests.at(-1)
    expect(request).toMatchObject({
      kind: "publish_assignment",
      returning: "id",
      table: "assignments",
    })
    if (request?.kind !== "publish_assignment") return
    expect(request.values).toMatchObject({
      assignment_kind: "running",
      created_by: AUTH_USER_ID,
      due_at: "2026-09-01T14:59:59.000Z",
      instructions: "이지런 30분, 심박 존 2 유지",
      program_id: PROGRAM_ID,
      title: "주 1회 이지런",
    })
    expect(typeof request.values.published_at).toBe("string")
  })

  it("serializes an announcement publish including the pinned flag", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.publishAnnouncement({
      body: "다음 주 월요일은 이지런으로 대체합니다.",
      pinned: true,
      programId: PROGRAM_ID,
      title: "일정 변경 안내",
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: NOTICE_ID } })
    const request = client.dataRequests.at(-1)
    if (request?.kind !== "publish_announcement") return
    expect(request.values).toMatchObject({
      body: "다음 주 월요일은 이지런으로 대체합니다.",
      created_by: AUTH_USER_ID,
      pinned: true,
      program_id: PROGRAM_ID,
      title: "일정 변경 안내",
    })
  })

  it("reviews feedback through the shared RPC and wraps the returned id", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.decideFeedback({
      decision: "approved",
      feedbackId: FEEDBACK_ID,
      note: "통증 확인, 회복 강조",
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: FEEDBACK_ID } })
    expect(client.rpcRequests).toEqual([
      {
        args: {
          target_decision: "approved",
          target_feedback: FEEDBACK_ID,
          review_note: "통증 확인, 회복 강조",
        },
        function: "review_feedback",
      },
    ])
  })

  it("upserts a time-trial decision with the callers identity mapped to decided_by", async () => {
    // Given
    const client = createFakeClient({ email: "coach@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveTimeTrial({
      programId: PROGRAM_ID,
      protocol: "3k",
      sessionNumber: 2,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { programId: PROGRAM_ID } })
    const request = client.dataRequests.at(-1)
    if (request?.kind !== "save_time_trial") return
    expect(request).toMatchObject({
      filters: { program_id: PROGRAM_ID },
      kind: "save_time_trial",
      onConflict: "program_id",
      returning: "program_id",
      table: "time_trial_decisions",
    })
    expect(request.values).toMatchObject({
      decided_by: AUTH_USER_ID,
      initial_session_number: 2,
      program_id: PROGRAM_ID,
      protocol: "3k",
    })
    expect(typeof request.values.decided_at).toBe("string")
  })

  it("rejects coach mutations when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const assignment = await gateway.publishAssignment({
      category: "health",
      dueAt: "2026-09-01T14:59:59.000Z",
      instructions: "아침 안정 시 심박수 기록",
      programId: PROGRAM_ID,
      title: "건강 체크",
    })
    const timeTrial = await gateway.saveTimeTrial({
      programId: PROGRAM_ID,
      protocol: "5k",
      sessionNumber: 1,
    })

    // Then
    expect(assignment).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(timeTrial).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.dataRequests).toEqual([])
    expect(client.rpcRequests).toEqual([])
  })
})
