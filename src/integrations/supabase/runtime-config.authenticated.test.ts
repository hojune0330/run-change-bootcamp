import { describe, expect, it } from "vitest"
import { resolveRuntimeConfiguration } from "./runtime-config.ts"

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

describe("runtime configuration authenticated session boundary", () => {
  it.each([
    {
      label: "canonical header",
      publicKey: legacyJwt({ role: "authenticated" }),
    },
    {
      label: "whitespace-prefixed header",
      publicKey: legacyJwtWithHeaderJson({ role: "authenticated" }, ' {"alg":"HS256","typ":"JWT"}'),
    },
  ])("rejects an authenticated session JWT as public config: $label", ({ publicKey }) => {
    // Given
    const environment = {
      VITE_APP_RUNTIME: "pilot",
      VITE_SUPABASE_ANON_KEY: publicKey,
      VITE_SUPABASE_URL: VALID_URL,
    }

    // When
    const result = resolveRuntimeConfiguration(environment)

    // Then
    expect(result).toEqual({ kind: "blocked", mode: "pilot", reason: "invalid_public_config" })
  })
})
