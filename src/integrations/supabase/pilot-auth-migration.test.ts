import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607310014_auth_invitations.sql"),
  "utf8",
)
const browserClient = readFileSync(
  resolve(process.cwd(), "src/integrations/supabase/browser-client.ts"),
  "utf8",
)

function compact(value: string): string {
  return value.replaceAll(/\s+/g, " ").toLowerCase()
}

function functionSql(schema: "private" | "public", name: string): string {
  const expression = new RegExp(
    `create or replace function ${schema}\\.${name}\\([\\s\\S]*?\\$\\$;`,
    "i",
  )
  const match = migration.match(expression)?.[0]
  expect(match, `${schema}.${name} should be defined`).toBeDefined()
  return compact(match ?? "")
}

function lifecyclePublicationSql(): string {
  const allSql = compact(migration)
  const start = allSql.indexOf("do $$ declare lifecycle_table text")
  const end = allSql.indexOf("revoke all on private.pilot_magic_link_guards", start)
  expect(start, "lifecycle publication block should be defined").toBeGreaterThanOrEqual(0)
  expect(end, "lifecycle publication block should end before private revokes").toBeGreaterThan(
    start,
  )
  return start < 0 || end < 0 ? "" : allSql.slice(start, end)
}

describe("pilot invitation auth migration", () => {
  it("lets only the signed service hook prove a precreated identity and active memberships", () => {
    // Given
    const claim = functionSql("public", "claim_pilot_magic_link_delivery")
    const resolver = functionSql("private", "resolve_pilot_invitation")

    // When
    const requiredProofs = [
      "join auth.users invited_user",
      "invited_user.id = invitation.invitee_profile_id",
      "invited_user.id = target_profile_id",
      "lower(invited_user.email) = normalized_email",
      "invitation.invitee_email_hash = encode(",
      "left join public.program_memberships membership",
      "left join public.organization_memberships organization_membership",
      "membership.role = selected_invitation.role",
      "membership.status <> 'active'",
      "membership.joined_at > checked_at",
      "organization_membership.status <> 'active'",
      "organization_membership.starts_at > checked_at",
      "program.status <> 'active'",
      "checked_at::date not between program.starts_on and program.ends_on",
      "order by invitation.invited_at desc, invitation.id desc",
      "for update of invitation",
    ]

    // Then
    expect(requiredProofs.every((proof) => resolver.includes(proof))).toBe(true)
    expect(claim).toContain(
      "from private.resolve_pilot_invitation(hook_user_id, normalized_email, requested_at)",
    )
    expect(claim).not.toContain("insert into auth.users")
    expect(claim).not.toContain("insert into public.program_memberships")
  })

  it("deduplicates signed events and applies one email-hash resend guard before eligibility", () => {
    // Given
    const claim = functionSql("public", "claim_pilot_magic_link_delivery")

    // When
    const eventGuardAt = claim.indexOf("insert into private.pilot_auth_hook_events")
    const emailGuardAt = claim.indexOf("insert into private.pilot_magic_link_guards")
    const eligibilityAt = claim.indexOf("from private.resolve_pilot_invitation")

    // Then
    expect(eventGuardAt).toBeGreaterThan(0)
    expect(emailGuardAt).toBeGreaterThan(eventGuardAt)
    expect(eligibilityAt).toBeGreaterThan(emailGuardAt)
    expect(claim).toContain("interval '60 seconds'")
    expect(claim).toContain("jsonb_build_object('status', 'replayed')")
    expect(claim).toContain("jsonb_build_object('status', 'resend_guard')")
    expect(claim).toContain("jsonb_build_object('status', 'ignore')")
  })

  it("issues a 15-minute link and permits reauthentication only after activation", () => {
    // Given
    const claim = functionSql("public", "claim_pilot_magic_link_delivery")
    const resolver = functionSql("private", "resolve_pilot_invitation")

    // When
    // Then
    expect(claim).toContain(
      "resolved_invitation.resolved_invitation_status not in ('created', 'sent', 'accepted')",
    )
    expect(claim).toContain(
      "resolved_invitation.resolved_invitation_status <> 'accepted' and resolved_invitation.resolved_invitation_expires_at <= requested_at",
    )
    expect(resolver).toContain(
      "selected_invitation.status = 'accepted' and membership.auth_activated_at is null",
    )
    expect(claim).toContain("resolved_invitation.resolved_lifecycle_status <> 'eligible'")
    expect(claim).toContain("status = case when status = 'accepted' then status else 'sent' end")
    expect(claim).toContain("magic_link_expires_at = requested_at + interval '15 minutes'")
  })

  it("backfills only legacy or accepted members and atomically records first activation", () => {
    // Given
    const allSql = compact(migration)
    const bootstrap = functionSql("public", "bootstrap_pilot_membership")

    // When
    const acceptAt = bootstrap.indexOf("set status = 'accepted', accepted_at = checked_at")
    const activateAt = bootstrap.indexOf("set auth_activated_at = checked_at")
    const enrollAt = bootstrap.indexOf("insert into public.program_enrollments")

    // Then
    expect(allSql).toContain("add column auth_activated_at timestamptz")
    expect(allSql).toContain(
      "before insert or update of program_id, profile_id, role, status on public.program_memberships",
    )
    expect(allSql).toContain(
      "invitation.status = 'accepted' and invitation.accepted_at is not null",
    )
    expect(allSql).toContain("or not exists ( select 1 from public.program_invitations invitation")
    expect(acceptAt).toBeGreaterThan(0)
    expect(activateAt).toBeGreaterThan(acceptAt)
    expect(enrollAt).toBeGreaterThan(activateAt)
    expect(bootstrap).toContain("on conflict (program_id, profile_id) do nothing")
  })

  it("denies stale first-use links and unactivated accepted sessions before active role return", () => {
    // Given
    const bootstrap = functionSql("public", "bootstrap_pilot_membership")
    const resolver = functionSql("private", "resolve_pilot_invitation")

    // When
    const denialStates = ["deleted", "expired_link", "nonmember", "suspended", "withdrawn"]

    // Then
    expect(bootstrap).toContain("resolved_invitation.resolved_magic_link_expires_at <= checked_at")
    expect(bootstrap).toContain("resolved_invitation.resolved_lifecycle_status <> 'eligible'")
    expect(bootstrap).toContain(
      "jsonb_build_object('status', resolved_invitation.resolved_lifecycle_status)",
    )
    expect(bootstrap).toContain("resolved_invitation.resolved_invitation_status = 'sent'")
    expect(resolver).toContain(
      "selected_invitation.status = 'accepted' and membership.auth_activated_at is null",
    )
    expect(resolver).toContain("checked_at::date not between program.starts_on and program.ends_on")
    expect(resolver).toContain("membership.joined_at > checked_at")
    expect(resolver).toContain("organization_membership.starts_at > checked_at")
    for (const state of denialStates) {
      expect(`${resolver} ${bootstrap}`).toContain(`'${state}'`)
    }
    expect(bootstrap).toContain("'membership_id', resolved_invitation.resolved_membership_id")
    expect(bootstrap).toContain("'role', resolved_invitation.resolved_role")
  })

  it("makes the activation marker mandatory in final RLS helpers", () => {
    // Given
    const activeMember = functionSql("private", "is_active_program_member")
    const activeActor = functionSql("private", "current_actor_is_active")
    const grants = compact(migration)

    // When
    // Then
    expect(activeMember).toContain("program_member.auth_activated_at is not null")
    expect(activeActor).toContain("membership.auth_activated_at is not null")
    expect(grants).toContain(
      "grant execute on function public.claim_pilot_magic_link_delivery(text, text, uuid) to service_role",
    )
    expect(grants).toContain(
      "revoke all on function public.claim_pilot_magic_link_delivery(text, text, uuid) from public, anon, authenticated",
    )
    expect(grants).toContain(
      "grant execute on function public.bootstrap_pilot_membership() to authenticated",
    )
    expect(grants).not.toContain(
      "grant execute on function public.claim_pilot_magic_link_delivery(text, text, uuid) to anon",
    )
  })

  it("blocks every legacy self policy until pilot activation succeeds", () => {
    // Given
    const allSql = compact(migration)

    // When
    const guardedTables = ["profiles", "organization_memberships", "program_memberships"]

    // Then
    for (const table of guardedTables) {
      expect(allSql).toContain(
        `create policy pilot_auth_requires_activation on public.${table} as restrictive for all to authenticated`,
      )
    }
    expect(allSql.match(/using \(private\.current_actor_is_active\(\)\)/g)).toHaveLength(3)
    expect(allSql).not.toContain("create policy pilot_auth_invitation_self")
    expect(allSql).not.toContain("create policy pilot_auth_enrollment_self")
    expect(allSql).toContain(
      "create policy pilot_auth_lifecycle_signal_self on public.pilot_auth_lifecycle_signals for select to authenticated using (profile_id = (select auth.uid()))",
    )
    expect(allSql).not.toContain(
      "create policy pilot_auth_lifecycle_signal_self on public.pilot_auth_lifecycle_signals for select to authenticated using (profile_id = (select auth.uid()) and private.current_actor_is_active())",
    )
  })

  it("publishes one self-only signal fed by every access-revocation source", () => {
    // Given
    const allSql = compact(migration)
    const clientSource = compact(browserClient)
    const publication = lifecyclePublicationSql()
    const lifecycleColumns = ["profile_id", "program_id", "revision", "changed_at", "change_kind"]
    const lifecycleSources = [
      "profiles",
      "organization_memberships",
      "programs",
      "program_memberships",
      "program_invitations",
      "program_enrollments",
    ]
    const forbiddenPayload = [
      "display_name",
      "invitee_email_hash",
      "last_magic_link_requested_at",
      "magic_link_expires_at",
      "magic_link_request_count",
      "title",
    ]

    // When
    // Then
    expect(allSql).toContain("from pg_publication_tables")
    expect(allSql).not.toContain("revoke select on public.profiles")
    expect(allSql).toContain(
      "grant select (profile_id, program_id, revision, changed_at, change_kind) on public.pilot_auth_lifecycle_signals to authenticated",
    )
    expect(publication).toContain(
      `add table public.pilot_auth_lifecycle_signals ( ${lifecycleColumns.join(", ")} )`,
    )
    expect(clientSource.match(/table: "pilot_auth_lifecycle_signals"/g)).toHaveLength(2)
    expect(clientSource).toContain("select: lifecycle_change_columns.pilot_auth_lifecycle_signals")
    expect(clientSource).toContain('event: "insert"')
    expect(clientSource).toContain('event: "update"')
    expect(clientSource).not.toContain('event: "*"')
    for (const table of lifecycleSources) {
      expect(allSql).toContain(`on public.${table}`)
      expect(clientSource).not.toContain(`table: "${table}"`)
    }
    expect(allSql.match(/create trigger pilot_auth_lifecycle_signal/g)).toHaveLength(6)
    expect(allSql).toContain("one current revision per profile/program bounds retention")
    for (const forbiddenColumn of forbiddenPayload) {
      expect(publication).not.toContain(forbiddenColumn)
    }
  })
})
