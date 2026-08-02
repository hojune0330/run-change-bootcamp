import { describe, expect, it } from "vitest"
import { resolveRuntimeConfiguration } from "./runtime-config.ts"

const VALID_PUBLIC_KEY = "sb_publishable_boundary_test_1234567890"
const VALID_URL = "https://boundary-test.supabase.co"

describe("runtime configuration", () => {
  it("defaults to preview when no runtime mode is supplied", () => {
    // Given
    const environment = {}

    // When
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

  it("accepts a legacy public anon key through its explicit public variable", () => {
    // Given
    const anonKey = `eyJ${"a".repeat(48)}`
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: anonKey,
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toMatchObject({
      config: { publicKey: anonKey, url: VALID_URL },
      kind: "ready",
      mode: "pilot",
    })
  })

  it("blocks ambiguous public keys instead of choosing one silently", () => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: `eyJ${"a".repeat(48)}`,
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
