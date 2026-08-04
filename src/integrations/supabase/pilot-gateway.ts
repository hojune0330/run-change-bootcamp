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

export interface PilotGateway {
  completeAuthCallback(input: unknown): Promise<PilotOperationResult<PilotSessionState>>
  getSession(): Promise<PilotOperationResult<PilotSessionState>>
  grantMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
  listAuditEvents(): Promise<PilotOperationResult<readonly PilotAuditEvent[]>>
  requestEmailOtp(input: unknown): Promise<PilotOperationResult<void>>
  revokeMetricConsent(input: unknown): Promise<PilotOperationResult<PilotConsentReference>>
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
  }
}
