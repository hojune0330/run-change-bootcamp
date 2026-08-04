import assert from "node:assert/strict"
import test from "node:test"
import { matchesExpectedPostgresVersion } from "./postgres-version.mjs"

test("accepts exact PostgreSQL major.minor", () => {
  assert.equal(matchesExpectedPostgresVersion("17.10"), true)
})

test("accepts PostgreSQL major.minor with distro suffix", () => {
  assert.equal(matchesExpectedPostgresVersion("17.10 (Debian 17.10-1.pgdg13+1)"), true)
})

test("rejects wrong PostgreSQL major.minor", () => {
  assert.equal(matchesExpectedPostgresVersion("17.9 (Debian 17.9-1.pgdg13+1)"), false)
  assert.equal(matchesExpectedPostgresVersion("18.10 (Debian 18.10-1.pgdg13+1)"), false)
})

test("rejects a prefix collision that is not a distro suffix", () => {
  assert.equal(matchesExpectedPostgresVersion("17.100"), false)
})
