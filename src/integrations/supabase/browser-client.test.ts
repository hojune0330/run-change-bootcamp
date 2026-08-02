import { describe, expect, it } from "vitest"
import { BROWSER_AUTH_OPTIONS, createBrowserSupabaseClient } from "./browser-client.ts"

const AUTH_USER_ID = "55555555-5555-4555-8555-555555555555"
const AUTH_USER_EMAIL = "runner@example.com"
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
  it("persists only the pilot session and never consumes URL auth parameters implicitly", () => {
    // Given
    const expectedOptions = {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storageKey: "run-change:pilot-auth",
    }

    // When
    const options = BROWSER_AUTH_OPTIONS

    // Then
    expect(options).toEqual(expectedOptions)
  })

  it("keeps a valid authenticated session after creating the browser client", async () => {
    // Given
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const storageKey = BROWSER_AUTH_OPTIONS.storageKey
    localStorage.setItem(
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

    try {
      // When
      const result = await createBrowserSupabaseClient(PUBLIC_CONFIG).auth.getSession()

      // Then
      expect(result).toEqual({
        ok: true,
        value: { email: AUTH_USER_EMAIL, userId: AUTH_USER_ID },
      })
    } finally {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}-user`)
    }
  })
})
