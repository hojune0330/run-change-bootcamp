import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations")
const migrationNames = readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"))
const migrationSql = migrationNames
  .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
  .join("\n")

function sqlBlock(label: string, pattern: RegExp): string {
  const block = migrationSql.match(pattern)?.[0]
  expect(block, `${label} should exist in its migration`).toBeDefined()
  return block ?? ""
}

function normalized(block: string): string {
  return block.replaceAll(/\s+/g, " ").toLowerCase()
}

describe("Supabase security migration audit", () => {
  it("enables RLS for every public table created by the blueprint", () => {
    // Given
    const tableNames = [...migrationSql.matchAll(/create table if not exists public\.(\w+)/gi)].map(
      (match) => match[1],
    )

    // When
    const missingRls = tableNames.filter(
      (name) => !migrationSql.includes(`alter table public.${name} enable row level security`),
    )

    // Then
    expect(tableNames.length).toBeGreaterThan(0)
    expect(missingRls).toEqual([])
  })

  it("keeps sensitive health, consent, and audit tables out of Realtime publication", () => {
    // Given
    const realtimeStatements = migrationSql
      .split("\n")
      .filter((line) => line.includes("alter publication supabase_realtime add table"))

    // When
    const sensitivePublication = realtimeStatements.find((line) =>
      /metric_records|metric_consents|audit_events|data_uploads/.test(line),
    )

    // Then
    expect(sensitivePublication).toBeUndefined()
  })

  it("gates a named grantee inside the can_read_metric helper", () => {
    // Given
    const gate = normalized(
      sqlBlock(
        "private.can_read_metric",
        /create or replace function private\.can_read_metric\([\s\S]*?\$\$;/i,
      ),
    )

    // When
    const hasNamedActiveGrant =
      gate.includes("consent.grantee_profile_id = (select auth.uid())") &&
      gate.includes("consent.revoked_at is null") &&
      gate.includes("consent.expires_at > now()") &&
      gate.includes("member.status = 'active'") &&
      gate.includes("organization_member.status = 'active'")

    // Then
    expect(hasNamedActiveGrant).toBe(true)
  })

  it("deduplicates push endpoints and AI retry keys", () => {
    // Given
    const aiRequests = normalized(
      sqlBlock(
        "public.ai_requests",
        /create table if not exists public\.ai_requests \([\s\S]*?\n\);/i,
      ),
    )
    const pushSubscriptions = normalized(
      sqlBlock(
        "public.push_subscriptions",
        /create table if not exists public\.push_subscriptions \([\s\S]*?\n\);/i,
      ),
    )

    // When
    const hasPushUniqueness = pushSubscriptions.includes("unique (profile_id, endpoint_hash)")
    const hasAiIdempotency = aiRequests.includes("unique (requested_by, idempotency_key)")

    // Then
    expect(hasPushUniqueness).toBe(true)
    expect(hasAiIdempotency).toBe(true)
  })
})
