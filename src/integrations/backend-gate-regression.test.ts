import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const repository = process.cwd()
const migrations = readFileSync(
  resolve(repository, "supabase", "migrations", "202607310003_consent_audit_lifecycle.sql"),
  "utf8",
)
const privacyPolicies = readFileSync(
  resolve(repository, "supabase", "migrations", "202607310006_privacy_social_rls.sql"),
  "utf8",
)
const invariants = readFileSync(
  resolve(repository, "supabase", "migrations", "202607310008_cross_entity_invariants.sql"),
  "utf8",
)
const trainingPolicies = readFileSync(
  resolve(repository, "supabase", "migrations", "202607310005_identity_training_rls.sql"),
  "utf8",
)

function normalized(value: string): string {
  return value.replaceAll(/\s+/g, " ").toLowerCase()
}

function requiredBlock(source: string, label: string, pattern: RegExp): string {
  const block = source.match(pattern)?.[0]
  expect(block, `${label} should exist`).toBeDefined()
  return normalized(block ?? "")
}

function ownedSource(...segments: readonly string[]): string {
  const path = resolve(repository, ...segments)
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}

function expectInsideClaimFailureGuard(source: string, markers: readonly string[]): void {
  const handler = normalized(source)
  const claimAt = handler.indexOf("await claimairequest(")
  const guardedTryAt = handler.indexOf("try {", claimAt)
  const catchAt = handler.indexOf("} catch (error)", guardedTryAt)
  const finalizerAt = handler.indexOf("await failairequest(", catchAt)
  expect(claimAt).toBeGreaterThanOrEqual(0)
  expect(guardedTryAt).toBeGreaterThan(claimAt)
  expect(catchAt).toBeGreaterThan(guardedTryAt)
  expect(finalizerAt).toBeGreaterThan(catchAt)
  for (const marker of markers) {
    const markerAt = handler.indexOf(marker, guardedTryAt)
    expect(markerAt, `${marker} should be inside the claimed-job failure guard`).toBeGreaterThan(
      guardedTryAt,
    )
    expect(markerAt).toBeLessThan(catchAt)
  }
}

describe("T5 backend gate regressions", () => {
  it("allows only the first one-way consent revocation", () => {
    // Given
    const validator = requiredBlock(
      migrations,
      "private.validate_metric_consent",
      /create or replace function private\.validate_metric_consent\([\s\S]*?\$\$;/i,
    )
    const policy = requiredBlock(
      privacyPolicies,
      "consents_revoke_owner",
      /create policy consents_revoke_owner[\s\S]*?;/i,
    )

    // When
    const validatorRejectsReactivation =
      validator.includes("old.revoked_at is not null") &&
      validator.includes("new.revoked_at is null")
    const policyAllowsOnlyRevocation =
      policy.includes("using (owner_profile_id = (select auth.uid()) and revoked_at is null)") &&
      policy.includes(
        "with check (owner_profile_id = (select auth.uid()) and revoked_at is not null)",
      )

    // Then
    expect(validatorRejectsReactivation).toBe(true)
    expect(policyAllowsOnlyRevocation).toBe(true)
    expect(
      validator
        .replace("old.revoked_at is not null", "false")
        .includes("old.revoked_at is not null"),
    ).toBe(false)
  })

  it("requires current program and organization windows when granting or reading consent", () => {
    // Given
    const validator = requiredBlock(
      migrations,
      "private.validate_metric_consent",
      /create or replace function private\.validate_metric_consent\([\s\S]*?\$\$;/i,
    )
    const reader = requiredBlock(
      migrations,
      "private.can_read_metric",
      /create or replace function private\.can_read_metric\([\s\S]*?\$\$;/i,
    )

    // When
    const grantChecksWindows = [
      "active_program.status = 'active'",
      "current_date between active_program.starts_on and active_program.ends_on",
      "program_member.joined_at <= now()",
      "program_member.ended_at is null or program_member.ended_at > now()",
      "organization_member.starts_at <= now()",
      "organization_member.ends_at is null or organization_member.ends_at > now()",
    ].every((clause) => validator.includes(clause))
    const readChecksWindows = [
      "program.status = 'active'",
      "current_date between program.starts_on and program.ends_on",
      "member.joined_at <= now()",
      "member.ended_at is null or member.ended_at > now()",
      "organization_member.starts_at <= now()",
      "organization_member.ends_at is null or organization_member.ends_at > now()",
    ].every((clause) => reader.includes(clause))

    // Then
    expect(grantChecksWindows).toBe(true)
    expect(readChecksWindows).toBe(true)
  })

  it("keeps metric ownership inside an active participant program and organization", () => {
    // Given
    const validator = requiredBlock(
      invariants,
      "private.validate_metric_scope",
      /create or replace function private\.validate_metric_scope\([\s\S]*?\$\$;/i,
    )
    const updatePolicy = requiredBlock(
      trainingPolicies,
      "metrics_owner_update",
      /create policy metrics_owner_update[\s\S]*?;/i,
    )

    // When
    const triggerChecksOwnerScope = [
      "member.profile_id = new.owner_profile_id",
      "member.role = 'participant'",
      "member.status = 'active'",
      "organization_member.organization_id = program.organization_id",
      "organization_member.profile_id = new.owner_profile_id",
      "organization_member.role = 'participant'",
      "organization_member.status = 'active'",
    ].every((clause) => validator.includes(clause))

    // Then
    expect(triggerChecksOwnerScope).toBe(true)
    expect(updatePolicy).toContain("private.has_program_role(program_id, array['participant'])")
  })

  it("restores and audits lifecycle state when deletion is cancelled", () => {
    // Given
    const cancellation = requiredBlock(
      migrations,
      "private.restore_cancelled_deletion",
      /create or replace function private\.restore_cancelled_deletion\([\s\S]*?\$\$;/i,
    )
    const trigger = requiredBlock(
      migrations,
      "account_deletion_cancelled_audit",
      /create trigger account_deletion_cancelled_audit[\s\S]*?;/i,
    )

    // When
    const restoresProfile = cancellation.includes("set lifecycle_status = 'active'")
    const recordsCancellation = cancellation.includes("'account.deletion_cancelled'")

    // Then
    expect(restoresProfile).toBe(true)
    expect(recordsCancellation).toBe(true)
    expect(trigger).toContain("after update of status")
    expect(trigger).toContain("new.status = 'cancelled'")
  })

  it("finalizes every claimed Edge job and distinguishes retry states", () => {
    // Given
    const lifecycle = normalized(ownedSource("supabase", "functions", "_shared", "ai-jobs.ts"))
    const screenshotHandler = ownedSource(
      "supabase",
      "functions",
      "screenshot-to-metric-draft",
      "index.ts",
    )
    const feedbackHandler = ownedSource("supabase", "functions", "draft-feedback", "index.ts")

    // When
    const lifecycleDistinguishesStates =
      lifecycle.includes('existing.status === "succeeded"') &&
      lifecycle.includes('existing.status === "failed"') &&
      lifecycle.includes('.eq("last_started_at", existing.last_started_at)') &&
      lifecycle.includes('.lt("last_started_at", stalebefore)')

    // Then
    expect(lifecycleDistinguishesStates).toBe(true)
    expect(normalized(screenshotHandler)).toContain('claim.kind === "processing"')
    expect(normalized(feedbackHandler)).toContain('claim.kind === "processing"')
    expectInsideClaimFailureGuard(screenshotHandler, [
      ".download(",
      "validatescreenshot(",
      "requeststructuredoutput(",
      "parsemetricdraftoutput(",
      '.from("metric_records")',
    ])
    expectInsideClaimFailureGuard(feedbackHandler, [
      "requeststructuredoutput(",
      "parsefeedbackdraftoutput(",
      '.from("feedback_items")',
    ])
  })
})
