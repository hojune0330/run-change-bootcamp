create table if not exists public.metric_consents (
  id uuid primary key default gen_random_uuid(),
  metric_record_id uuid not null references public.metric_records(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  grantee_profile_id uuid not null references public.profiles(id) on delete cascade,
  grantee_role text not null check (grantee_role in ('coach', 'admin', 'stakeholder')),
  purpose text not null check (char_length(purpose) between 1 and 240),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) <= 500),
  check (owner_profile_id <> grantee_profile_id),
  check (expires_at > granted_at),
  check (revoked_at is null or revoked_at >= granted_at)
);

create unique index if not exists metric_consents_one_unrevoked_idx
  on public.metric_consents (metric_record_id, grantee_profile_id)
  where revoked_at is null;
create index if not exists metric_consents_grantee_active_idx
  on public.metric_consents (grantee_profile_id, metric_record_id, expires_at)
  where revoked_at is null;

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  subject_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_org_time_idx on public.audit_events (organization_id, occurred_at desc);
create index if not exists audit_events_subject_time_idx on public.audit_events (subject_profile_id, occurred_at desc);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (profile_id, status),
  check (completed_at is null or completed_at >= requested_at)
);

create or replace function private.record_audit(
  target_organization uuid,
  actor_profile uuid,
  subject_profile uuid,
  target_event text,
  target_entity_type text,
  target_entity_id uuid,
  target_details jsonb default '{}'::jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (
    organization_id, actor_profile_id, subject_profile_id,
    event_type, entity_type, entity_id, details
  ) values (
    target_organization, actor_profile, subject_profile,
    target_event, target_entity_type, target_entity_id,
    coalesce(target_details, '{}'::jsonb)
  );
$$;

create or replace function private.validate_metric_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  metric_owner uuid;
  metric_program uuid;
  metric_organization uuid;
begin
  if tg_op = 'UPDATE' and old.revoked_at is not null then
    if new.revoked_at is null then
      raise exception 'revoked consent rows cannot be reactivated; create a new grant'
        using errcode = '23514';
    end if;
    raise exception 'revoked consent rows are immutable; create a new grant'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.metric_record_id is distinct from old.metric_record_id
    or new.owner_profile_id is distinct from old.owner_profile_id
    or new.grantee_profile_id is distinct from old.grantee_profile_id
    or new.grantee_role is distinct from old.grantee_role
    or new.purpose is distinct from old.purpose
    or new.granted_at is distinct from old.granted_at
    or new.expires_at is distinct from old.expires_at
    or (
      old.revoked_at is null
      and new.revoked_at is null
      and new.revocation_reason is distinct from old.revocation_reason
    )
  ) then
    raise exception 'consent grant fields are immutable; revoke and create a new grant'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    return new;
  end if;
  select metric.owner_profile_id, metric.program_id, program.organization_id
    into metric_owner, metric_program, metric_organization
  from public.metric_records metric
  join public.programs program on program.id = metric.program_id
  where metric.id = new.metric_record_id;

  if metric_owner is null or metric_owner <> new.owner_profile_id then
    raise exception 'consent owner must own the metric' using errcode = '23514';
  end if;
  if new.expires_at <= now() then
    raise exception 'consent must expire in the future' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.programs active_program
    where active_program.id = metric_program
      and active_program.status = 'active'
      and current_date between active_program.starts_on and active_program.ends_on
  ) then
    raise exception 'consent requires an active program window' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.program_memberships program_member
    join public.organization_memberships organization_member
      on organization_member.organization_id = metric_organization
      and organization_member.profile_id = program_member.profile_id
    where program_member.program_id = metric_program
      and program_member.profile_id = new.grantee_profile_id
      and program_member.role = new.grantee_role
      and program_member.status = 'active'
      and program_member.joined_at <= now()
      and (program_member.ended_at is null or program_member.ended_at > now())
      and organization_member.role = new.grantee_role
      and organization_member.status = 'active'
      and organization_member.starts_at <= now()
      and (organization_member.ends_at is null or organization_member.ends_at > now())
  ) then
    raise exception 'grantee must have the active same-organization role' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists metric_consents_validate on public.metric_consents;
create trigger metric_consents_validate before insert or update on public.metric_consents
for each row execute function private.validate_metric_consent();

create or replace function private.audit_metric_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_organization uuid;
  target_event text;
begin
  select program.organization_id into target_organization
  from public.metric_records metric
  join public.programs program on program.id = metric.program_id
  where metric.id = new.metric_record_id;

  if tg_op = 'INSERT' then
    target_event := 'consent.granted';
  elsif old.revoked_at is null and new.revoked_at is not null then
    target_event := 'consent.revoked';
  else
    target_event := 'consent.changed';
  end if;
  perform private.record_audit(
    target_organization, new.owner_profile_id, new.owner_profile_id,
    target_event, 'metric_consent', new.id,
    jsonb_build_object('metric_record_id', new.metric_record_id, 'grantee_profile_id', new.grantee_profile_id)
  );
  return new;
end;
$$;

drop trigger if exists metric_consents_audit on public.metric_consents;
create trigger metric_consents_audit after insert or update on public.metric_consents
for each row execute function private.audit_metric_consent();

create or replace function private.can_read_metric(target_metric uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.metric_records metric
    join public.programs program on program.id = metric.program_id
    where metric.id = target_metric
      and (
        metric.owner_profile_id = (select auth.uid())
        or (
          metric.sensitivity = 'activity'
          and private.has_program_role(metric.program_id, array['coach', 'admin'])
        )
        or exists (
          select 1
          from public.metric_consents consent
          join public.program_memberships member
            on member.program_id = metric.program_id
            and member.profile_id = consent.grantee_profile_id
            and member.role = consent.grantee_role
            and member.status = 'active'
          join public.organization_memberships organization_member
            on organization_member.organization_id = program.organization_id
            and organization_member.profile_id = consent.grantee_profile_id
            and organization_member.role = consent.grantee_role
            and organization_member.status = 'active'
          where consent.metric_record_id = metric.id
            and consent.owner_profile_id = metric.owner_profile_id
            and consent.grantee_profile_id = (select auth.uid())
            and consent.revoked_at is null
            and consent.expires_at > now()
            and program.status = 'active'
            and current_date between program.starts_on and program.ends_on
            and member.joined_at <= now()
            and (member.ended_at is null or member.ended_at > now())
            and organization_member.starts_at <= now()
            and (organization_member.ends_at is null or organization_member.ends_at > now())
        )
      )
  );
$$;

create or replace function private.mark_deletion_requested()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set lifecycle_status = 'deletion_requested' where id = new.profile_id;
  perform private.record_audit(null, new.profile_id, new.profile_id, 'account.deletion_requested', 'account_deletion_request', new.id);
  return new;
end;
$$;

drop trigger if exists account_deletion_requested_audit on public.account_deletion_requests;
create trigger account_deletion_requested_audit after insert on public.account_deletion_requests
for each row execute function private.mark_deletion_requested();

create or replace function private.restore_cancelled_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status and new.status = 'cancelled' then
    update public.profiles set lifecycle_status = 'active' where id = new.profile_id;
    perform private.record_audit(
      null, new.profile_id, new.profile_id, 'account.deletion_cancelled',
      'account_deletion_request', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists account_deletion_cancelled_audit on public.account_deletion_requests;
create trigger account_deletion_cancelled_audit after update of status on public.account_deletion_requests
for each row when (new.status = 'cancelled')
execute function private.restore_cancelled_deletion();

alter table public.metric_consents enable row level security;
alter table public.audit_events enable row level security;
alter table public.account_deletion_requests enable row level security;

revoke all on function private.record_audit(uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.can_read_metric(uuid) from public;
grant execute on function private.can_read_metric(uuid) to authenticated;

comment on table public.metric_consents is 'One metric and one named grantee per consent; revocation and expiry are checked at read time.';
comment on table public.audit_events is 'Append-only security history. Details must contain identifiers, not copied health values or free-text PII.';
