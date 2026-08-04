import { describe, expect, it } from "vitest"
import { matchesExpectedPostgresVersion } from "./postgres-version.mjs"

describe("matchesExpectedPostgresVersion", () => {
  it("accepts exact PostgreSQL major.minor", () => {
    expect(matchesExpectedPostgresVersion("17.10")).toBe(true)
  })

  it("accepts PostgreSQL major.minor with distro suffix", () => {
    expect(matchesExpectedPostgresVersion("17.10 (Debian 17.10-1.pgdg13+1)")).toBe(true)
  })

  it("rejects wrong PostgreSQL major.minor", () => {
    expect(matchesExpectedPostgresVersion("17.9 (Debian 17.9-1.pgdg13+1)")).toBe(false)
    expect(matchesExpectedPostgresVersion("18.10 (Debian 18.10-1.pgdg13+1)")).toBe(false)
  })

  it("rejects a prefix collision that is not a distro suffix", () => {
    expect(matchesExpectedPostgresVersion("17.100")).toBe(false)
  })
})
