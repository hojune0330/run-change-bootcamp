import { describe, expect, it, vi } from "vitest"
import { resolveRuntimeConfiguration } from "./runtime-config.ts"

const VALID_PUBLIC_KEY = "sb_publishable_boundary_test_1234567890"
const VALID_URL = "https://boundary-test.supabase.co"

function legacyJwt(payload: Readonly<Record<string, unknown>>): string {
  const encode = (value: Readonly<Record<string, unknown>>) =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.test-signature`
}

function legacyJwtWithHeaderJson(
  payload: Readonly<Record<string, unknown>>,
  headerJson: string,
): string {
  const encode = (value: string) =>
    btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

  return `${encode(headerJson)}.${encode(JSON.stringify(payload))}.test-signature`
}

describe("runtime configuration", () => {
  it("defaults to preview when no runtime mode is supplied", () => {
    // Given
    const environment = {}

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "ready", mode: "preview" })
  })

  it.each([
    {
      environment: { VITE_DISABLE_REACT_DEVTOOLS: "1" },
      label: "default",
    },
    {
      environment: { VITE_APP_RUNTIME: "preview", VITE_DISABLE_REACT_DEVTOOLS: "1" },
      label: "explicit",
    },
  ])("keeps $label preview when React devtools instrumentation is disabled", ({ environment }) => {
    // Given / When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "ready", mode: "preview" })
  })

  it("blocks a browser secret even when runtime would otherwise default to preview", () => {
    // Given
    const environment = { VITE_SUPABASE_SERVICE_ROLE_KEY: "forbidden" }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({
      kind: "blocked",
      mode: "pilot",
      reason: "forbidden_browser_secret",
    })
  })

  it("blocks pilot mode when either public value is missing", () => {
    // Given
    const environment = { VITE_APP_RUNTIME: "pilot", VITE_SUPABASE_URL: VALID_URL }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "missing_public_config" })
  })

  it.each([
    {
      key: VALID_PUBLIC_KEY,
      label: "non-URL value",
      url: "not-a-url",
    },
    {
      key: VALID_PUBLIC_KEY,
      label: "non-TLS remote URL",
      url: "http://boundary-test.supabase.co",
    },
    {
      key: "short",
      label: "partial public key",
      url: VALID_URL,
    },
    {
      key: "sb_secret_service_role_value_1234567890",
      label: "Supabase secret key",
      url: VALID_URL,
    },
  ])("rejects malformed pilot config: $label", ({ key, url }) => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
      VITE_SUPABASE_URL: url,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
  })

  it("accepts one HTTPS URL and one publishable key", () => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_PUBLISHABLE_KEY: VALID_PUBLIC_KEY,
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({
      config: { publicKey: VALID_PUBLIC_KEY, url: VALID_URL },
      kind: "ready",
      mode: "pilot",
    })
  })

  it.each([{ role: "anon" }])(
    "accepts a legacy public JWT with the $role role through its explicit public variable",
    ({ role }) => {
      // Given
      const publicKey = legacyJwt({ role })
      const environment = {
        VITE_APP_RUNTIME: "pilot",
        VITE_SUPABASE_ANON_KEY: publicKey,
        VITE_SUPABASE_URL: VALID_URL,
      }

      // When
      const result = resolveRuntimeConfiguration(environment)

      // Then
      expect(result).toEqual({
        config: { publicKey, url: VALID_URL },
        kind: "ready",
        mode: "pilot",
      })
    },
  )

  it.each([
    { role: "service_role" },
    { role: "postgres" },
    { role: "supabase_admin" },
    { role: "supabase_auth_admin" },
    { role: "supabase_storage_admin" },
    { role: "supabase_etl_admin" },
    { role: "dashboard_user" },
  ])("rejects a legacy JWT with the privileged $role role", ({ role }) => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: legacyJwt({ role }),
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
  })

  it("rejects a privileged legacy JWT when the decoded header is not eyJ-prefixed", () => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: legacyJwtWithHeaderJson(
        { role: "service_role" },
        ' {"alg":"HS256","typ":"JWT"}',
      ),
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
  })

  it.each([
    { key: `eyJ${"a".repeat(48)}`, label: "incomplete compact JWT" },
    { key: legacyJwt({}), label: "missing role claim" },
    { key: legacyJwt({ role: 42 }), label: "non-string role claim" },
  ])("rejects a malformed legacy JWT: $label", ({ key }) => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: key,
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
  })

  it("blocks a legacy JWT when base64 decoding fails at the browser boundary", () => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: legacyJwt({ role: "anon" }),
      VITE_SUPABASE_URL: VALID_URL,
    }
    const originalAtob = globalThis.atob
    vi.stubGlobal("atob", () => {
      throw new DOMException("invalid base64", "InvalidCharacterError")
    })

    try {
      // When
      const result = resolveRuntimeConfiguration(environment)

      // Then
      expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
    } finally {
      vi.stubGlobal("atob", originalAtob)
    }
  })

  it("blocks ambiguous public keys instead of choosing one silently", () => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: legacyJwt({ role: "anon" }),
      VITE_SUPABASE_PUBLISHABLE_KEY: VALID_PUBLIC_KEY,
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "ambiguous_public_key" })
  })

  it("blocks an unsupported explicit runtime instead of falling back to preview", () => {
    // Given
    const environment = { VITE_APP_RUNTIME: "production" }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_runtime" })
  })
})
