export const PILOT_CLIENT_ERROR_KINDS = ["aborted", "network", "provider"] as const
export type PilotClientErrorKind = (typeof PILOT_CLIENT_ERROR_KINDS)[number]

export type PilotClientError = {
  readonly code?: string
  readonly kind: PilotClientErrorKind
  readonly message: string
  readonly retryable: boolean
}

export type PilotClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: PilotClientError; readonly ok: false }

export type PilotClientSession = {
  readonly email: string | null
  readonly userId: string
}

export type PilotRequestOptions = {
  readonly signal?: AbortSignal
}

export type PilotOtpRequest = {
  readonly email: string
  readonly options: {
    readonly emailRedirectTo: string
    readonly shouldCreateUser: false
  }
}

export type PilotRpcRequest =
  | {
      readonly args: Readonly<Record<string, never>>
      readonly function: "bootstrap_pilot_membership"
      readonly signal?: AbortSignal
    }
  | {
      readonly args: { readonly target_program: string }
      readonly function: "coach_dashboard_snapshot"
      readonly signal?: AbortSignal
    }
  | {
      readonly args: {
        readonly target_participant: string
        readonly target_program: string
      }
      readonly function: "coach_participant_detail_snapshot"
      readonly signal?: AbortSignal
    }
  | {
      readonly args: {
        readonly review_note?: string
        readonly target_decision: "approved" | "rejected"
        readonly target_feedback: string
      }
      readonly function: "review_feedback"
      readonly signal?: AbortSignal
    }

export type PilotFunctionRequest = {
  readonly body: Readonly<Record<string, unknown>>
  readonly name: string
  readonly signal?: AbortSignal
}

export type PilotPageRequest = {
  readonly limit: number
  readonly offset: number
}

export type PilotPage<T> = {
  readonly hasMore: boolean
  readonly items: readonly T[]
  readonly nextOffset: number | null
}

export type PilotDataRequest =
  | {
      readonly kind: "grant_metric_consent"
      readonly returning: "id"
      readonly signal?: AbortSignal
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
      readonly signal?: AbortSignal
      readonly table: "metric_consents"
      readonly values: {
        readonly revocation_reason?: string
        readonly revoked_at: string
      }
    }
  | {
      readonly columns: "id,event_type,entity_type,entity_id,occurred_at"
      readonly kind: "list_audit_events"
      readonly order: { readonly ascending: false; readonly column: "occurred_at" }
      readonly page: PilotPageRequest
      readonly signal?: AbortSignal
      readonly table: "audit_events"
    }
  | {
      readonly kind: "publish_assignment"
      readonly returning: "id"
      readonly signal?: AbortSignal
      readonly table: "assignments"
      readonly values: {
        readonly assignment_kind: "health" | "reflection" | "running"
        readonly created_by: string
        readonly due_at: string
        readonly instructions: string
        readonly program_id: string
        readonly published_at: string
        readonly title: string
      }
    }
  | {
      readonly kind: "publish_announcement"
      readonly returning: "id"
      readonly signal?: AbortSignal
      readonly table: "announcements"
      readonly values: {
        readonly body: string
        readonly created_by: string
        readonly pinned: boolean
        readonly program_id: string
        readonly published_at: string
        readonly title: string
      }
    }
  | {
      readonly filters: { readonly program_id: string }
      readonly kind: "save_time_trial"
      readonly onConflict: "program_id"
      readonly returning: "program_id"
      readonly signal?: AbortSignal
      readonly table: "time_trial_decisions"
      readonly values: {
        readonly decided_at: string
        readonly decided_by: string
        readonly initial_session_number: 1 | 2
        readonly program_id: string
        readonly protocol: "12_minute" | "3k" | "5k"
      }
    }

export type PilotSubscriptionRequest = {
  readonly kind: "membership_lifecycle"
  readonly profileId: string
  readonly programId: string
}

export type PilotLifecycleSnapshot = {
  readonly revision: number
}

export type PilotLifecycleSubscription = {
  readonly ready: Promise<PilotClientResult<PilotLifecycleSnapshot>>
  unsubscribe(): void
}

export interface PilotAuthClient {
  clearSession(): void
  exchangeCodeForSession(code: string): Promise<PilotClientResult<PilotClientSession>>
  getSession(): Promise<PilotClientResult<PilotClientSession | null>>
  signInWithOtp(input: PilotOtpRequest): Promise<PilotClientResult<void>>
  signOut(): Promise<PilotClientResult<void>>
  subscribeToSession(listener: (session: PilotClientSession | null) => void): () => void
}

export interface PilotClient {
  readonly auth: PilotAuthClient
  execute(request: PilotDataRequest): Promise<PilotClientResult<unknown>>
  invokeFunction(request: PilotFunctionRequest): Promise<PilotClientResult<unknown>>
  invokeRpc(request: PilotRpcRequest): Promise<PilotClientResult<unknown>>
  subscribe(
    request: PilotSubscriptionRequest,
    listener: (snapshot: PilotClientResult<PilotLifecycleSnapshot>) => void,
  ): PilotLifecycleSubscription
}

export function pageFromRows<T>(rows: readonly T[], request: PilotPageRequest): PilotPage<T> {
  const hasMore = rows.length > request.limit
  return {
    hasMore,
    items: hasMore ? rows.slice(0, request.limit) : rows,
    nextOffset: hasMore ? request.offset + request.limit : null,
  }
}
