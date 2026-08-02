export type PilotClientError = {
  readonly code?: string | undefined
  readonly message: string
}

export type PilotClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: PilotClientError; readonly ok: false }

export type PilotClientSession = {
  readonly email: string | null
  readonly userId: string
}

export type PilotOtpRequest = {
  readonly email: string
  readonly options: { readonly shouldCreateUser: false }
}

export type PilotDataRequest =
  | {
      readonly kind: "grant_metric_consent"
      readonly returning: "id"
      readonly table: "metric_consents"
      readonly values: {
        readonly expires_at: string
        readonly grantee_profile_id: string
        readonly grantee_role: "admin" | "coach" | "stakeholder"
        readonly metric_record_id: string
        readonly owner_profile_id: string
        readonly purpose: string
      }
    }
  | {
      readonly filters: { readonly id: string }
      readonly kind: "revoke_metric_consent"
      readonly returning: "id"
      readonly table: "metric_consents"
      readonly values: {
        readonly revocation_reason?: string
        readonly revoked_at: string
      }
    }
  | {
      readonly columns: "id,event_type,entity_type,entity_id,occurred_at"
      readonly kind: "list_audit_events"
      readonly limit: 25
      readonly order: { readonly ascending: false; readonly column: "occurred_at" }
      readonly table: "audit_events"
    }

export interface PilotAuthClient {
  getSession(): Promise<PilotClientResult<PilotClientSession | null>>
  signInWithOtp(input: PilotOtpRequest): Promise<PilotClientResult<void>>
  signOut(): Promise<PilotClientResult<void>>
  subscribeToSession(listener: (session: PilotClientSession | null) => void): () => void
}

export interface PilotClient {
  readonly auth: PilotAuthClient
  execute(request: PilotDataRequest): Promise<PilotClientResult<unknown>>
}
