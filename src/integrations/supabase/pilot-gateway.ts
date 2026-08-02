import { z } from "zod"
import type { PilotClient, PilotClientSession } from "./pilot-client.ts"
import type { SupabasePublicConfig } from "./runtime-config.ts"

export type { PilotClient, PilotClientSession, PilotDataRequest } from "./pilot-client.ts"

export type PilotOperationError =
  | "invalid_request"
  | "invalid_response"
  | "provider_error"
  | "signed_out"

export type PilotOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: PilotOperationError; readonly ok: false }

export type PilotSessionState =
  | { readonly kind: "signed_out" }
  | {
      readonly kind: "signed_in"
      readonly user: { readonly email: string | null; readonly id: string }
    }

export type PilotConsentReference = { readonly id: string }

export type PilotAuditEvent = {
  readonly entityId: string | null
  readonly entityType: string
  readonly eventType: string
  readonly id: number
  readonly occurredAt: string
}

export interface PilotGateway {
  getSession(): Promise<PilotOperationResult<PilotSessionState>>
  grantMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  listAuditEvents(): Promise<PilotOperationResult<readonly PilotAuditEvent[]>>
  requestEmailOtp(input: unknown): Promise<PilotOperationResult<void>>
  revokeMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  signOut(): Promise<PilotOperationResult<void>>
  subscribeToSession(listener: (session: PilotSessionState) => void): () => void
}

export type PilotGatewayFactory = (config: SupabasePublicConfig) => PilotGateway

const EmailOtpInputSchema = z.object({ email: z.email() }).strict().readonly()
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

function publicSession(session: PilotClientSession | null): PilotSessionState {
  return session === null
    ? { kind: "signed_out" }
    : { kind: "signed_in", user: { email: session.email, id: session.userId } }
}

async function authenticatedSession(
  client: PilotClient,
): Promise<PilotOperationResult<PilotClientSession>> {
  const result = await client.auth.getSession()
  if (!result.ok) return { error: "provider_error", ok: false }
  return result.value === null
    ? { error: "signed_out", ok: false }
    : { ok: true, value: result.value }
}

function consentResult(
  result: Awaited<ReturnType<PilotClient["execute"]>>,
): PilotOperationResult<PilotConsentReference> {
  if (!result.ok) return { error: "provider_error", ok: false } as const
  const parsed = ConsentReferenceSchema.safeParse(result.value)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : ({ error: "invalid_response", ok: false } as const)
}

export function createPilotGateway(client: PilotClient): PilotGateway {
  return {
    getSession: async () => {
      const result = await client.auth.getSession()
      return result.ok
        ? { ok: true, value: publicSession(result.value) }
        : { error: "provider_error", ok: false }
    },
    grantMetricConsent: async (input) => {
      const parsed = ConsentGrantInputSchema.safeParse(input)
      if (!parsed.success) return { error: "invalid_request", ok: false }
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
        limit: 25,
        order: { ascending: false, column: "occurred_at" },
        table: "audit_events",
      })
      if (!result.ok) return { error: "provider_error", ok: false }
      const parsed = AuditEventRowsSchema.safeParse(result.value)
      if (!parsed.success) return { error: "invalid_response", ok: false }
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
    requestEmailOtp: async (input) => {
      const parsed = EmailOtpInputSchema.safeParse(input)
      if (!parsed.success) return { error: "invalid_request", ok: false }
      const result = await client.auth.signInWithOtp({
        email: parsed.data.email,
        options: { shouldCreateUser: false },
      })
      return result.ok ? { ok: true, value: undefined } : { error: "provider_error", ok: false }
    },
    revokeMetricConsent: async (input) => {
      const parsed = ConsentRevocationInputSchema.safeParse(input)
      if (!parsed.success) return { error: "invalid_request", ok: false }
      const session = await authenticatedSession(client)
      if (!session.ok) return session
      const values =
        parsed.data.reason === undefined
          ? { revoked_at: parsed.data.revokedAt }
          : {
              revocation_reason: parsed.data.reason,
              revoked_at: parsed.data.revokedAt,
            }
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
    signOut: async () => {
      const result = await client.auth.signOut()
      return result.ok ? { ok: true, value: undefined } : { error: "provider_error", ok: false }
    },
    subscribeToSession: (listener) =>
      client.auth.subscribeToSession((session) => listener(publicSession(session))),
  }
}
