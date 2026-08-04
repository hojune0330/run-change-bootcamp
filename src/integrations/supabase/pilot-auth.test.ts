import { describe, expect, it, vi } from "vitest"
import type {
  PilotClient,
  PilotClientError,
  PilotClientResult,
  PilotClientSession,
} from "./pilot-client.ts"
import { createPilotGateway, type PilotSessionState } from "./pilot-gateway.ts"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"
const ACTIVE_SESSION = { email: "runner@example.com", userId: USER_ID } as const
const ACTIVE_BOOTSTRAP = {
  membership_id: MEMBERSHIP_ID,
  program_id: PROGRAM_ID,
  role: "participant",
  status: "active",
} as const

type Harness = {
  readonly authCallOrder: string[]
  readonly clearCalls: number[]
  readonly emitAuth: (session: PilotClientSession | null) => void
  readonly emitLifecycle: () => void
  readonly emitLifecycleFailure: () => void
  readonly exchangeCalls: string[]
  readonly gateway: ReturnType<typeof createPilotGateway>
  readonly otpRequests: unknown[]
  readonly setBootstrap: (value: unknown) => void
  readonly setBootstrapFailure: (error: PilotClientError) => void
  readonly setExchangeResult: (value: PilotClientResult<PilotClientSession>) => void
  readonly setSessionResult: (value: PilotClientResult<PilotClientSession | null>) => void
  readonly setSignOutResult: (value: PilotClientResult<void>) => void
  readonly signOutCalls: number[]
}

function createHarness(): Harness {
  let authListener: ((session: PilotClientSession | null) => void) | null = null
  let bootstrapResult: PilotClientResult<unknown> = { ok: true, value: ACTIVE_BOOTSTRAP }
  let exchangeResult: PilotClientResult<PilotClientSession> = { ok: true, value: ACTIVE_SESSION }
  let lifecycleListener:
    | ((snapshot: PilotClientResult<{ readonly revision: number }>) => void)
    | null = null
  let lifecycleRevision = 1
  let sessionResult: PilotClientResult<PilotClientSession | null> = {
    ok: true,
    value: ACTIVE_SESSION,
  }
  let signOutResult: PilotClientResult<void> = { ok: true, value: undefined }
  const authCallOrder: string[] = []
  const clearCalls: number[] = []
  const exchangeCalls: string[] = []
  const otpRequests: unknown[] = []
  const signOutCalls: number[] = []
  const client: PilotClient = {
    auth: {
      clearSession: () => {
        authCallOrder.push("clear")
        clearCalls.push(1)
      },
      exchangeCodeForSession: async (code) => {
        exchangeCalls.push(code)
        return exchangeResult
      },
      getSession: async () => sessionResult,
      signInWithOtp: async (input) => {
        otpRequests.push(input)
        return { ok: true, value: undefined }
      },
      signOut: async () => {
        authCallOrder.push("signOut")
        signOutCalls.push(1)
        return signOutResult
      },
      subscribeToSession: (listener) => {
        authListener = listener
        return () => {
          authListener = null
        }
      },
    },
    execute: async () => ({ ok: true, value: null }),
    invokeFunction: async () => ({ ok: true, value: null }),
    invokeRpc: async () => bootstrapResult,
    subscribe: (_request, listener) => {
      lifecycleListener = listener
      return {
        ready: Promise.resolve({ ok: true, value: { revision: lifecycleRevision } }),
        unsubscribe: () => {
          lifecycleListener = null
        },
      }
    },
  }
  return {
    authCallOrder,
    clearCalls,
    emitAuth: (session) => {
      if (authListener === null) throw new Error("auth listener is not subscribed")
      authListener(session)
    },
    emitLifecycle: () => {
      if (lifecycleListener === null) throw new Error("lifecycle listener is not subscribed")
      lifecycleRevision += 1
      lifecycleListener({ ok: true, value: { revision: lifecycleRevision } })
    },
    emitLifecycleFailure: () => {
      if (lifecycleListener === null) throw new Error("lifecycle listener is not subscribed")
      lifecycleListener({
        error: { kind: "network", message: "channel disconnected", retryable: true },
        ok: false,
      })
    },
    exchangeCalls,
    gateway: createPilotGateway(client),
    otpRequests,
    setBootstrap: (value) => {
      bootstrapResult = { ok: true, value }
    },
    setBootstrapFailure: (error) => {
      bootstrapResult = { error, ok: false }
    },
    setExchangeResult: (value) => {
      exchangeResult = value
    },
    setSessionResult: (value) => {
      sessionResult = value
    },
    setSignOutResult: (value) => {
      signOutResult = value
    },
    signOutCalls,
  }
}

function providerError(code: string): PilotClientResult<PilotClientSession> {
  const error: PilotClientError = {
    code,
    kind: "provider",
    message: "provider rejected callback",
    retryable: false,
  }
  return { error, ok: false }
}

describe("pilot auth state machine", () => {
  it("submits a normalized no-signup OTP request to the server-owned Auth Hook boundary", async () => {
    // Given
    const harness = createHarness()

    // When
    const result = await harness.gateway.requestEmailOtp({
      callbackUrl: "https://pilot.example.com/auth/callback",
      email: "Runner@Example.com",
    })

    // Then
    expect(result).toEqual({ ok: true, value: undefined })
    expect(harness.otpRequests).toEqual([
      {
        email: "runner@example.com",
        options: {
          emailRedirectTo: "https://pilot.example.com/auth/callback",
          shouldCreateUser: false,
        },
      },
    ])
  })

  it.each([
    "https://pilot.example.com/not-the-callback?code=value",
    "https://pilot.example.com/auth/callback?code=one&code=two",
    "https://pilot.example.com/auth/callback?code=value&next=%2Ftoday",
    "https://pilot.example.com/auth/callback?code=value&sb_flow_id=short",
    "https://pilot.example.com/auth/callback?code=value&sb_flow_id=first-flow&sb_flow_id=second-flow",
    "https://pilot.example.com/auth/callback?code=value#token",
  ])("rejects malformed callback URL %s before exchange", async (callbackUrl) => {
    // Given
    const harness = createHarness()

    // When
    const result = await harness.gateway.completeAuthCallback({ callbackUrl })

    // Then
    expect(result).toEqual({
      error: { kind: "malformed_callback", retryable: false },
      ok: false,
    })
    expect(harness.exchangeCalls).toEqual([])
  })

  it("accepts the validated Auth JS PKCE flow identifier on callback", async () => {
    // Given
    const harness = createHarness()

    // When
    const result = await harness.gateway.completeAuthCallback({
      callbackUrl:
        "https://pilot.example.com/auth/callback?code=single-use&sb_flow_id=0123456789abcdef",
    })

    // Then
    expect(result).toMatchObject({ ok: true, value: { kind: "active" } })
    expect(harness.exchangeCalls).toEqual(["single-use"])
  })

  it.each([
    ["otp_expired", "expired_link"],
    ["flow_state_not_found", "replayed_link"],
    ["bad_code_verifier", "replayed_link"],
    ["pkce_code_verifier_not_found", "replayed_link"],
  ] as const)("maps callback provider code %s to %s", async (providerCode, expectedKind) => {
    // Given
    const harness = createHarness()
    harness.setExchangeResult(providerError(providerCode))

    // When
    const result = await harness.gateway.completeAuthCallback({
      callbackUrl: "https://pilot.example.com/auth/callback?code=single-use",
    })

    // Then
    expect(result).toEqual({ error: { kind: expectedKind, retryable: false }, ok: false })
  })

  it.each(["over_email_send_rate_limit", "over_request_rate_limit"])(
    "maps provider resend guard %s to the deterministic 60-second state",
    async (providerCode) => {
      // Given
      const harness = createHarness()
      harness.setSessionResult(providerError(providerCode))

      // When
      const result = await harness.gateway.getSession()

      // Then
      expect(result).toEqual({
        error: { kind: "resend_guard", retryAfterSeconds: 60, retryable: true },
        ok: false,
      })
    },
  )

  it.each(["deleted", "expired_link", "nonmember", "suspended", "withdrawn"] as const)(
    "evicts provider and browser state when bootstrap resolves %s",
    async (status) => {
      // Given
      const harness = createHarness()
      harness.setBootstrap({ status })

      // When
      const result = await harness.gateway.getSession()

      // Then
      expect(result).toEqual({ ok: true, value: { kind: "blocked", reason: status } })
      expect(harness.signOutCalls).toEqual([1])
      expect(harness.clearCalls).toEqual([1])
    },
  )

  it.each([
    ["participant", "/today"],
    ["coach", "/coach/cohort"],
    ["admin", "/admin/overview"],
    ["stakeholder", "/admin/reports"],
  ] as const)("routes server role %s to %s", async (role, route) => {
    // Given
    const harness = createHarness()
    harness.setBootstrap({ ...ACTIVE_BOOTSTRAP, role })

    // When
    const result = await harness.gateway.getSession()

    // Then
    expect(result).toMatchObject({
      ok: true,
      value: { kind: "active", membership: { role, route } },
    })
  })

  it.each([
    ["membership suspension", "suspended"],
    ["invitation revocation", "nonmember"],
    ["enrollment withdrawal", "withdrawn"],
    ["invitation expiration", "expired_link"],
    ["profile deletion", "deleted"],
  ] as const)("rechecks %s and evicts the active session", async (_event, status) => {
    // Given
    const harness = createHarness()
    const observed: PilotSessionState[] = []
    const unsubscribe = harness.gateway.subscribeToSession((state) => observed.push(state))
    harness.emitAuth(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))

    // When
    harness.setBootstrap({ status })
    harness.emitLifecycle()

    // Then
    await vi.waitFor(() => expect(observed.at(-1)).toEqual({ kind: "blocked", reason: status }))
    expect(harness.signOutCalls).toEqual([1])
    expect(harness.clearCalls).toEqual([1])
    unsubscribe()
  })

  it("drops an older async auth event after a newer signed-out event", async () => {
    // Given
    const deferred: { resolve?: (value: PilotClientResult<unknown>) => void } = {}
    const delayedBootstrap = new Promise<PilotClientResult<unknown>>((resolve) => {
      deferred.resolve = resolve
    })
    const listeners: { auth?: (session: PilotClientSession | null) => void } = {}
    const lifecycleSubscriptions: number[] = []
    const client: PilotClient = {
      auth: {
        clearSession: () => undefined,
        exchangeCodeForSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        getSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        signInWithOtp: async () => ({ ok: true, value: undefined }),
        signOut: async () => ({ ok: true, value: undefined }),
        subscribeToSession: (listener) => {
          listeners.auth = listener
          return () => undefined
        },
      },
      execute: async () => ({ ok: true, value: null }),
      invokeFunction: async () => ({ ok: true, value: null }),
      invokeRpc: async () => delayedBootstrap,
      subscribe: () => {
        lifecycleSubscriptions.push(1)
        return {
          ready: Promise.resolve({ ok: true, value: { revision: 1 } }),
          unsubscribe: () => undefined,
        }
      },
    }
    const observed: PilotSessionState[] = []
    createPilotGateway(client).subscribeToSession((state) => observed.push(state))
    const authListener = listeners.auth
    if (authListener === undefined) throw new Error("auth listener is not subscribed")
    authListener(ACTIVE_SESSION)
    authListener(null)

    // When
    const releaseBootstrap = deferred.resolve
    if (releaseBootstrap === undefined) throw new Error("bootstrap request did not start")
    releaseBootstrap({ ok: true, value: ACTIVE_BOOTSTRAP })

    // Then
    await vi.waitFor(() => expect(observed).toEqual([{ kind: "signed_out" }]))
    expect(lifecycleSubscriptions).toEqual([])
  })

  it("does not let a stale getSession restore outrank a newer auth event", async () => {
    // Given
    const restoreDeferred: {
      resolve?: (result: PilotClientResult<PilotClientSession | null>) => void
    } = {}
    const delayedRestore = new Promise<PilotClientResult<PilotClientSession | null>>((resolve) => {
      restoreDeferred.resolve = resolve
    })
    const listeners: { auth?: (session: PilotClientSession | null) => void } = {}
    const clearCalls: number[] = []
    const signOutCalls: number[] = []
    let getSessionCalls = 0
    let rpcCalls = 0
    const client: PilotClient = {
      auth: {
        clearSession: () => clearCalls.push(1),
        exchangeCodeForSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        getSession: async () => {
          getSessionCalls += 1
          return getSessionCalls === 1
            ? delayedRestore
            : { ok: true as const, value: ACTIVE_SESSION }
        },
        signInWithOtp: async () => ({ ok: true, value: undefined }),
        signOut: async () => {
          signOutCalls.push(1)
          return { ok: true, value: undefined }
        },
        subscribeToSession: (listener) => {
          listeners.auth = listener
          return () => undefined
        },
      },
      execute: async () => ({ ok: true, value: null }),
      invokeFunction: async () => ({ ok: true, value: null }),
      invokeRpc: async () => {
        rpcCalls += 1
        return { ok: true, value: ACTIVE_BOOTSTRAP }
      },
      subscribe: () => ({
        ready: Promise.resolve({ ok: true, value: { revision: 1 } }),
        unsubscribe: () => undefined,
      }),
    }
    const gateway = createPilotGateway(client)
    const observed: PilotSessionState[] = []
    gateway.subscribeToSession((state) => observed.push(state))
    const restore = gateway.getSession()
    const authListener = listeners.auth
    if (authListener === undefined) throw new Error("auth listener is not subscribed")

    // When
    authListener(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))
    const releaseRestore = restoreDeferred.resolve
    if (releaseRestore === undefined) throw new Error("restore did not start")
    releaseRestore({ ok: true, value: ACTIVE_SESSION })

    // Then
    await expect(restore).resolves.toEqual({
      error: { kind: "aborted", retryable: false },
      ok: false,
    })
    expect(rpcCalls).toBe(2)
    expect(clearCalls).toEqual([])
    expect(signOutCalls).toEqual([])
  })

  it("reconciles a revoke that lands before lifecycle subscription readiness", async () => {
    // Given
    const readyDeferred: {
      resolve?: (result: PilotClientResult<{ readonly revision: number }>) => void
    } = {}
    const ready = new Promise<PilotClientResult<{ readonly revision: number }>>((resolve) => {
      readyDeferred.resolve = resolve
    })
    const listeners: { auth?: (session: PilotClientSession | null) => void } = {}
    const observed: PilotSessionState[] = []
    const clearCalls: number[] = []
    const signOutCalls: number[] = []
    let bootstrap: unknown = ACTIVE_BOOTSTRAP
    let rpcCalls = 0
    const client: PilotClient = {
      auth: {
        clearSession: () => clearCalls.push(1),
        exchangeCodeForSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        getSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        signInWithOtp: async () => ({ ok: true, value: undefined }),
        signOut: async () => {
          signOutCalls.push(1)
          return { ok: true, value: undefined }
        },
        subscribeToSession: (listener) => {
          listeners.auth = listener
          return () => undefined
        },
      },
      execute: async () => ({ ok: true, value: null }),
      invokeFunction: async () => ({ ok: true, value: null }),
      invokeRpc: async () => {
        rpcCalls += 1
        return { ok: true, value: bootstrap }
      },
      subscribe: () => ({ ready, unsubscribe: () => undefined }),
    }
    createPilotGateway(client).subscribeToSession((state) => observed.push(state))
    const authListener = listeners.auth
    if (authListener === undefined) throw new Error("auth listener is not subscribed")
    authListener(ACTIVE_SESSION)
    await vi.waitFor(() => expect(rpcCalls).toBe(1))
    expect(observed).toEqual([])

    // When
    bootstrap = { status: "suspended" }
    const releaseReady = readyDeferred.resolve
    if (releaseReady === undefined) throw new Error("lifecycle subscription did not start")
    releaseReady({ ok: true, value: { revision: 2 } })

    // Then
    await vi.waitFor(() => expect(observed).toEqual([{ kind: "blocked", reason: "suspended" }]))
    expect(rpcCalls).toBe(2)
    expect(clearCalls).toEqual([1])
    expect(signOutCalls).toEqual([1])
  })

  it("serializes a deferred stale eviction before applying a newer active session", async () => {
    // Given
    const listeners: {
      auth?: (session: PilotClientSession | null) => void
      lifecycle?: (snapshot: PilotClientResult<{ readonly revision: number }>) => void
    } = {}
    const signOutDeferred: { resolve?: (result: PilotClientResult<void>) => void } = {}
    const delayedSignOut = new Promise<PilotClientResult<void>>((resolve) => {
      signOutDeferred.resolve = resolve
    })
    const observed: PilotSessionState[] = []
    const clearCalls: number[] = []
    const signOutCalls: number[] = []
    const lifecycleSubscriptions: number[] = []
    let bootstrap: unknown = ACTIVE_BOOTSTRAP
    const client: PilotClient = {
      auth: {
        clearSession: () => clearCalls.push(1),
        exchangeCodeForSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        getSession: async () => ({ ok: true, value: ACTIVE_SESSION }),
        signInWithOtp: async () => ({ ok: true, value: undefined }),
        signOut: async () => {
          signOutCalls.push(1)
          return delayedSignOut
        },
        subscribeToSession: (listener) => {
          listeners.auth = listener
          return () => undefined
        },
      },
      execute: async () => ({ ok: true, value: null }),
      invokeFunction: async () => ({ ok: true, value: null }),
      invokeRpc: async () => ({ ok: true, value: bootstrap }),
      subscribe: (_request, listener) => {
        lifecycleSubscriptions.push(1)
        listeners.lifecycle = listener
        return {
          ready: Promise.resolve({
            ok: true,
            value: { revision: lifecycleSubscriptions.length },
          }),
          unsubscribe: () => undefined,
        }
      },
    }
    createPilotGateway(client).subscribeToSession((state) => observed.push(state))
    const authListener = listeners.auth
    if (authListener === undefined) throw new Error("auth listener is not subscribed")
    authListener(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed).toHaveLength(1))
    bootstrap = { status: "suspended" }
    const lifecycleListener = listeners.lifecycle
    if (lifecycleListener === undefined) throw new Error("lifecycle listener is not subscribed")
    lifecycleListener({ ok: true, value: { revision: 2 } })
    await vi.waitFor(() => expect(signOutCalls).toEqual([1]))
    expect(clearCalls).toEqual([])

    // When
    bootstrap = ACTIVE_BOOTSTRAP
    authListener(ACTIVE_SESSION)
    const releaseSignOut = signOutDeferred.resolve
    if (releaseSignOut === undefined) throw new Error("blocked eviction did not start")
    releaseSignOut({ ok: true, value: undefined })

    // Then
    await vi.waitFor(() => expect(observed).toHaveLength(2))
    expect(observed.every((state) => state.kind === "active")).toBe(true)
    expect(clearCalls).toEqual([])
    expect(signOutCalls).toEqual([1])
    expect(lifecycleSubscriptions).toEqual([1, 1])
  })

  it("retries a failed lifecycle bootstrap and then removes the browser session", async () => {
    // Given
    const harness = createHarness()
    const observed: PilotSessionState[] = []
    harness.gateway.subscribeToSession((state) => observed.push(state))
    harness.emitAuth(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))
    harness.setBootstrapFailure({
      kind: "network",
      message: "bootstrap unavailable",
      retryable: true,
    })

    // When
    harness.emitLifecycle()

    // Then
    await vi.waitFor(() => expect(observed.at(-1)).toEqual({ kind: "signed_out" }))
    expect(harness.clearCalls).toEqual([1])
    expect(harness.signOutCalls).toEqual([1])
  })

  it("fails closed when the lifecycle channel reports a disconnect", async () => {
    // Given
    const harness = createHarness()
    const observed: PilotSessionState[] = []
    harness.gateway.subscribeToSession((state) => observed.push(state))
    harness.emitAuth(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))

    // When
    harness.emitLifecycleFailure()

    // Then
    await vi.waitFor(() => expect(observed.at(-1)).toEqual({ kind: "signed_out" }))
    expect(harness.clearCalls).toEqual([1])
    expect(harness.signOutCalls).toEqual([1])
    expect(harness.authCallOrder).toEqual(["signOut", "clear"])
  })

  it("clears locally after an authenticated lifecycle sign-out attempt fails", async () => {
    // Given
    const harness = createHarness()
    const observed: PilotSessionState[] = []
    harness.gateway.subscribeToSession((state) => observed.push(state))
    harness.emitAuth(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))
    harness.setSignOutResult({
      error: { kind: "network", message: "logout unavailable", retryable: true },
      ok: false,
    })

    // When
    harness.emitLifecycleFailure()

    // Then
    await vi.waitFor(() => expect(observed.at(-1)).toEqual({ kind: "signed_out" }))
    expect(harness.authCallOrder).toEqual(["signOut", "clear"])
    expect(harness.clearCalls).toEqual([1])
  })

  it("fails closed when lifecycle reconciliation cannot restore the provider session", async () => {
    // Given
    const harness = createHarness()
    const observed: PilotSessionState[] = []
    harness.gateway.subscribeToSession((state) => observed.push(state))
    harness.emitAuth(ACTIVE_SESSION)
    await vi.waitFor(() => expect(observed.at(-1)?.kind).toBe("active"))
    harness.setSessionResult({
      error: { kind: "network", message: "session lookup unavailable", retryable: true },
      ok: false,
    })

    // When
    harness.emitLifecycle()

    // Then
    await vi.waitFor(() => expect(observed.at(-1)).toEqual({ kind: "signed_out" }))
    expect(harness.clearCalls).toEqual([1])
    expect(harness.signOutCalls).toEqual([1])
  })

  it("clears session storage even when provider sign-out fails", async () => {
    // Given
    const harness = createHarness()
    harness.setSignOutResult({
      error: { kind: "network", message: "offline", retryable: true },
      ok: false,
    })

    // When
    const result = await harness.gateway.signOut()

    // Then
    expect(result).toEqual({ error: { kind: "network", retryable: false }, ok: false })
    expect(harness.clearCalls).toEqual([1])
    expect(harness.authCallOrder).toEqual(["signOut", "clear"])
  })

  it("preserves retryability for network restore failures", async () => {
    // Given
    const harness = createHarness()
    harness.setSessionResult({
      error: { kind: "network", message: "offline", retryable: true },
      ok: false,
    })

    // When
    const result = await harness.gateway.getSession()

    // Then
    expect(result).toEqual({ error: { kind: "network", retryable: true }, ok: false })
    expect(harness.authCallOrder).toEqual(["signOut", "clear"])
    expect(harness.clearCalls).toEqual([1])
  })
})
