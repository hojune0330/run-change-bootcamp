import {
  createClient,
  FunctionsFetchError,
  FunctionsRelayError,
  isAuthRetryableFetchError,
  type Session,
} from "@supabase/supabase-js"
import type {
  PilotClient,
  PilotClientError,
  PilotClientResult,
  PilotClientSession,
  PilotLifecycleSnapshot,
} from "./pilot-client.ts"
import { createPilotGateway, type PilotGateway } from "./pilot-gateway.ts"
import { createPilotAuthFetch } from "./pilot-magic-link-proxy.ts"
import type { SupabasePublicConfig } from "./runtime-config.ts"

export const PILOT_AUTH_STORAGE_KEY = "run-change:pilot-auth"

const sessionStorageAdapter = {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
}

export const BROWSER_AUTH_OPTIONS = {
  autoRefreshToken: true,
  detectSessionInUrl: false,
  flowType: "pkce",
  persistSession: true,
  storage: sessionStorageAdapter,
  storageKey: PILOT_AUTH_STORAGE_KEY,
} as const

const LIFECYCLE_CHANGE_COLUMNS = {
  pilot_auth_lifecycle_signals: [
    "profile_id",
    "program_id",
    "revision",
    "changed_at",
    "change_kind",
  ],
}

function lifecycleChannelFailure(message: string): PilotClientResult<never> {
  return {
    error: { kind: "network", message, retryable: true },
    ok: false,
  }
}

function isPilotAuthStorageKey(key: string | null): key is string {
  return (
    key === PILOT_AUTH_STORAGE_KEY ||
    (key?.startsWith(`${PILOT_AUTH_STORAGE_KEY}-`) === true && key.endsWith("-code-verifier"))
  )
}

function pilotAuthStorageKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    isPilotAuthStorageKey,
  )
}

function clearLegacyPilotAuthStorage(): void {
  for (const key of pilotAuthStorageKeys(window.localStorage)) window.localStorage.removeItem(key)
}

function clearPilotAuthStorage(): void {
  for (const key of pilotAuthStorageKeys(window.sessionStorage))
    window.sessionStorage.removeItem(key)
  clearLegacyPilotAuthStorage()
}

function clearPilotPkceStorage(): void {
  for (const key of pilotAuthStorageKeys(window.sessionStorage)) {
    if (key.endsWith("-code-verifier")) window.sessionStorage.removeItem(key)
  }
}

function providerFailure(error: {
  readonly code?: string | undefined
  readonly message: string
}): PilotClientResult<never> {
  if (
    isAuthRetryableFetchError(error) ||
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError
  ) {
    return {
      error: { kind: "network", message: "The pilot service is unreachable", retryable: true },
      ok: false,
    }
  }
  const retryable = ["over_request_rate_limit", "request_timeout", "unexpected_failure"].includes(
    error.code ?? "",
  )
  const details: PilotClientError =
    error.code === undefined
      ? { kind: "provider", message: error.message, retryable }
      : { code: error.code, kind: "provider", message: error.message, retryable }
  return { error: details, ok: false }
}

function caughtFailure(error: unknown): PilotClientResult<never> {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      error: { kind: "aborted", message: "The pilot request was aborted", retryable: false },
      ok: false,
    }
  }
  if (
    error instanceof TypeError ||
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError ||
    isAuthRetryableFetchError(error)
  ) {
    return {
      error: { kind: "network", message: "The pilot service is unreachable", retryable: true },
      ok: false,
    }
  }
  throw error
}

async function networkBoundary<T>(
  operation: () => Promise<PilotClientResult<T>>,
): Promise<PilotClientResult<T>> {
  try {
    return await operation()
  } catch (error: unknown) {
    return caughtFailure(error)
  }
}

function clientSession(session: Session | null): PilotClientSession | null {
  return session === null
    ? null
    : {
        email: session.user.email ?? null,
        userId: session.user.id,
      }
}

export function createBrowserSupabaseClient(config: SupabasePublicConfig): PilotClient {
  clearLegacyPilotAuthStorage()
  const supabase = createClient(config.url, config.publicKey, {
    auth: BROWSER_AUTH_OPTIONS,
    global: { fetch: createPilotAuthFetch(config) },
  })

  const execute: PilotClient["execute"] = (request) =>
    networkBoundary<unknown>(async () => {
      switch (request.kind) {
        case "grant_metric_consent": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "revoke_metric_consent": {
          let query = supabase
            .from(request.table)
            .update(request.values)
            .eq("id", request.filters.id)
            .select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "list_audit_events": {
          let query = supabase
            .from(request.table)
            .select(request.columns)
            .order(request.order.column, { ascending: request.order.ascending })
            .range(request.page.offset, request.page.offset + request.page.limit - 1)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "publish_assignment": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "publish_announcement": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "save_time_trial": {
          let query = supabase
            .from(request.table)
            .upsert(request.values, { onConflict: request.onConflict })
            .select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "complete_assignment": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "heart_post": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "unheart_post": {
          let query = supabase
            .from(request.table)
            .delete()
            .eq("post_id", request.filters.post_id)
            .eq("author_profile_id", request.filters.author_profile_id)
            .select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "add_feed_comment": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
        case "save_manual_metric": {
          let query = supabase.from(request.table).insert(request.values).select(request.returning)
          if (request.signal !== undefined) query = query.abortSignal(request.signal)
          const result = await query.single()
          return result.error === null
            ? { ok: true, value: result.data }
            : providerFailure(result.error)
        }
      }
    })

  return {
    auth: {
      clearSession: clearPilotAuthStorage,
      exchangeCodeForSession: (code) =>
        networkBoundary<PilotClientSession>(async () => {
          try {
            const result = await supabase.auth.exchangeCodeForSession(code)
            if (result.error !== null) return providerFailure(result.error)
            const session = clientSession(result.data.session)
            return session === null
              ? providerFailure({ message: "Auth callback returned no session" })
              : { ok: true, value: session }
          } finally {
            clearPilotPkceStorage()
          }
        }),
      getSession: () =>
        networkBoundary<PilotClientSession | null>(async () => {
          const result = await supabase.auth.getSession()
          return result.error === null
            ? { ok: true, value: clientSession(result.data.session) }
            : providerFailure(result.error)
        }),
      signInWithOtp: (input) =>
        networkBoundary<void>(async () => {
          const result = await supabase.auth.signInWithOtp(input)
          return result.error === null
            ? { ok: true, value: undefined }
            : providerFailure(result.error)
        }),
      signOut: () =>
        networkBoundary<void>(async () => {
          const result = await supabase.auth.signOut({ scope: "local" })
          return result.error === null
            ? { ok: true, value: undefined }
            : providerFailure(result.error)
        }),
      subscribeToSession: (listener) => {
        const subscription = supabase.auth.onAuthStateChange((_event, session) => {
          listener(clientSession(session))
        })
        return () => subscription.data.subscription.unsubscribe()
      },
    },
    execute,
    invokeFunction: (request) =>
      networkBoundary<unknown>(async () => {
        const result = await supabase.functions.invoke(request.name, {
          body: request.body,
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        })
        return result.error === null
          ? { ok: true, value: result.data }
          : providerFailure(result.error)
      }),
    invokeRpc: (request) =>
      networkBoundary<unknown>(async () => {
        let query = supabase.rpc(request.function, request.args)
        if (request.signal !== undefined) query = query.abortSignal(request.signal)
        const result = await query
        return result.error === null
          ? { ok: true, value: result.data }
          : providerFailure(result.error)
      }),
    subscribe: (request, listener) => {
      const profileFilter = `profile_id=eq.${request.profileId}`
      const programProfileFilter = `${profileFilter},program_id=eq.${request.programId}`
      let active = true
      let readySettled = false
      let settleReady: (result: PilotClientResult<PilotLifecycleSnapshot>) => void = () => undefined
      const ready = new Promise<PilotClientResult<PilotLifecycleSnapshot>>((resolve) => {
        settleReady = resolve
      })
      const synchronize = async (
        deliver: (result: PilotClientResult<PilotLifecycleSnapshot>) => void,
      ): Promise<void> => {
        const result = await networkBoundary<PilotLifecycleSnapshot>(async () => {
          const response = await supabase
            .from("pilot_auth_lifecycle_signals")
            .select("revision")
            .eq("profile_id", request.profileId)
            .eq("program_id", request.programId)
            .maybeSingle()
          if (response.error !== null) return providerFailure(response.error)
          const revision = response.data?.revision
          return Number.isSafeInteger(revision) && revision > 0
            ? { ok: true, value: { revision } }
            : providerFailure({ message: "Lifecycle revision is unavailable" })
        })
        if (active) deliver(result)
      }
      const settleOrPublish = (result: PilotClientResult<PilotLifecycleSnapshot>): void => {
        if (readySettled) {
          listener(result)
          return
        }
        readySettled = true
        settleReady(result)
      }
      const resynchronize = (): void => {
        if (readySettled) void synchronize(listener)
      }
      const onVisibilityChange = (): void => {
        if (document.visibilityState === "visible") resynchronize()
      }
      window.addEventListener("online", resynchronize)
      document.addEventListener("visibilitychange", onVisibilityChange)
      const channel = supabase
        .channel(`pilot-membership-${request.profileId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            filter: programProfileFilter,
            schema: "public",
            select: LIFECYCLE_CHANGE_COLUMNS.pilot_auth_lifecycle_signals,
            table: "pilot_auth_lifecycle_signals",
          },
          resynchronize,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            filter: programProfileFilter,
            schema: "public",
            select: LIFECYCLE_CHANGE_COLUMNS.pilot_auth_lifecycle_signals,
            table: "pilot_auth_lifecycle_signals",
          },
          resynchronize,
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void synchronize(settleOrPublish)
            return
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            settleOrPublish(lifecycleChannelFailure(`Lifecycle channel ${status.toLowerCase()}`))
          }
        })
      return {
        ready,
        unsubscribe: () => {
          active = false
          window.removeEventListener("online", resynchronize)
          document.removeEventListener("visibilitychange", onVisibilityChange)
          if (!readySettled) {
            readySettled = true
            settleReady({
              error: {
                kind: "aborted",
                message: "Lifecycle subscription was replaced",
                retryable: false,
              },
              ok: false,
            })
          }
          void supabase.removeChannel(channel)
        },
      }
    },
  }
}

export function createBrowserPilotGateway(config: SupabasePublicConfig): PilotGateway {
  return createPilotGateway(createBrowserSupabaseClient(config))
}
