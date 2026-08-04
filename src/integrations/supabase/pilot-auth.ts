import { z } from "zod"
import type {
  PilotClient,
  PilotClientError,
  PilotClientResult,
  PilotClientSession,
  PilotLifecycleSnapshot,
  PilotLifecycleSubscription,
  PilotSubscriptionRequest,
} from "./pilot-client.ts"

export const PILOT_OPERATION_ERROR_KINDS = [
  "aborted",
  "expired_link",
  "invalid_request",
  "invalid_response",
  "malformed_callback",
  "network",
  "nonmember",
  "provider_error",
  "replayed_link",
  "resend_guard",
  "signed_out",
  "suspended",
  "withdrawn",
  "deleted",
] as const
export type PilotOperationErrorKind = (typeof PILOT_OPERATION_ERROR_KINDS)[number]

export type PilotOperationError = {
  readonly kind: PilotOperationErrorKind
  readonly retryAfterSeconds?: number
  readonly retryable: boolean
}

export type PilotOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: PilotOperationError; readonly ok: false }

export const PILOT_ROLES = ["participant", "coach", "admin", "stakeholder"] as const
export type PilotRole = (typeof PILOT_ROLES)[number]

export type PilotMembership = {
  readonly email: string | null
  readonly membershipId: string
  readonly programId: string
  readonly role: PilotRole
  readonly route: string
  readonly userId: string
}

export type PilotBlockedReason =
  | "deleted"
  | "expired_link"
  | "nonmember"
  | "suspended"
  | "withdrawn"

export type PilotSessionState =
  | { readonly kind: "signed_out" }
  | { readonly kind: "active"; readonly membership: PilotMembership }
  | { readonly kind: "blocked"; readonly reason: PilotBlockedReason }

const MagicLinkRequestSchema = z
  .object({ callbackUrl: z.url(), email: z.email() })
  .strict()
  .readonly()
const CallbackRequestSchema = z.object({ callbackUrl: z.url() }).strict().readonly()
const BootstrapSchema = z.discriminatedUnion("status", [
  z
    .object({
      membership_id: z.uuid(),
      program_id: z.uuid(),
      role: z.enum(PILOT_ROLES),
      status: z.literal("active"),
    })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal("nonmember") })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal("suspended") })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal("withdrawn") })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal("expired_link") })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal("deleted") })
    .strict()
    .readonly(),
])

export class PilotContractError extends Error {
  readonly name = "PilotContractError"
}

function failure(
  kind: PilotOperationErrorKind,
  retryable: boolean,
  retryAfterSeconds?: number,
): PilotOperationResult<never> {
  return retryAfterSeconds === undefined
    ? { error: { kind, retryable }, ok: false }
    : { error: { kind, retryAfterSeconds, retryable }, ok: false }
}

function clientFailure(
  error: PilotClientError,
  retryable = error.retryable,
): PilotOperationResult<never> {
  if (error.code === "otp_expired") return failure("expired_link", false)
  if (
    error.code === "flow_state_not_found" ||
    error.code === "bad_code_verifier" ||
    error.code === "pkce_code_verifier_not_found"
  ) {
    return failure("replayed_link", false)
  }
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return failure("resend_guard", true, 60)
  }
  switch (error.kind) {
    case "aborted":
      return failure("aborted", false)
    case "network":
      return failure("network", retryable)
    case "provider":
      return failure("provider_error", retryable)
  }
}

function roleRoute(role: PilotRole): string {
  switch (role) {
    case "participant":
      return "/today"
    case "coach":
      return "/coach/cohort"
    case "admin":
      return "/admin/overview"
    case "stakeholder":
      return "/admin/reports"
    default:
      throw new PilotContractError(`Unsupported pilot role: ${String(role)}`)
  }
}

function callbackCode(callbackUrl: string): PilotOperationResult<string> {
  const url = new URL(callbackUrl)
  if (url.pathname !== "/auth/callback" || url.hash !== "") {
    return failure("malformed_callback", false)
  }
  const errorCode = url.searchParams.get("error_code")
  if (errorCode === "otp_expired") return failure("expired_link", false)
  if (errorCode === "flow_state_not_found") return failure("replayed_link", false)
  const codes = url.searchParams.getAll("code")
  const flowIds = url.searchParams.getAll("sb_flow_id")
  const keys = [...url.searchParams.keys()]
  const validFlowId =
    flowIds.length === 0 || (flowIds.length === 1 && /^[a-zA-Z0-9_-]{8,64}$/.test(flowIds[0] ?? ""))
  const allowedKeys = keys.every((key) => key === "code" || key === "sb_flow_id")
  return codes.length === 1 && codes[0] !== "" && validFlowId && allowedKeys
    ? { ok: true, value: codes[0] ?? "" }
    : failure("malformed_callback", false)
}

function sameLifecycleRequest(
  left: PilotSubscriptionRequest | null,
  right: PilotSubscriptionRequest | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.profileId === right.profileId &&
      left.programId === right.programId)
  )
}

export function createPilotAuthGateway(client: PilotClient) {
  let activeLifecycleRequest: PilotSubscriptionRequest | null = null
  let blockedReason: PilotBlockedReason | null = null
  let lifecycleListening = false
  let lifecycleRefresh: (
    request: PilotSubscriptionRequest,
    snapshot: PilotClientResult<PilotLifecycleSnapshot>,
  ) => void = () => undefined
  let lifecycleRevision: number | null = null
  let lifecycleSubscription: PilotLifecycleSubscription | null = null
  let sessionListener: ((session: PilotSessionState) => void) | null = null
  let sessionRevision = 0
  let transitionTail: Promise<void> = Promise.resolve()

  const isCurrent = (revision: number): boolean => revision === sessionRevision

  const withTransition = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = transitionTail
    let release: () => void = () => undefined
    transitionTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  const unbindLifecycleSubscription = (): void => {
    lifecycleSubscription?.unsubscribe()
    lifecycleSubscription = null
    lifecycleRevision = null
  }

  const bindLifecycleSubscription = (
    request: PilotSubscriptionRequest | null,
  ): PilotLifecycleSubscription | null => {
    if (
      request !== null &&
      lifecycleListening &&
      lifecycleSubscription !== null &&
      sameLifecycleRequest(activeLifecycleRequest, request)
    ) {
      return lifecycleSubscription
    }
    activeLifecycleRequest = request
    unbindLifecycleSubscription()
    if (request !== null && lifecycleListening) {
      lifecycleSubscription = client.subscribe(request, (snapshot) => {
        lifecycleRefresh(request, snapshot)
      })
    }
    return lifecycleSubscription
  }

  const resolveSession = async (
    session: PilotClientSession | null,
  ): Promise<PilotOperationResult<PilotSessionState>> => {
    if (session === null) {
      return blockedReason === null
        ? { ok: true, value: { kind: "signed_out" } }
        : { ok: true, value: { kind: "blocked", reason: blockedReason } }
    }
    const response = await client.invokeRpc({
      args: {},
      function: "bootstrap_pilot_membership",
    })
    if (!response.ok) return clientFailure(response.error)
    const parsed = BootstrapSchema.safeParse(response.value)
    if (!parsed.success) return failure("invalid_response", false)
    switch (parsed.data.status) {
      case "active": {
        return {
          ok: true,
          value: {
            kind: "active",
            membership: {
              email: session.email,
              membershipId: parsed.data.membership_id,
              programId: parsed.data.program_id,
              role: parsed.data.role,
              route: roleRoute(parsed.data.role),
              userId: session.userId,
            },
          },
        }
      }
      case "deleted":
      case "expired_link":
      case "nonmember":
      case "suspended":
      case "withdrawn":
        return { ok: true, value: { kind: "blocked", reason: parsed.data.status } }
    }
  }

  const evictCurrentSession = async (revision: number): Promise<boolean> => {
    if (!isCurrent(revision)) return false
    try {
      await client.auth.signOut()
    } finally {
      if (isCurrent(revision)) client.auth.clearSession()
    }
    return isCurrent(revision)
  }

  const readResolvedSession = async (): Promise<{
    readonly result: PilotOperationResult<PilotSessionState>
    readonly session: PilotClientSession | null
  }> => {
    let lastResult: PilotOperationResult<PilotSessionState> = failure("network", true)
    let lastSession: PilotClientSession | null = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await client.auth.getSession()
      if (!session.ok) {
        lastResult = clientFailure(session.error)
      } else {
        lastSession = session.value
        const result = await resolveSession(session.value)
        if (result.ok || !result.error.retryable) return { result, session: session.value }
        lastResult = result
      }
      if (lastResult.ok || !lastResult.error.retryable) break
    }
    return { result: lastResult, session: lastSession }
  }

  const applyResolvedSession = async (
    session: PilotClientSession | null,
    result: PilotOperationResult<PilotSessionState>,
    revision: number,
    synchronizedLifecycle: {
      readonly request: PilotSubscriptionRequest
      readonly snapshot: PilotLifecycleSnapshot
    } | null = null,
  ): Promise<PilotOperationResult<PilotSessionState>> => {
    return withTransition(async () => {
      if (!isCurrent(revision)) return failure("aborted", false)
      if (!result.ok) {
        blockedReason = null
        bindLifecycleSubscription(null)
        if (session !== null) await evictCurrentSession(revision)
        return result
      }

      let currentResult: PilotOperationResult<PilotSessionState> = result
      let currentSession = session
      let currentLifecycle = synchronizedLifecycle
      while (currentResult.ok && currentResult.value.kind === "active") {
        const request: PilotSubscriptionRequest = {
          kind: "membership_lifecycle",
          profileId: currentResult.value.membership.userId,
          programId: currentResult.value.membership.programId,
        }
        const subscription = bindLifecycleSubscription(request)
        if (currentLifecycle !== null) {
          if (sameLifecycleRequest(currentLifecycle.request, request)) {
            lifecycleRevision = currentLifecycle.snapshot.revision
            currentLifecycle = null
            break
          }
          currentLifecycle = null
        }
        if (subscription === null || lifecycleRevision !== null) break

        const ready = await subscription.ready
        if (!isCurrent(revision)) return failure("aborted", false)
        if (!ready.ok) {
          blockedReason = null
          bindLifecycleSubscription(null)
          await evictCurrentSession(revision)
          return clientFailure(ready.error)
        }
        lifecycleRevision = ready.value.revision
        const reconciled = await readResolvedSession()
        if (!isCurrent(revision)) return failure("aborted", false)
        currentSession = reconciled.session
        currentResult = reconciled.result
      }

      if (!isCurrent(revision)) return failure("aborted", false)
      if (!currentResult.ok) {
        blockedReason = null
        bindLifecycleSubscription(null)
        if (currentSession !== null) await evictCurrentSession(revision)
        return currentResult
      }
      switch (currentResult.value.kind) {
        case "active":
          blockedReason = null
          return currentResult
        case "blocked":
          blockedReason = currentResult.value.reason
          bindLifecycleSubscription(null)
          if (currentSession !== null && !(await evictCurrentSession(revision))) {
            return failure("aborted", false)
          }
          return currentResult
        case "signed_out":
          bindLifecycleSubscription(null)
          return currentResult
      }
    })
  }

  const restoreSession = async (
    revision: number,
  ): Promise<PilotOperationResult<PilotSessionState>> => {
    const session = await client.auth.getSession()
    if (!isCurrent(revision)) return failure("aborted", false)
    if (!session.ok) {
      const result = clientFailure(session.error)
      return withTransition(async () => {
        if (!isCurrent(revision)) return failure("aborted", false)
        blockedReason = null
        bindLifecycleSubscription(null)
        return (await evictCurrentSession(revision)) ? result : failure("aborted", false)
      })
    }
    const result = await resolveSession(session.value)
    if (!isCurrent(revision)) return failure("aborted", false)
    return applyResolvedSession(session.value, result, revision)
  }

  const failClosedLifecycle = async (revision: number): Promise<boolean> =>
    withTransition(async () => {
      if (!isCurrent(revision)) return false
      blockedReason = null
      bindLifecycleSubscription(null)
      await evictCurrentSession(revision)
      return isCurrent(revision)
    })

  lifecycleRefresh = (request, snapshot) => {
    if (!sameLifecycleRequest(activeLifecycleRequest, request)) return
    if (snapshot.ok && lifecycleRevision !== null && snapshot.value.revision <= lifecycleRevision) {
      return
    }
    const revision = ++sessionRevision
    if (!snapshot.ok) {
      void failClosedLifecycle(revision).then((current) => {
        if (current) sessionListener?.({ kind: "signed_out" })
      })
      return
    }
    void readResolvedSession().then(async ({ result, session }) => {
      if (!isCurrent(revision)) return
      if (!result.ok && session === null) {
        if (await failClosedLifecycle(revision)) sessionListener?.({ kind: "signed_out" })
        return
      }
      const applied = await applyResolvedSession(session, result, revision, {
        request,
        snapshot: snapshot.value,
      })
      if (!isCurrent(revision)) return
      sessionListener?.(applied.ok ? applied.value : { kind: "signed_out" })
    })
  }

  return {
    completeAuthCallback: async (
      input: unknown,
    ): Promise<PilotOperationResult<PilotSessionState>> => {
      blockedReason = null
      const parsed = CallbackRequestSchema.safeParse(input)
      if (!parsed.success) return failure("malformed_callback", false)
      const code = callbackCode(parsed.data.callbackUrl)
      if (!code.ok) return code
      const revision = ++sessionRevision
      const exchanged = await client.auth.exchangeCodeForSession(code.value)
      if (!isCurrent(revision)) return failure("aborted", false)
      if (!exchanged.ok) return clientFailure(exchanged.error)
      lifecycleListening = true
      const result = await resolveSession(exchanged.value)
      if (!isCurrent(revision)) return failure("aborted", false)
      return applyResolvedSession(exchanged.value, result, revision)
    },
    getSession: async (): Promise<PilotOperationResult<PilotSessionState>> => {
      const revision = ++sessionRevision
      return restoreSession(revision)
    },
    requestEmailOtp: async (input: unknown): Promise<PilotOperationResult<void>> => {
      blockedReason = null
      const parsed = MagicLinkRequestSchema.safeParse(input)
      if (!parsed.success) return failure("invalid_request", false)
      const callback = new URL(parsed.data.callbackUrl)
      if (
        callback.pathname !== "/auth/callback" ||
        callback.search !== "" ||
        callback.hash !== ""
      ) {
        return failure("invalid_request", false)
      }
      const email = parsed.data.email.trim().toLowerCase()
      const result = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callback.href, shouldCreateUser: false },
      })
      return result.ok ? { ok: true, value: undefined } : clientFailure(result.error)
    },
    signOut: async (): Promise<PilotOperationResult<void>> => {
      sessionRevision += 1
      blockedReason = null
      bindLifecycleSubscription(null)
      let result: PilotClientResult<void>
      try {
        result = await client.auth.signOut()
      } finally {
        client.auth.clearSession()
      }
      return result.ok ? { ok: true, value: undefined } : clientFailure(result.error, false)
    },
    subscribeToSession: (listener: (session: PilotSessionState) => void): (() => void) => {
      sessionListener = listener
      const publish = (session: PilotClientSession | null, revision: number): void => {
        void resolveSession(session).then(async (result) => {
          if (revision !== sessionRevision) return
          const applied = await applyResolvedSession(session, result, revision)
          if (applied.ok && revision === sessionRevision) listener(applied.value)
        })
      }
      lifecycleListening = true
      if (activeLifecycleRequest !== null) bindLifecycleSubscription(activeLifecycleRequest)
      const unsubscribe = client.auth.subscribeToSession((session) => {
        const revision = ++sessionRevision
        publish(session, revision)
      })
      return () => {
        sessionRevision += 1
        lifecycleListening = false
        if (sessionListener === listener) sessionListener = null
        bindLifecycleSubscription(null)
        unsubscribe()
      }
    },
  }
}
