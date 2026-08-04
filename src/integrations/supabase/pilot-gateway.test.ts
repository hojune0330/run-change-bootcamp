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
const GRANTEE_ID = "22222222-2222-4222-8222-222222222222"
const MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777"
const METRIC_ID = "44444444-4444-4444-8444-444444444444"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

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
      }
    },
    invokeFunction: async () => ({ ok: true, value: null }),
    invokeRpc: async (request) => {
      rpcRequests.push(request)
      return {
        ok: true,
        value: {
          membership_id: MEMBERSHIP_ID,
          program_id: PROGRAM_ID,
          role: "participant",
          status: "active",
        },
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
})
