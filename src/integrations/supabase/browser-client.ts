import { createClient, type Session } from "@supabase/supabase-js"
import type {
  PilotClient,
  PilotClientError,
  PilotClientResult,
  PilotClientSession,
} from "./pilot-client.ts"
import { createPilotGateway, type PilotGateway } from "./pilot-gateway.ts"
import type { SupabasePublicConfig } from "./runtime-config.ts"

export const BROWSER_AUTH_OPTIONS = {
  autoRefreshToken: true,
  detectSessionInUrl: false,
  flowType: "pkce",
  persistSession: true,
  storageKey: "run-change:pilot-auth",
} as const

function clientFailure(error: PilotClientError): PilotClientResult<never> {
  return error.code === undefined
    ? { error: { message: error.message }, ok: false }
    : { error: { code: error.code, message: error.message }, ok: false }
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
  const supabase = createClient(config.url, config.publicKey, { auth: BROWSER_AUTH_OPTIONS })

  return {
    auth: {
      getSession: async () => {
        const result = await supabase.auth.getSession()
        return result.error === null
          ? { ok: true, value: clientSession(result.data.session) }
          : clientFailure(result.error)
      },
      signInWithOtp: async (input) => {
        const result = await supabase.auth.signInWithOtp(input)
        return result.error === null ? { ok: true, value: undefined } : clientFailure(result.error)
      },
      signOut: async () => {
        const result = await supabase.auth.signOut()
        return result.error === null ? { ok: true, value: undefined } : clientFailure(result.error)
      },
      subscribeToSession: (listener) => {
        const subscription = supabase.auth.onAuthStateChange((_event, session) => {
          listener(clientSession(session))
        })
        return () => subscription.data.subscription.unsubscribe()
      },
    },
    execute: async (request) => {
      switch (request.kind) {
        case "grant_metric_consent": {
          const result = await supabase
            .from(request.table)
            .insert(request.values)
            .select(request.returning)
            .single()
          return result.error === null
            ? { ok: true, value: result.data }
            : clientFailure(result.error)
        }
        case "revoke_metric_consent": {
          const result = await supabase
            .from(request.table)
            .update(request.values)
            .eq("id", request.filters.id)
            .select(request.returning)
            .single()
          return result.error === null
            ? { ok: true, value: result.data }
            : clientFailure(result.error)
        }
        case "list_audit_events": {
          const result = await supabase
            .from(request.table)
            .select(request.columns)
            .order(request.order.column, { ascending: request.order.ascending })
            .limit(request.limit)
          return result.error === null
            ? { ok: true, value: result.data }
            : clientFailure(result.error)
        }
        default: {
          const unhandled: never = request
          return unhandled
        }
      }
    },
  }
}

export function createBrowserPilotGateway(config: SupabasePublicConfig): PilotGateway {
  return createPilotGateway(createBrowserSupabaseClient(config))
}
