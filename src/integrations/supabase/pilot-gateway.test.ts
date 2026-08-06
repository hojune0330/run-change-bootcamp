import { describe, expect, it } from "vitest"
import {
  createPilotGateway,
  type PilotClient,
  type PilotClientSession,
  type PilotDataRequest,
} from "./pilot-gateway.ts"

const ASSIGNMENT_ID = "99999999-9999-4999-8999-999999999999"
const AUDIT_ID = 17
const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111"
const CONSENT_ID = "33333333-3333-4333-8333-333333333333"
const COMMENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const DELETION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const FEEDBACK_ID = "55555555-5555-4555-8555-555555555555"
const GRANTEE_ID = "22222222-2222-4222-8222-222222222222"
const MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777"
const METRIC_ID = "44444444-4444-4444-8444-444444444444"
const NOTICE_ID = "88888888-8888-4888-8888-888888888888"
const OUTBOX_ID = "12121212-1212-4121-8121-121212121212"
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"
const SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const SUBMISSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const UPLOAD_ID = "abababab-abab-4bab-8bab-abababababab"

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

const TODAY_SNAPSHOT = {
  announcement: {
    announcement_id: NOTICE_ID,
    body: "다음 주 월요일은 이지런으로 대체합니다.",
    pinned: true,
    published_at: "2026-08-25T09:00:00.000Z",
    title: "일정 변경 안내",
  },
  assignment: {
    assignment_id: ASSIGNMENT_ID,
    assignment_kind: "running",
    completed: false,
    due_at: "2026-09-01T14:59:59.000Z",
    instructions: "이지런 30분, 심박 존 2 유지",
    title: "주 1회 이지런",
  },
  backlog: [],
  date_label: "8월 31일 월요일",
  profile: { display_name: "김러너", profile_id: GRANTEE_ID },
  program: { title: "PLUS Run 2026" },
  streak_days: 0,
} as const

const FEED_SNAPSHOT = {
  posts: [
    {
      author_name: "김러너",
      author_profile_id: GRANTEE_ID,
      body: "주말 이지런 완료했어요.",
      comments: [
        {
          author_name: "박코치",
          body: "페이스 좋아요!",
          comment_id: COMMENT_ID,
          created_at: "2026-08-25T10:00:00.000Z",
        },
      ],
      created_at: "2026-08-25T09:30:00.000Z",
      heart_count: 3,
      is_hearted: true,
      post_id: POST_ID,
    },
  ],
} as const

const ADMIN_ACTIVITY_SNAPSHOT = [
  {
    actor_role: "coach",
    audit_event_id: AUDIT_ID,
    event_type: "feedback.approved",
    occurred_at: "2026-08-25T09:00:00.000Z",
    summary: "김러너 이지런 피드백 승인",
  },
  {
    actor_role: "admin",
    audit_event_id: AUDIT_ID + 1,
    event_type: "feedback.rejected",
    occurred_at: "2026-08-25T09:10:00.000Z",
    summary: "박러너 통증 자가 보고 반려",
  },
] as const

const ADMIN_MEMBERS_SNAPSHOT = {
  members: [
    {
      completion_percent: 60,
      display_name: "김러너",
      email: "runner@example.com",
      heart_rate_shared: true,
      joined_at: "2026-08-24T09:00:00.000Z",
      membership_id: MEMBERSHIP_ID,
      profile_id: GRANTEE_ID,
      role: "participant",
      status: "active",
    },
  ],
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    status: "active",
    title: "PLUS Run",
  },
  summary: {
    active_coaches: 1,
    active_participants: 1,
    consented_count: 1,
    total_members: 2,
  },
} as const

const ADMIN_SCHEDULE_SNAPSHOT = {
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    status: "active",
    title: "PLUS Run",
  },
  sessions: [
    {
      scheduled_at: "2026-08-26T19:00:00.000Z",
      session_id: SESSION_ID,
      session_kind: "time_trial",
      session_number: 1,
      title: "기록 측정 1회차",
    },
    {
      scheduled_at: "2026-08-29T19:00:00.000Z",
      session_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      session_kind: "easy",
      session_number: 2,
      title: "이지런 2회차",
    },
  ],
  summary: {
    past_count: 1,
    time_trial: {
      decided_at: "2026-08-25T09:00:00.000Z",
      initial_session_number: 1,
      protocol: "12_minute",
    },
    total_sessions: 2,
    upcoming_count: 1,
  },
} as const

const ADMIN_SETTINGS_SNAPSHOT = {
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    status: "active",
    title: "PLUS Run",
  },
  time_trial: {
    decided_at: "2026-08-25T09:00:00.000Z",
    initial_session_number: 1,
    protocol: "12_minute",
  },
  summary: {
    deletion_request_count: 1,
    failed_notification_count: 1,
  },
  deletion_requests: [
    {
      deletion_request_id: DELETION_ID,
      profile_id: GRANTEE_ID,
      display_name: "김러너",
      status: "requested",
      requested_at: "2026-08-26T09:00:00.000Z",
    },
  ],
  failed_notifications: [
    {
      outbox_id: OUTBOX_ID,
      notification_id: NOTICE_ID,
      channel: "push",
      title: "일정 변경 안내",
      status: "failed",
      last_error_code: "push_provider_error",
      attempt_count: 3,
      created_at: "2026-08-25T09:30:00.000Z",
    },
  ],
} as const

const ADMIN_REPORT_SNAPSHOT = {
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    status: "active",
    title: "PLUS Run",
  },
  summary: {
    report_count: 1,
    released_count: 1,
  },
  snapshots: [
    {
      snapshot_id: "43434343-4343-4434-8434-434343434343",
      calculation_version: "plus_run_measurement_v1",
      status: "released",
      generated_at: "2026-08-25T09:00:00.000Z",
      frozen_at: "2026-08-25T09:00:00.000Z",
      released_at: "2026-08-26T09:00:00.000Z",
      cells: [
        {
          row_key: "cohort",
          column_key: "all_participants",
          participant_count: 20,
          numeric_value: 42,
          suppressed: false,
          suppression_reason: null,
        },
      ],
    },
  ],
} as const

const ADMIN_OVERVIEW_SNAPSHOT = {
  activity: [
    {
      actor_role: "coach",
      audit_event_id: AUDIT_ID,
      event_type: "feedback.approved",
      occurred_at: "2026-08-25T09:00:00.000Z",
      summary: "김러너 이지런 피드백 승인",
    },
  ],
  members: [
    {
      completion_percent: 50,
      display_name: "김러너",
      heart_rate_shared: true,
      joined_at: "2026-08-24T00:00:00+09:00",
      profile_id: GRANTEE_ID,
      role: "participant",
      status: "active",
    },
  ],
  program: {
    ends_on: "2026-10-24",
    starts_on: "2026-08-24",
    status: "active",
    title: "PLUS Run 2026",
  },
  summary: {
    assignments_count: 4,
    consented_count: 1,
    pain_risk_count: 1,
    pending_feedback_count: 2,
    total_participants: 1,
  },
  time_trial: {
    decided_at: "2026-08-25T09:00:00.000Z",
    initial_session_number: 1,
    protocol: "12_minute",
  },
} as const

const CHANGE_SNAPSHOT = {
  completion_percent: 20,
  consent_history: [
    {
      audit_event_id: AUDIT_ID,
      event_type: "consent.granted",
      occurred_at: "2026-08-25T08:00:00.000Z",
    },
  ],
  feedback: [
    {
      body: "이지런 페이스가 안정되고 있어요.",
      classification: "low_risk",
      feedback_id: FEEDBACK_ID,
      origin: "ai",
      published_at: "2026-08-25T09:00:00.000Z",
    },
  ],
  heart_rate_consented: true,
  metrics: [
    {
      count_14d: 3,
      metric_type: "distance_m",
      observed_at: "2026-08-25T08:00:00.000Z",
      previous_observed_at: null,
      previous_value: null,
      unit: "m",
      value: 5000,
    },
    {
      count_14d: 2,
      metric_type: "heart_rate_bpm",
      observed_at: "2026-08-25T07:30:00.000Z",
      previous_observed_at: null,
      previous_value: null,
      unit: "bpm",
      value: 58,
    },
  ],
  profile: { display_name: "김러너", profile_id: GRANTEE_ID },
} as const

const PARTICIPANT_RECORD_SNAPSHOT = {
  recorded_on: "2026-08-26",
  supported_extensions: ["csv", "fit", "gpx", "tcx", "xml", "json"],
} as const

type FakePilotClient = PilotClient & {
  readonly consentToggleResult: { value: unknown }
  readonly dataRequests: PilotDataRequest[]
  readonly otpRequests: unknown[]
  readonly rpcRequests: unknown[]
  readonly signOutCalls: number[]
}

function createFakeClient(session: PilotClientSession | null): FakePilotClient {
  const consentToggleResult: { value: unknown } = {
    value: { audit_event_id: AUDIT_ID, audit_event_type: "consent.granted", status: "enabled" },
  }
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
        case "complete_assignment":
          return { ok: true, value: { id: SUBMISSION_ID } }
        case "heart_post":
          return { ok: true, value: { post_id: POST_ID } }
        case "unheart_post":
          return { ok: true, value: { post_id: POST_ID } }
        case "add_feed_comment":
          return { ok: true, value: { id: COMMENT_ID } }
        case "save_manual_metric":
          return { ok: true, value: { id: METRIC_ID } }
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
        case "participant_today_snapshot":
          return { ok: true, value: TODAY_SNAPSHOT }
        case "participant_feed_snapshot":
          return { ok: true, value: FEED_SNAPSHOT }
        case "participant_change_snapshot":
          return { ok: true, value: CHANGE_SNAPSHOT }
        case "participant_record_snapshot":
          return { ok: true, value: PARTICIPANT_RECORD_SNAPSHOT }
        case "import_activity_draft":
          return { ok: true, value: { draft_count: 6, upload_id: UPLOAD_ID } }
        case "save_activity_draft":
          return {
            ok: true,
            value: { accepted_count: 6, status: "accepted" },
          }
        case "participant_set_metric_consent":
          return { ok: true, value: consentToggleResult.value }
        case "admin_overview_snapshot":
          return { ok: true, value: ADMIN_OVERVIEW_SNAPSHOT }
        case "admin_activity_snapshot":
          return { ok: true, value: ADMIN_ACTIVITY_SNAPSHOT }
        case "admin_members_snapshot":
          return { ok: true, value: ADMIN_MEMBERS_SNAPSHOT }
        case "admin_schedule_snapshot":
          return { ok: true, value: ADMIN_SCHEDULE_SNAPSHOT }
        case "admin_settings_snapshot":
          return { ok: true, value: ADMIN_SETTINGS_SNAPSHOT }
        case "admin_report_snapshot":
          return { ok: true, value: ADMIN_REPORT_SNAPSHOT }
      }
    },
    consentToggleResult,
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

  it("maps the participant today snapshot with published assignment and notice", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getParticipantToday(PROGRAM_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      announcement: {
        announcementId: NOTICE_ID,
        body: "다음 주 월요일은 이지런으로 대체합니다.",
        pinned: true,
        publishedAt: "2026-08-25T09:00:00.000Z",
        title: "일정 변경 안내",
      },
      assignment: {
        assignmentId: ASSIGNMENT_ID,
        assignmentKind: "running",
        completed: false,
        dueAt: "2026-09-01T14:59:59.000Z",
        instructions: "이지런 30분, 심박 존 2 유지",
        title: "주 1회 이지런",
      },
      backlog: [],
      dateLabel: "8월 31일 월요일",
      profile: { displayName: "김러너", profileId: GRANTEE_ID },
      program: { title: "PLUS Run 2026" },
      streakDays: 0,
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "participant_today_snapshot" },
    ])
  })

  it("maps the participant feed snapshot with comments and heart state", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getParticipantFeed(PROGRAM_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.posts).toHaveLength(1)
    expect(result.value.posts[0]).toEqual({
      authorName: "김러너",
      authorProfileId: GRANTEE_ID,
      body: "주말 이지런 완료했어요.",
      comments: [
        {
          authorName: "박코치",
          body: "페이스 좋아요!",
          commentId: COMMENT_ID,
          createdAt: "2026-08-25T10:00:00.000Z",
        },
      ],
      createdAt: "2026-08-25T09:30:00.000Z",
      heartCount: 3,
      isHearted: true,
      postId: POST_ID,
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "participant_feed_snapshot" },
    ])
  })

  it("maps the participant change snapshot with metrics, feedback and consent history", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getParticipantChange(PROGRAM_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.completionPercent).toBe(20)
    expect(result.value.heartRateConsented).toBe(true)
    expect(result.value.metrics).toEqual([
      {
        count14d: 3,
        metricType: "distance_m",
        observedAt: "2026-08-25T08:00:00.000Z",
        previousObservedAt: null,
        previousValue: null,
        unit: "m",
        value: 5000,
      },
      {
        count14d: 2,
        metricType: "heart_rate_bpm",
        observedAt: "2026-08-25T07:30:00.000Z",
        previousObservedAt: null,
        previousValue: null,
        unit: "bpm",
        value: 58,
      },
    ])
    expect(result.value.feedback[0]).toMatchObject({
      body: "이지런 페이스가 안정되고 있어요.",
      classification: "low_risk",
      feedbackId: FEEDBACK_ID,
      origin: "ai",
    })
    expect(result.value.consentHistory).toEqual([
      {
        auditEventId: AUDIT_ID,
        eventType: "consent.granted",
        occurredAt: "2026-08-25T08:00:00.000Z",
      },
    ])
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "participant_change_snapshot" },
    ])
  })

  it("serializes an assignment completion with participant identity and submit time", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.completeAssignment({
      assignmentId: ASSIGNMENT_ID,
      programId: PROGRAM_ID,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: SUBMISSION_ID } })
    const request = client.dataRequests.at(-1)
    if (request?.kind !== "complete_assignment") return
    expect(request).toMatchObject({
      kind: "complete_assignment",
      returning: "id",
      table: "homework_submissions",
    })
    expect(request.values).toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      participant_id: AUTH_USER_ID,
      program_id: PROGRAM_ID,
      status: "submitted",
    })
    expect(typeof request.values.submitted_at).toBe("string")
  })

  it("inserts a heart reaction with participant identity and returns the post reference", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.setPostHeart({ hearted: true, postId: POST_ID })

    // Then
    expect(result).toEqual({ ok: true, value: { id: POST_ID } })
    expect(client.dataRequests).toEqual([
      {
        kind: "heart_post",
        returning: "post_id",
        table: "feed_reactions",
        values: {
          author_profile_id: AUTH_USER_ID,
          post_id: POST_ID,
          reaction: "heart",
        },
      },
    ])
  })

  it("deletes a heart reaction with participant identity filters", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.setPostHeart({ hearted: false, postId: POST_ID })

    // Then
    expect(result).toEqual({ ok: true, value: { id: POST_ID } })
    expect(client.dataRequests).toEqual([
      {
        filters: { author_profile_id: AUTH_USER_ID, post_id: POST_ID },
        kind: "unheart_post",
        returning: "post_id",
        table: "feed_reactions",
      },
    ])
  })

  it("serializes a feed comment with participant identity and trimmed body", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.addPostComment({
      body: "  다음 주도 같이 달려요!  ",
      postId: POST_ID,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: COMMENT_ID } })
    expect(client.dataRequests).toEqual([
      {
        kind: "add_feed_comment",
        returning: "id",
        table: "feed_comments",
        values: {
          author_profile_id: AUTH_USER_ID,
          body: "다음 주도 같이 달려요!",
          post_id: POST_ID,
        },
      },
    ])
  })

  it("converts manual metric units before saving as an accepted record", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveManualMetric({
      metricKey: "distance_km",
      programId: PROGRAM_ID,
      recordedOn: "2026-08-25T09:00:00.000Z",
      value: 5.2,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: METRIC_ID } })
    const request = client.dataRequests.at(-1)
    if (request?.kind !== "save_manual_metric") return
    expect(request).toMatchObject({
      kind: "save_manual_metric",
      returning: "id",
      table: "metric_records",
    })
    expect(request.values).toMatchObject({
      metric_type: "distance_m",
      numeric_value: 5200,
      observed_at: "2026-08-25T09:00:00.000Z",
      owner_profile_id: AUTH_USER_ID,
      program_id: PROGRAM_ID,
      sensitivity: "activity",
      source: "manual",
      unit: "m",
      verification_status: "accepted",
    })
  })

  it("normalizes a date-only recordedOn to midnight UTC before saving", async () => {
    // Given — 화면(ManualMetricForm)은 date-only(YYYY-MM-DD)를 보낸다
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveManualMetric({
      metricKey: "sleep_hours",
      programId: PROGRAM_ID,
      recordedOn: "2026-08-25",
      value: 7.5,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: METRIC_ID } })
    const request = client.dataRequests.at(-1)
    if (request?.kind !== "save_manual_metric") return
    expect(request.values.observed_at).toBe("2026-08-25T00:00:00.000Z")
    expect(request.values).toMatchObject({
      metric_type: "sleep_hours",
      numeric_value: 7.5,
      sensitivity: "health",
      unit: "h",
      verification_status: "accepted",
    })
  })

  it("rejects a manual metric with a negative value before touching the provider", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveManualMetric({
      metricKey: "sleep_hours",
      programId: PROGRAM_ID,
      recordedOn: "2026-08-25T09:00:00.000Z",
      value: -1,
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "invalid_request", retryable: false } })
    expect(client.dataRequests).toEqual([])
  })

  it("toggles metric consent through the shared RPC and maps the audit reference", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.changeMetricConsent({ enabled: true, programId: PROGRAM_ID })

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        auditEventId: AUDIT_ID,
        auditEventType: "consent.granted",
        status: "enabled",
      },
    })
    expect(client.rpcRequests).toEqual([
      {
        args: { target_enabled: true, target_program: PROGRAM_ID },
        function: "participant_set_metric_consent",
      },
    ])
  })

  it("surfaces an unavailable consent toggle as a successful response", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    client.consentToggleResult.value = { status: "unavailable" }
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.changeMetricConsent({ enabled: true, programId: PROGRAM_ID })

    // Then
    expect(result).toEqual({
      ok: true,
      value: { auditEventId: null, auditEventType: null, status: "unavailable" },
    })
  })

  it("rejects participant mutations when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const completion = await gateway.completeAssignment({
      assignmentId: ASSIGNMENT_ID,
      programId: PROGRAM_ID,
    })
    const heart = await gateway.setPostHeart({ hearted: true, postId: POST_ID })
    const consent = await gateway.changeMetricConsent({ enabled: false, programId: PROGRAM_ID })

    // Then
    expect(completion).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(heart).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(consent).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.dataRequests).toEqual([])
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin overview snapshot into the public admin model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminOverview(PROGRAM_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      activity: [
        {
          actorRole: "coach",
          auditEventId: AUDIT_ID,
          eventType: "feedback.approved",
          occurredAt: "2026-08-25T09:00:00.000Z",
          summary: "김러너 이지런 피드백 승인",
        },
      ],
      members: [
        {
          completionPercent: 50,
          displayName: "김러너",
          heartRateShared: true,
          joinedAt: "2026-08-24T00:00:00+09:00",
          profileId: GRANTEE_ID,
          role: "participant",
          status: "active",
        },
      ],
      program: {
        endsOn: "2026-10-24",
        startsOn: "2026-08-24",
        status: "active",
        title: "PLUS Run 2026",
      },
      summary: {
        assignmentsCount: 4,
        consentedCount: 1,
        painRiskCount: 1,
        pendingFeedbackCount: 2,
        totalParticipants: 1,
      },
      timeTrial: {
        decidedAt: "2026-08-25T09:00:00.000Z",
        initialSessionNumber: 1,
        protocol: "12_minute",
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_overview_snapshot" },
    ])
  })

  it("rejects admin overview reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminOverview(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin activity snapshot into the public activity model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminActivity(PROGRAM_ID)

    // Then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual([
      {
        actorRole: "coach",
        auditEventId: AUDIT_ID,
        eventType: "feedback.approved",
        occurredAt: "2026-08-25T09:00:00.000Z",
        summary: "김러너 이지런 피드백 승인",
      },
      {
        actorRole: "admin",
        auditEventId: AUDIT_ID + 1,
        eventType: "feedback.rejected",
        occurredAt: "2026-08-25T09:10:00.000Z",
        summary: "박러너 통증 자가 보고 반려",
      },
    ])
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_activity_snapshot" },
    ])
  })

  it("rejects admin activity reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminActivity(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin members snapshot into the public roster model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminMembers(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        members: [
          {
            completionPercent: 60,
            displayName: "김러너",
            email: "runner@example.com",
            heartRateShared: true,
            joinedAt: "2026-08-24T09:00:00.000Z",
            membershipId: MEMBERSHIP_ID,
            profileId: GRANTEE_ID,
            role: "participant",
            status: "active",
          },
        ],
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        summary: {
          activeCoaches: 1,
          activeParticipants: 1,
          consentedCount: 1,
          totalMembers: 2,
        },
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_members_snapshot" },
    ])
  })

  it("rejects admin members reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminMembers(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin schedule snapshot into the public calendar model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminSchedule(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        sessions: [
          {
            scheduledAt: "2026-08-26T19:00:00.000Z",
            sessionId: SESSION_ID,
            sessionKind: "time_trial",
            sessionNumber: 1,
            title: "기록 측정 1회차",
          },
          {
            scheduledAt: "2026-08-29T19:00:00.000Z",
            sessionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            sessionKind: "easy",
            sessionNumber: 2,
            title: "이지런 2회차",
          },
        ],
        summary: {
          pastCount: 1,
          timeTrial: {
            decidedAt: "2026-08-25T09:00:00.000Z",
            initialSessionNumber: 1,
            protocol: "12_minute",
          },
          totalSessions: 2,
          upcomingCount: 1,
        },
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_schedule_snapshot" },
    ])
  })

  it("rejects admin schedule reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminSchedule(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin settings snapshot into the public configuration model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminSettings(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        timeTrial: {
          decidedAt: "2026-08-25T09:00:00.000Z",
          initialSessionNumber: 1,
          protocol: "12_minute",
        },
        summary: {
          deletionRequestCount: 1,
          failedNotificationCount: 1,
        },
        deletionRequests: [
          {
            deletionRequestId: DELETION_ID,
            profileId: GRANTEE_ID,
            displayName: "김러너",
            status: "requested",
            requestedAt: "2026-08-26T09:00:00.000Z",
          },
        ],
        failedNotifications: [
          {
            outboxId: OUTBOX_ID,
            notificationId: NOTICE_ID,
            channel: "push",
            title: "일정 변경 안내",
            status: "failed",
            lastErrorCode: "push_provider_error",
            attemptCount: 3,
            createdAt: "2026-08-25T09:30:00.000Z",
          },
        ],
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_settings_snapshot" },
    ])
  })

  it("rejects admin settings reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminSettings(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the admin report snapshot into the aggregate report model", async () => {
    // Given
    const client = createFakeClient({ email: "admin@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminReport(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        summary: {
          releasedCount: 1,
          reportCount: 1,
        },
        snapshots: [
          {
            calculationVersion: "plus_run_measurement_v1",
            cells: [
              {
                columnKey: "all_participants",
                numericValue: 42,
                participantCount: 20,
                rowKey: "cohort",
                suppressed: false,
                suppressionReason: null,
              },
            ],
            frozenAt: "2026-08-25T09:00:00.000Z",
            generatedAt: "2026-08-25T09:00:00.000Z",
            releasedAt: "2026-08-26T09:00:00.000Z",
            snapshotId: "43434343-4343-4434-8434-434343434343",
            status: "released",
          },
        ],
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "admin_report_snapshot" },
    ])
  })

  it("rejects admin report reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getAdminReport(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("maps the participant record snapshot into the record screen model", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getParticipantRecord(PROGRAM_ID)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        recordedOn: "2026-08-26",
        supportedExtensions: ["csv", "fit", "gpx", "tcx", "xml", "json"],
      },
    })
    expect(client.rpcRequests).toEqual([
      { args: { target_program: PROGRAM_ID }, function: "participant_record_snapshot" },
    ])
  })

  it("imports an activity file draft through the import RPC", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.importActivityDraft({
      draftRecords: [
        {
          metricType: "distance_m",
          numericValue: 5230,
          observedAt: "2026-08-26T07:00:00.000Z",
          unit: "m",
        },
      ],
      fileName: "easy-run-0826.csv",
      fileSize: 1024,
      programId: PROGRAM_ID,
      uploadKind: "csv",
    })

    // Then
    expect(result).toEqual({
      ok: true,
      value: { draftCount: 6, uploadId: UPLOAD_ID },
    })
    expect(client.rpcRequests).toEqual([
      {
        args: {
          draft_records: [
            {
              metric_type: "distance_m",
              numeric_value: 5230,
              observed_at: "2026-08-26T07:00:00.000Z",
              unit: "m",
            },
          ],
          file_name: "easy-run-0826.csv",
          file_size: 1024,
          target_program: PROGRAM_ID,
          upload_kind: "csv",
        },
        function: "import_activity_draft",
      },
    ])
  })

  it("rejects file imports with a malformed draft payload", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.importActivityDraft({
      draftRecords: [],
      fileName: "empty.csv",
      fileSize: 0,
      programId: PROGRAM_ID,
      uploadKind: "csv",
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "invalid_request", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("accepts a pending activity draft through the save RPC", async () => {
    // Given
    const client = createFakeClient({ email: "runner@example.com", userId: AUTH_USER_ID })
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveActivityDraft({
      programId: PROGRAM_ID,
      uploadId: UPLOAD_ID,
    })

    // Then
    expect(result).toEqual({ ok: true, value: { id: "accepted" } })
    expect(client.rpcRequests).toEqual([
      {
        args: { target_program: PROGRAM_ID, target_upload_id: UPLOAD_ID },
        function: "save_activity_draft",
      },
    ])
  })

  it("rejects draft saves when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.saveActivityDraft({
      programId: PROGRAM_ID,
      uploadId: UPLOAD_ID,
    })

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })

  it("rejects participant record reads when the caller has no authenticated identity", async () => {
    // Given
    const client = createFakeClient(null)
    const gateway = createPilotGateway(client)

    // When
    const result = await gateway.getParticipantRecord(PROGRAM_ID)

    // Then
    expect(result).toEqual({ ok: false, error: { kind: "signed_out", retryable: false } })
    expect(client.rpcRequests).toEqual([])
  })
})
