alter table public.program_invitations
  add column last_magic_link_requested_at timestamptz,
  add column magic_link_expires_at timestamptz,
  add column magic_link_request_count integer not null default 0
    check (magic_link_request_count >= 0),
  add constraint program_invitations_magic_link_window_check
    check (
      magic_link_expires_at is null
      or (
        last_magic_link_requested_at is not null
        and magic_link_expires_at = last_magic_link_requested_at + interval '15 minutes'
      )
    );

alter table public.program_memberships
  add column auth_activated_at timestamptz;

drop trigger if exists program_memberships_validate_scope on public.program_memberships;
create trigger program_memberships_validate_scope
before insert or update of program_id, profile_id, role, status
on public.program_memberships
for each row execute function private.validate_program_membership_scope();

update public.program_memberships membership
set auth_activated_at = membership.joined_at
where exists (
    select 1
    from public.program_invitations invitation
    where invitation.program_id = membership.program_id
      and invitation.invitee_profile_id = membership.profile_id
      and invitation.role = membership.role
      and invitation.status = 'accepted'
      and invitation.accepted_at is not null
  )
  or not exists (
    select 1
    from public.program_invitations invitation
    where invitation.program_id = membership.program_id
      and invitation.invitee_profile_id = membership.profile_id
      and invitation.role = membership.role
  );

create index program_invitations_email_auth_idx
  on public.program_invitations (invitee_email_hash, invited_at desc);

create table private.pilot_magic_link_guards (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  last_requested_at timestamptz,
  request_count integer not null default 0 check (request_count >= 0)
);

create table private.pilot_auth_hook_events (
  id text primary key check (char_length(id) between 1 and 200),
  received_at timestamptz not null default now()
);

create or replace function private.resolve_pilot_invitation(
  target_profile_id uuid,
  target_email text,
  checked_at timestamptz
)
returns table (
  resolved_invitation_id uuid,
  resolved_program_id uuid,
  resolved_role text,
  resolved_invitation_status text,
  resolved_invitation_expires_at timestamptz,
  resolved_magic_link_expires_at timestamptz,
  resolved_membership_id uuid,
  resolved_enrollment_id uuid,
  resolved_lifecycle_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_lifecycle_status text;
  normalized_email text := lower(btrim(target_email));
  selected_invitation public.program_invitations%rowtype;
begin
  select invitation.*
    into selected_invitation
  from public.program_invitations invitation
  join auth.users invited_user
    on invited_user.id = invitation.invitee_profile_id
   and invited_user.id = target_profile_id
  where lower(invited_user.email) = normalized_email
    and invitation.invitee_email_hash = encode(
      extensions.digest(convert_to(normalized_email, 'UTF8'), 'sha256'),
      'hex'
    )
  order by invitation.invited_at desc, invitation.id desc
  limit 1
  for update of invitation;

  if not found then
    select case
        when profile.lifecycle_status is distinct from 'active' then 'deleted'
        else 'nonmember'
      end
      into missing_lifecycle_status
    from auth.users invited_user
    left join public.profiles profile on profile.id = invited_user.id
    where invited_user.id = target_profile_id
      and lower(invited_user.email) = normalized_email;
    return query select
      null::uuid, null::uuid, null::text, null::text, null::timestamptz,
      null::timestamptz, null::uuid, null::uuid,
      coalesce(missing_lifecycle_status, 'nonmember');
    return;
  end if;

  return query
  select
    selected_invitation.id,
    selected_invitation.program_id,
    selected_invitation.role,
    selected_invitation.status,
    selected_invitation.expires_at,
    selected_invitation.magic_link_expires_at,
    membership.id,
    enrollment.id,
    case
      when profile.lifecycle_status <> 'active' then 'deleted'
      when selected_invitation.invited_at > checked_at
        or (
          selected_invitation.accepted_at is not null
          and (
            selected_invitation.accepted_at > checked_at
            or selected_invitation.accepted_at > selected_invitation.expires_at
          )
        ) then 'nonmember'
      when membership.id is null
        or program.id is null
        or organization_membership.id is null then 'nonmember'
      when program.status <> 'active'
        or checked_at::date not between program.starts_on and program.ends_on
        or membership.joined_at > checked_at
        or organization_membership.starts_at > checked_at then 'nonmember'
      when membership.status = 'paused'
        or organization_membership.status = 'suspended' then 'suspended'
      when membership.status <> 'active'
        or organization_membership.status <> 'active'
        or (membership.ended_at is not null and membership.ended_at <= checked_at)
        or (
          organization_membership.ends_at is not null
          and organization_membership.ends_at <= checked_at
        ) then 'nonmember'
      when selected_invitation.status = 'accepted'
        and membership.auth_activated_at is null then 'nonmember'
      when selected_invitation.role = 'participant'
        and enrollment.lifecycle_status = 'withdrawn' then 'withdrawn'
      when selected_invitation.role = 'participant'
        and enrollment.lifecycle_status = 'paused' then 'suspended'
      when selected_invitation.role = 'participant'
        and enrollment.lifecycle_status in ('completed', 'ended') then 'nonmember'
      else 'eligible'
    end
  from public.profiles profile
  left join public.program_memberships membership
    on membership.program_id = selected_invitation.program_id
   and membership.profile_id = target_profile_id
   and membership.role = selected_invitation.role
  left join public.programs program on program.id = selected_invitation.program_id
  left join public.organization_memberships organization_membership
    on organization_membership.organization_id = program.organization_id
   and organization_membership.profile_id = target_profile_id
   and organization_membership.role = selected_invitation.role
  left join public.program_enrollments enrollment
    on enrollment.program_id = selected_invitation.program_id
   and enrollment.profile_id = target_profile_id
  where profile.id = target_profile_id;

  if not found then
    return query select
      selected_invitation.id, selected_invitation.program_id, selected_invitation.role,
      selected_invitation.status, selected_invitation.expires_at,
      selected_invitation.magic_link_expires_at, null::uuid, null::uuid, 'deleted'::text;
  end if;
end;
$$;

create or replace function public.claim_pilot_magic_link_delivery(
  invitee_email text,
  hook_event_id text,
  hook_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed_email text;
  normalized_email text := lower(btrim(invitee_email));
  requested_at timestamptz := statement_timestamp();
  resolved_invitation record;
begin
  if hook_event_id is null or char_length(hook_event_id) not between 1 and 200 then
    return jsonb_build_object('status', 'ignore');
  end if;
  insert into private.pilot_auth_hook_events (id, received_at)
  values (hook_event_id, requested_at)
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('status', 'replayed');
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('status', 'ignore');
  end if;
  hashed_email := encode(
    extensions.digest(convert_to(normalized_email, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into private.pilot_magic_link_guards (email_hash)
  values (hashed_email)
  on conflict (email_hash) do nothing;
  perform 1
  from private.pilot_magic_link_guards guard
  where guard.email_hash = hashed_email
  for update;
  if (
    select guard.last_requested_at > requested_at - interval '60 seconds'
    from private.pilot_magic_link_guards guard
    where guard.email_hash = hashed_email
  ) then
    update private.pilot_magic_link_guards
    set request_count = request_count + 1
    where pilot_magic_link_guards.email_hash = hashed_email;
    return jsonb_build_object('status', 'resend_guard');
  end if;
  update private.pilot_magic_link_guards
  set last_requested_at = requested_at,
      request_count = request_count + 1
  where pilot_magic_link_guards.email_hash = hashed_email;

  select *
    into resolved_invitation
  from private.resolve_pilot_invitation(hook_user_id, normalized_email, requested_at);

  if resolved_invitation.resolved_lifecycle_status <> 'eligible'
    or resolved_invitation.resolved_invitation_status not in ('created', 'sent', 'accepted')
    or (
      resolved_invitation.resolved_invitation_status <> 'accepted'
      and resolved_invitation.resolved_invitation_expires_at <= requested_at
    ) then
    return jsonb_build_object('status', 'ignore');
  end if;

  update public.program_invitations
  set status = case when status = 'accepted' then status else 'sent' end,
      last_magic_link_requested_at = requested_at,
      magic_link_expires_at = requested_at + interval '15 minutes',
      magic_link_request_count = magic_link_request_count + 1
  where id = resolved_invitation.resolved_invitation_id;

  return jsonb_build_object('status', 'send');
end;
$$;

create or replace function public.bootstrap_pilot_membership()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_email text;
  authenticated_user_id uuid := (select auth.uid());
  checked_at timestamptz := statement_timestamp();
  resolved_invitation record;
begin
  if authenticated_user_id is null then
    return jsonb_build_object('status', 'nonmember');
  end if;

  select lower(invited_user.email)
    into authenticated_email
  from auth.users invited_user
  where invited_user.id = authenticated_user_id;

  if not found then
    return jsonb_build_object('status', 'nonmember');
  end if;

  select *
    into resolved_invitation
  from private.resolve_pilot_invitation(authenticated_user_id, authenticated_email, checked_at);

  if resolved_invitation.resolved_lifecycle_status = 'deleted' then
    return jsonb_build_object('status', 'deleted');
  end if;
  if resolved_invitation.resolved_invitation_id is null
    or resolved_invitation.resolved_invitation_status in ('created', 'revoked') then
    return jsonb_build_object('status', 'nonmember');
  end if;
  if resolved_invitation.resolved_invitation_status = 'expired' then
    return jsonb_build_object('status', 'expired_link');
  end if;
  if resolved_invitation.resolved_invitation_status = 'sent' and (
    resolved_invitation.resolved_invitation_expires_at <= checked_at
    or resolved_invitation.resolved_magic_link_expires_at is null
    or resolved_invitation.resolved_magic_link_expires_at <= checked_at
  ) then
    update public.program_invitations
    set status = 'expired'
    where id = resolved_invitation.resolved_invitation_id;
    return jsonb_build_object('status', 'expired_link');
  end if;
  if resolved_invitation.resolved_lifecycle_status <> 'eligible' then
    return jsonb_build_object('status', resolved_invitation.resolved_lifecycle_status);
  end if;

  perform 1
  from public.program_memberships membership
  where membership.id = resolved_invitation.resolved_membership_id
  for update;
  if not found then
    return jsonb_build_object('status', 'nonmember');
  end if;
  if resolved_invitation.resolved_enrollment_id is not null then
    perform 1
    from public.program_enrollments enrollment
    where enrollment.id = resolved_invitation.resolved_enrollment_id
    for update;
    if not found then
      return jsonb_build_object('status', 'nonmember');
    end if;
  end if;

  if resolved_invitation.resolved_invitation_status = 'sent' then
    update public.program_invitations
    set status = 'accepted', accepted_at = checked_at
    where id = resolved_invitation.resolved_invitation_id;
    update public.program_memberships
    set auth_activated_at = checked_at
    where id = resolved_invitation.resolved_membership_id;
  end if;

  if resolved_invitation.resolved_role = 'participant'
    and resolved_invitation.resolved_enrollment_id is null then
    insert into public.program_enrollments (
      program_id,
      profile_id,
      program_membership_id,
      invitation_id,
      lifecycle_status,
      enrolled_on
    ) values (
      resolved_invitation.resolved_program_id,
      authenticated_user_id,
      resolved_invitation.resolved_membership_id,
      resolved_invitation.resolved_invitation_id,
      'onboarding',
      checked_at::date
    )
    on conflict (program_id, profile_id) do nothing;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'membership_id', resolved_invitation.resolved_membership_id,
    'program_id', resolved_invitation.resolved_program_id,
    'role', resolved_invitation.resolved_role
  );
end;
$$;

create or replace function private.is_active_program_member(
  target_profile uuid,
  target_program uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile is not null and exists (
    select 1
    from public.programs program
    join public.program_memberships program_member
      on program_member.program_id = program.id
     and program_member.profile_id = target_profile
     and program_member.role = target_role
    join public.organization_memberships organization_member
      on organization_member.organization_id = program.organization_id
     and organization_member.profile_id = target_profile
     and organization_member.role = target_role
    join public.profiles profile on profile.id = target_profile
    where program.id = target_program
      and program.status = 'active'
      and current_date between program.starts_on and program.ends_on
      and program_member.status = 'active'
      and program_member.auth_activated_at is not null
      and program_member.joined_at <= now()
      and (program_member.ended_at is null or program_member.ended_at > now())
      and organization_member.status = 'active'
      and organization_member.starts_at <= now()
      and (organization_member.ends_at is null or organization_member.ends_at > now())
      and profile.lifecycle_status = 'active'
      and (
        (
          not exists (
            select 1
            from public.program_invitations invitation
            where invitation.program_id = program.id
              and invitation.invitee_profile_id = target_profile
              and invitation.role = target_role
          )
          and not exists (
            select 1
            from public.program_enrollments enrollment
            where enrollment.program_id = program.id
              and enrollment.profile_id = target_profile
          )
        )
        or exists (
          select 1
          from lateral (
            select invitation.status, invitation.invited_at,
              invitation.expires_at, invitation.accepted_at
            from public.program_invitations invitation
            where invitation.program_id = program.id
              and invitation.invitee_profile_id = target_profile
              and invitation.role = target_role
            order by invitation.invited_at desc, invitation.id desc
            limit 1
          ) newest_invitation
          where newest_invitation.status = 'accepted'
            and newest_invitation.invited_at <= now()
            and newest_invitation.accepted_at is not null
            and newest_invitation.accepted_at <= now()
            and newest_invitation.accepted_at <= newest_invitation.expires_at
            and (
              target_role <> 'participant'
              or exists (
                select 1
                from public.program_enrollments enrollment
                where enrollment.program_id = program.id
                  and enrollment.profile_id = target_profile
                  and enrollment.program_membership_id = program_member.id
                  and enrollment.lifecycle_status in ('onboarding', 'active')
                  and enrollment.enrolled_on <= current_date
                  and (
                    enrollment.active_from is null
                    or enrollment.active_from <= current_date
                  )
                  and (
                    enrollment.active_until is null
                    or enrollment.active_until >= current_date
                  )
              )
            )
        )
      )
  );
$$;

create or replace function private.current_actor_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.program_memberships membership
    where membership.profile_id = (select auth.uid())
      and membership.auth_activated_at is not null
      and private.is_active_program_member(
        (select auth.uid()), membership.program_id, membership.role
      )
  );
$$;

create or replace function private.current_actor_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_actor_is_active() and exists (
    select 1
    from public.program_memberships membership
    where membership.profile_id = (select auth.uid())
      and membership.role = any(allowed_roles)
      and membership.auth_activated_at is not null
      and private.is_active_program_member(
        (select auth.uid()), membership.program_id, membership.role
      )
  );
$$;

create or replace function private.has_program_role(
  target_program uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(allowed_roles) allowed(role)
    where private.is_active_program_member(
      (select auth.uid()), target_program, allowed.role
    )
  );
$$;

create or replace function private.has_org_role(
  target_organization uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.program_memberships membership
    join public.programs program on program.id = membership.program_id
    where program.organization_id = target_organization
      and membership.profile_id = (select auth.uid())
      and membership.role = any(allowed_roles)
      and membership.auth_activated_at is not null
      and private.is_active_program_member(
        (select auth.uid()), membership.program_id, membership.role
      )
  );
$$;

create table if not exists public.pilot_auth_lifecycle_signals (
  profile_id uuid not null,
  program_id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  changed_at timestamptz not null default now(),
  change_kind text not null check (
    change_kind in (
      'profile', 'organization_membership', 'program',
      'program_membership', 'invitation', 'enrollment'
    )
  ),
  primary key (profile_id, program_id)
);

alter table public.pilot_auth_lifecycle_signals enable row level security;
revoke all on public.pilot_auth_lifecycle_signals from public, anon, authenticated;
grant select (profile_id, program_id, revision, changed_at, change_kind)
  on public.pilot_auth_lifecycle_signals to authenticated;

create or replace function private.bump_pilot_auth_lifecycle_signal(
  target_profile_id uuid,
  target_program_id uuid,
  target_change_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_profile_id is null or target_program_id is null then
    return;
  end if;
  if target_change_kind not in (
    'profile', 'organization_membership', 'program',
    'program_membership', 'invitation', 'enrollment'
  ) then
    raise exception 'unsupported pilot auth lifecycle signal kind';
  end if;
  insert into public.pilot_auth_lifecycle_signals (
    profile_id, program_id, revision, changed_at, change_kind
  ) values (
    target_profile_id, target_program_id, 1, statement_timestamp(), target_change_kind
  )
  on conflict (profile_id, program_id) do update
  set revision = pilot_auth_lifecycle_signals.revision + 1,
      changed_at = excluded.changed_at,
      change_kind = excluded.change_kind;
end;
$$;

create or replace function private.signal_pilot_auth_profile_programs(
  target_profile_id uuid,
  target_change_kind text,
  target_organization_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  associated_program_id uuid;
begin
  if target_profile_id is null then
    return;
  end if;
  for associated_program_id in
    with associated_programs as (
      select membership.program_id
      from public.program_memberships membership
      where membership.profile_id = target_profile_id
      union
      select enrollment.program_id
      from public.program_enrollments enrollment
      where enrollment.profile_id = target_profile_id
      union
      select invitation.program_id
      from public.program_invitations invitation
      where invitation.invitee_profile_id = target_profile_id
      union
      select signal.program_id
      from public.pilot_auth_lifecycle_signals signal
      where signal.profile_id = target_profile_id
    )
    select associated.program_id
    from associated_programs associated
    join public.programs program on program.id = associated.program_id
    where target_organization_id is null
      or program.organization_id = target_organization_id
  loop
    perform private.bump_pilot_auth_lifecycle_signal(
      target_profile_id, associated_program_id, target_change_kind
    );
  end loop;
end;
$$;

create or replace function private.signal_pilot_auth_program_profiles(
  target_program_id uuid,
  target_change_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  associated_profile_id uuid;
begin
  if target_program_id is null then
    return;
  end if;
  for associated_profile_id in
    select associated.profile_id
    from (
      select membership.profile_id
      from public.program_memberships membership
      where membership.program_id = target_program_id
      union
      select enrollment.profile_id
      from public.program_enrollments enrollment
      where enrollment.program_id = target_program_id
      union
      select invitation.invitee_profile_id
      from public.program_invitations invitation
      where invitation.program_id = target_program_id
        and invitation.invitee_profile_id is not null
      union
      select signal.profile_id
      from public.pilot_auth_lifecycle_signals signal
      where signal.program_id = target_program_id
    ) associated
  loop
    perform private.bump_pilot_auth_lifecycle_signal(
      associated_profile_id, target_program_id, target_change_kind
    );
  end loop;
end;
$$;

create or replace function private.signal_pilot_auth_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_record jsonb := '{}'::jsonb;
  old_record jsonb := '{}'::jsonb;
  new_organization_id uuid;
  new_profile_id uuid;
  new_program_id uuid;
  old_organization_id uuid;
  old_profile_id uuid;
  old_program_id uuid;
  signal_kind text;
begin
  if tg_table_schema <> 'public' then
    raise exception 'pilot auth lifecycle trigger must run in public';
  end if;
  if tg_op <> 'INSERT' then
    old_record := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_record := to_jsonb(new);
  end if;

  case tg_table_name
    when 'profiles' then
      signal_kind := 'profile';
      old_profile_id := nullif(old_record ->> 'id', '')::uuid;
      new_profile_id := nullif(new_record ->> 'id', '')::uuid;
      if tg_op = 'UPDATE' and old_profile_id is distinct from new_profile_id then
        perform private.signal_pilot_auth_profile_programs(old_profile_id, signal_kind);
      end if;
      perform private.signal_pilot_auth_profile_programs(
        case when tg_op = 'DELETE' then old_profile_id else new_profile_id end,
        signal_kind
      );
    when 'organization_memberships' then
      signal_kind := 'organization_membership';
      old_profile_id := nullif(old_record ->> 'profile_id', '')::uuid;
      old_organization_id := nullif(old_record ->> 'organization_id', '')::uuid;
      new_profile_id := nullif(new_record ->> 'profile_id', '')::uuid;
      new_organization_id := nullif(new_record ->> 'organization_id', '')::uuid;
      if tg_op = 'UPDATE' and row(old_profile_id, old_organization_id)
        is distinct from row(new_profile_id, new_organization_id) then
        perform private.signal_pilot_auth_profile_programs(
          old_profile_id, signal_kind, old_organization_id
        );
      end if;
      if tg_op = 'DELETE' then
        perform private.signal_pilot_auth_profile_programs(
          old_profile_id, signal_kind, old_organization_id
        );
      else
        perform private.signal_pilot_auth_profile_programs(
          new_profile_id, signal_kind, new_organization_id
        );
      end if;
    when 'programs' then
      signal_kind := 'program';
      old_program_id := nullif(old_record ->> 'id', '')::uuid;
      new_program_id := nullif(new_record ->> 'id', '')::uuid;
      if tg_op = 'UPDATE' and old_program_id is distinct from new_program_id then
        perform private.signal_pilot_auth_program_profiles(old_program_id, signal_kind);
      end if;
      perform private.signal_pilot_auth_program_profiles(
        case when tg_op = 'DELETE' then old_program_id else new_program_id end,
        signal_kind
      );
    when 'program_memberships' then
      signal_kind := 'program_membership';
      old_profile_id := nullif(old_record ->> 'profile_id', '')::uuid;
      old_program_id := nullif(old_record ->> 'program_id', '')::uuid;
      new_profile_id := nullif(new_record ->> 'profile_id', '')::uuid;
      new_program_id := nullif(new_record ->> 'program_id', '')::uuid;
      if tg_op = 'UPDATE' and row(old_profile_id, old_program_id)
        is distinct from row(new_profile_id, new_program_id) then
        perform private.bump_pilot_auth_lifecycle_signal(
          old_profile_id, old_program_id, signal_kind
        );
      end if;
      perform private.bump_pilot_auth_lifecycle_signal(
        case when tg_op = 'DELETE' then old_profile_id else new_profile_id end,
        case when tg_op = 'DELETE' then old_program_id else new_program_id end,
        signal_kind
      );
    when 'program_invitations' then
      signal_kind := 'invitation';
      old_profile_id := nullif(old_record ->> 'invitee_profile_id', '')::uuid;
      old_program_id := nullif(old_record ->> 'program_id', '')::uuid;
      new_profile_id := nullif(new_record ->> 'invitee_profile_id', '')::uuid;
      new_program_id := nullif(new_record ->> 'program_id', '')::uuid;
      if tg_op = 'UPDATE' and row(old_profile_id, old_program_id)
        is distinct from row(new_profile_id, new_program_id) then
        perform private.bump_pilot_auth_lifecycle_signal(
          old_profile_id, old_program_id, signal_kind
        );
      end if;
      perform private.bump_pilot_auth_lifecycle_signal(
        case when tg_op = 'DELETE' then old_profile_id else new_profile_id end,
        case when tg_op = 'DELETE' then old_program_id else new_program_id end,
        signal_kind
      );
    when 'program_enrollments' then
      signal_kind := 'enrollment';
      old_profile_id := nullif(old_record ->> 'profile_id', '')::uuid;
      old_program_id := nullif(old_record ->> 'program_id', '')::uuid;
      new_profile_id := nullif(new_record ->> 'profile_id', '')::uuid;
      new_program_id := nullif(new_record ->> 'program_id', '')::uuid;
      if tg_op = 'UPDATE' and row(old_profile_id, old_program_id)
        is distinct from row(new_profile_id, new_program_id) then
        perform private.bump_pilot_auth_lifecycle_signal(
          old_profile_id, old_program_id, signal_kind
        );
      end if;
      perform private.bump_pilot_auth_lifecycle_signal(
        case when tg_op = 'DELETE' then old_profile_id else new_profile_id end,
        case when tg_op = 'DELETE' then old_program_id else new_program_id end,
        signal_kind
      );
    else
      raise exception 'unsupported pilot auth lifecycle source: %', tg_table_name;
  end case;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists pilot_auth_lifecycle_signal on public.profiles;
create trigger pilot_auth_lifecycle_signal
before update of lifecycle_status or delete on public.profiles
for each row execute function private.signal_pilot_auth_lifecycle();

drop trigger if exists pilot_auth_lifecycle_signal on public.organization_memberships;
create trigger pilot_auth_lifecycle_signal
before insert or update of organization_id, profile_id, role, status, starts_at, ends_at or delete
on public.organization_memberships
for each row execute function private.signal_pilot_auth_lifecycle();

drop trigger if exists pilot_auth_lifecycle_signal on public.programs;
create trigger pilot_auth_lifecycle_signal
before update of organization_id, status, starts_on, ends_on or delete on public.programs
for each row execute function private.signal_pilot_auth_lifecycle();

drop trigger if exists pilot_auth_lifecycle_signal on public.program_memberships;
create trigger pilot_auth_lifecycle_signal
before insert or update of program_id, profile_id, role, status, joined_at, ended_at,
  auth_activated_at or delete on public.program_memberships
for each row execute function private.signal_pilot_auth_lifecycle();

drop trigger if exists pilot_auth_lifecycle_signal on public.program_invitations;
create trigger pilot_auth_lifecycle_signal
before insert or update of program_id, invitee_profile_id, role, status, invited_at,
  expires_at, accepted_at or delete
on public.program_invitations
for each row execute function private.signal_pilot_auth_lifecycle();

drop trigger if exists pilot_auth_lifecycle_signal on public.program_enrollments;
create trigger pilot_auth_lifecycle_signal
before insert or update of program_id, profile_id, lifecycle_status, enrolled_on,
  active_from, active_until, withdrawn_at, completed_at or delete
on public.program_enrollments
for each row execute function private.signal_pilot_auth_lifecycle();

insert into public.pilot_auth_lifecycle_signals (
  profile_id, program_id, revision, changed_at, change_kind
)
select association.profile_id, association.program_id, 1, statement_timestamp(),
  association.change_kind
from (
  select distinct on (candidate.profile_id, candidate.program_id)
    candidate.profile_id, candidate.program_id, candidate.change_kind
  from (
    select membership.profile_id, membership.program_id,
      'program_membership'::text as change_kind, 1 as priority
    from public.program_memberships membership
    union all
    select enrollment.profile_id, enrollment.program_id, 'enrollment', 2
    from public.program_enrollments enrollment
    union all
    select invitation.invitee_profile_id, invitation.program_id, 'invitation', 3
    from public.program_invitations invitation
    where invitation.invitee_profile_id is not null
  ) candidate
  order by candidate.profile_id, candidate.program_id, candidate.priority
) association
on conflict (profile_id, program_id) do nothing;

drop policy if exists pilot_auth_requires_activation on public.profiles;
create policy pilot_auth_requires_activation on public.profiles
as restrictive for all to authenticated
using (private.current_actor_is_active())
with check (private.current_actor_is_active());

drop policy if exists pilot_auth_requires_activation on public.organization_memberships;
create policy pilot_auth_requires_activation on public.organization_memberships
as restrictive for all to authenticated
using (private.current_actor_is_active())
with check (private.current_actor_is_active());

drop policy if exists pilot_auth_requires_activation on public.program_memberships;
create policy pilot_auth_requires_activation on public.program_memberships
as restrictive for all to authenticated
using (private.current_actor_is_active())
with check (private.current_actor_is_active());

drop policy if exists pilot_auth_invitation_self on public.program_invitations;
drop policy if exists pilot_auth_enrollment_self on public.program_enrollments;

drop policy if exists pilot_auth_lifecycle_signal_self
  on public.pilot_auth_lifecycle_signals;
create policy pilot_auth_lifecycle_signal_self
on public.pilot_auth_lifecycle_signals for select to authenticated
using (profile_id = (select auth.uid()));

do $$
declare
  lifecycle_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if (
    select publication.puballtables
    from pg_publication publication
    where publication.pubname = 'supabase_realtime'
  ) then
    raise exception 'supabase_realtime must use an explicit table list';
  end if;
  foreach lifecycle_table in array array[
    'profiles', 'organization_memberships', 'programs', 'program_memberships',
    'program_invitations', 'program_enrollments', 'pilot_auth_lifecycle_signals'
  ] loop
    if exists (
      select 1
      from pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = lifecycle_table
    ) then
      execute format(
        'alter publication supabase_realtime drop table public.%I',
        lifecycle_table
      );
    end if;
  end loop;
  alter publication supabase_realtime add table public.pilot_auth_lifecycle_signals (
    profile_id, program_id, revision, changed_at, change_kind
  );
end;
$$;

revoke all on private.pilot_magic_link_guards from public, anon, authenticated;
revoke all on private.pilot_auth_hook_events from public, anon, authenticated;
revoke all on function private.resolve_pilot_invitation(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_pilot_magic_link_delivery(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.bootstrap_pilot_membership() from public, anon, authenticated;
grant execute on function public.claim_pilot_magic_link_delivery(text, text, uuid) to service_role;
grant execute on function public.bootstrap_pilot_membership() to authenticated;
revoke all on function private.is_active_program_member(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.current_actor_is_active() from public, anon, authenticated;
revoke all on function private.current_actor_has_role(text[]) from public, anon, authenticated;
revoke all on function private.has_program_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.bump_pilot_auth_lifecycle_signal(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.signal_pilot_auth_profile_programs(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function private.signal_pilot_auth_program_profiles(uuid, text)
  from public, anon, authenticated;
revoke all on function private.signal_pilot_auth_lifecycle()
  from public, anon, authenticated;
grant execute on function private.is_active_program_member(uuid, uuid, text),
  private.current_actor_is_active(),
  private.current_actor_has_role(text[]),
  private.has_program_role(uuid, text[]),
  private.has_org_role(uuid, text[])
to authenticated;

comment on function public.claim_pilot_magic_link_delivery(text, text, uuid) is
  'Service-only Auth Hook claim: deduplicates signed hook events, applies a uniform email-hash guard, and permits delivery only for precreated active invitations.';
comment on function private.resolve_pilot_invitation(uuid, text, timestamptz) is
  'Selects the newest invitation deterministically and derives the shared profile, membership, program, organization, and enrollment lifecycle result used by delivery and callback.';
comment on function private.is_active_program_member(uuid, uuid, text) is
  'Authoritative direct-access gate: the newest invitation must be currently accepted and participants need a current enrollment; only cohorts with neither invitation nor enrollment retain legacy access.';
comment on function public.bootstrap_pilot_membership() is
  'Atomically accepts the latest valid invitation, creates participant enrollment, and resolves the server-owned pilot role and lifecycle.';
comment on table public.pilot_auth_lifecycle_signals is
  'Self-only auth invalidation projection. One current revision per profile/program bounds retention and carries no source-row payload.';
