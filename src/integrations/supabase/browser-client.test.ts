import { createClient, isAuthRetryableFetchError } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import {
  BROWSER_AUTH_OPTIONS,
  createBrowserPilotGateway,
  createBrowserSupabaseClient,
} from "./browser-client.ts"

const AUTH_USER_ID = "55555555-5555-4555-8555-555555555555"
const AUTH_USER_EMAIL = "runner@example.com"
const DEMO_STORAGE_KEY = "run-change-bootcamp:demo:v1"
const DEMO_SENTINEL = "DEMO_SENTINEL_MUST_SURVIVE_AUTH_CLEANUP"
const PUBLIC_CONFIG = {
  publicKey: "sb_publishable_browser_session_test_1234567890",
  url: "https://boundary-test.supabase.co",
} as const

function encodedJwtSegment(value: Readonly<Record<string, unknown>>): string {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function authenticatedSessionToken(expiresAt: number): string {
  return [
    encodedJwtSegment({ alg: "HS256", typ: "JWT" }),
    encodedJwtSegment({
      aud: "authenticated",
      exp: expiresAt,
      role: "authenticated",
      sub: AUTH_USER_ID,
    }),
    "test-signature",
  ].join(".")
}

describe("browser Supabase auth options", () => {
  it("observes the installed Auth JS retryable fetch error contract", async () => {
    // Given
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))
    const client = createClient(PUBLIC_CONFIG.url, PUBLIC_CONFIG.publicKey, {
      auth: BROWSER_AUTH_OPTIONS,
    })

    try {
      // When
      const result = await client.auth.signInWithOtp({
        email: AUTH_USER_EMAIL,
        options: {
          emailRedirectTo: "https://pilot.example.com/auth/callback",
          shouldCreateUser: false,
        },
      })

      // Then
      expect(isAuthRetryableFetchError(result.error)).toBe(true)
      expect(result.error?.status).toBe(0)
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
    }
  })

  it("maps a magic-link proxy transport failure to a retryable network result", async () => {
    // Given
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))

    try {
      // When
      const result = await createBrowserPilotGateway(PUBLIC_CONFIG).requestEmailOtp({
        callbackUrl: "https://pilot.example.com/auth/callback",
        email: AUTH_USER_EMAIL,
      })

      // Then
      expect(result).toEqual({ error: { kind: "network", retryable: true }, ok: false })
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
    }
  })

  it("maps an Auth JS callback transport failure to a retryable network result", async () => {
    // Given
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    sessionStorage.setItem(`${storageKey}-code-verifier`, '"callback-verifier"')
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))

    try {
      // When
      const result = await createBrowserPilotGateway(PUBLIC_CONFIG).completeAuthCallback({
        callbackUrl: "https://pilot.example.com/auth/callback?code=single-use-code",
      })

      // Then
      expect(result).toEqual({ error: { kind: "network", retryable: true }, ok: false })
      expect(Object.keys(sessionStorage).filter((key) => key.endsWith("-code-verifier"))).toEqual(
        [],
      )
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
    }
  })

  it("maps an Auth JS expired-session restore failure to a retryable network result", async () => {
    // Given
    vi.useFakeTimers()
    const expiresAt = Math.floor(Date.now() / 1000) - 60
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: authenticatedSessionToken(expiresAt),
        expires_at: expiresAt,
        expires_in: 3600,
        refresh_token: "refresh-token-for-offline-restore-test",
        token_type: "bearer",
        user: {
          aud: "authenticated",
          email: AUTH_USER_EMAIL,
          id: AUTH_USER_ID,
          role: "authenticated",
        },
      }),
    )
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))

    try {
      // When
      const pending = createBrowserPilotGateway(PUBLIC_CONFIG).getSession()
      await vi.advanceTimersByTimeAsync(60_000)
      const result = await pending

      // Then
      expect(result).toEqual({ error: { kind: "network", retryable: true }, ok: false })
      expect(sessionStorage.getItem(storageKey)).toBeNull()
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it("requests magic links only through the uniform public proxy", async () => {
    // Given
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("{}", { headers: { "content-type": "application/json" }, status: 202 }),
      )

    try {
      // When
      const result = await createBrowserPilotGateway(PUBLIC_CONFIG).requestEmailOtp({
        callbackUrl: "https://pilot.example.com/auth/callback",
        email: "RUNNER@example.com",
      })

      // Then
      expect(result).toEqual({ ok: true, value: undefined })
      expect(fetchMock).toHaveBeenCalledOnce()
      const [input, init] = fetchMock.mock.calls[0] ?? []
      if (input === undefined) throw new Error("uniform magic-link request was not sent")
      const request = input instanceof Request ? input : new Request(input, init)
      expect(new URL(request.url).pathname).toBe("/functions/v1/request-pilot-magic-link")
      expect(await request.json()).toEqual({
        callbackUrl: "https://pilot.example.com/auth/callback",
        codeChallenge: expect.any(String),
        codeChallengeMethod: "s256",
        email: AUTH_USER_EMAIL,
      })
      expect(Object.keys(sessionStorage).some((key) => key.endsWith("-code-verifier"))).toBe(true)
      expect(
        fetchMock.mock.calls.some(([candidate]) =>
          (candidate instanceof Request ? candidate.url : candidate.toString()).includes(
            "/auth/v1/otp",
          ),
        ),
      ).toBe(false)
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
    }
  })

  it("persists only through the explicit sessionStorage adapter", () => {
    // Given
    // When
    const options = BROWSER_AUTH_OPTIONS

    // Then
    expect(options).toMatchObject({
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storageKey: "run-change:pilot-auth",
    })
    expect(options).toHaveProperty("storage")
  })

  it("restores from sessionStorage while deleting only legacy local auth slots", async () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: authenticatedSessionToken(expiresAt),
        expires_at: expiresAt,
        expires_in: 3600,
        refresh_token: "refresh-token-for-session-test",
        token_type: "bearer",
        user: {
          aud: "authenticated",
          email: AUTH_USER_EMAIL,
          id: AUTH_USER_ID,
          role: "authenticated",
        },
      }),
    )
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: "forbidden-local-token",
        refresh_token: "forbidden-local-refresh",
      }),
    )
    localStorage.setItem(`${storageKey}-flow-legacy-code-verifier`, '"legacy-verifier"')
    localStorage.setItem(`${storageKey}-unrelated`, "preserve-me")
    localStorage.setItem(DEMO_STORAGE_KEY, DEMO_SENTINEL)

    try {
      // When
      const result = await createBrowserSupabaseClient(PUBLIC_CONFIG).auth.getSession()

      // Then
      expect(result).toEqual({
        ok: true,
        value: { email: AUTH_USER_EMAIL, userId: AUTH_USER_ID },
      })
      expect(localStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(`${storageKey}-flow-legacy-code-verifier`)).toBeNull()
      expect(localStorage.getItem(`${storageKey}-unrelated`)).toBe("preserve-me")
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(DEMO_SENTINEL)
    } finally {
      sessionStorage.clear()
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}-flow-legacy-code-verifier`)
      localStorage.removeItem(`${storageKey}-unrelated`)
      localStorage.removeItem(DEMO_STORAGE_KEY)
    }
  })

  it("clears PKCE verifier slots after exchange while retaining the authenticated session", async () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    sessionStorage.setItem(`${storageKey}-code-verifier`, '"callback-verifier"')
    sessionStorage.setItem(`${storageKey}-flow-0123456789abcdef-code-verifier`, '"stale-verifier"')
    sessionStorage.setItem(`${storageKey}-flows-code-verifier`, '["0123456789abcdef"]')
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: authenticatedSessionToken(expiresAt),
          expires_at: expiresAt,
          expires_in: 3600,
          refresh_token: "refresh-token-for-exchange-test",
          token_type: "bearer",
          user: {
            aud: "authenticated",
            email: AUTH_USER_EMAIL,
            id: AUTH_USER_ID,
            role: "authenticated",
          },
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    )

    try {
      // When
      const result =
        await createBrowserSupabaseClient(PUBLIC_CONFIG).auth.exchangeCodeForSession(
          "single-use-code",
        )

      // Then
      expect(result).toEqual({
        ok: true,
        value: { email: AUTH_USER_EMAIL, userId: AUTH_USER_ID },
      })
      expect(sessionStorage.getItem(storageKey)).not.toBeNull()
      expect(Object.keys(sessionStorage).filter((key) => key.endsWith("-code-verifier"))).toEqual(
        [],
      )
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
    }
  })

  it("sends authenticated provider logout before clearing all pilot auth storage", async () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    const accessToken = authenticatedSessionToken(expiresAt)
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: accessToken,
        expires_at: expiresAt,
        expires_in: 3600,
        refresh_token: "refresh-token-for-logout-test",
        token_type: "bearer",
        user: {
          aud: "authenticated",
          email: AUTH_USER_EMAIL,
          id: AUTH_USER_ID,
          role: "authenticated",
        },
      }),
    )
    localStorage.setItem(storageKey, "legacy-token")
    localStorage.setItem(DEMO_STORAGE_KEY, DEMO_SENTINEL)
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))

    try {
      // When
      const result = await createBrowserPilotGateway(PUBLIC_CONFIG).signOut()

      // Then
      expect(result).toEqual({ ok: true, value: undefined })
      const logoutCall = fetchMock.mock.calls.find(([input]) =>
        (input instanceof Request ? input.url : input.toString()).includes("/auth/v1/logout"),
      )
      expect(logoutCall).toBeDefined()
      if (logoutCall === undefined) throw new Error("authenticated logout request was not sent")
      const [input, init] = logoutCall
      const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
      expect(headers.get("authorization")).toBe(`Bearer ${accessToken}`)
      expect(sessionStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(DEMO_SENTINEL)
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
      localStorage.removeItem(storageKey)
      localStorage.removeItem(DEMO_STORAGE_KEY)
    }
  })

  it("clears pilot auth storage when authenticated provider logout is offline", async () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: authenticatedSessionToken(expiresAt),
        expires_at: expiresAt,
        expires_in: 3600,
        refresh_token: "refresh-token-for-offline-logout-test",
        token_type: "bearer",
        user: {
          aud: "authenticated",
          email: AUTH_USER_EMAIL,
          id: AUTH_USER_ID,
          role: "authenticated",
        },
      }),
    )
    localStorage.setItem(storageKey, "legacy-token")
    localStorage.setItem(DEMO_STORAGE_KEY, DEMO_SENTINEL)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))

    try {
      // When
      const result = await createBrowserPilotGateway(PUBLIC_CONFIG).signOut()

      // Then
      expect(result).toEqual({ error: { kind: "network", retryable: false }, ok: false })
      expect(sessionStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(DEMO_SENTINEL)
    } finally {
      fetchMock.mockRestore()
      sessionStorage.clear()
      localStorage.removeItem(storageKey)
      localStorage.removeItem(DEMO_STORAGE_KEY)
    }
  })
})
