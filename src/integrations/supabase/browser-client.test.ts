import { describe, expect, it } from "vitest"
import { BROWSER_AUTH_OPTIONS } from "./browser-client.ts"

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
})
