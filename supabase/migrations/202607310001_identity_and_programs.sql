create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'deletion_requested', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('participant', 'coach', 'admin', 'stakeholder')),
  status text not null default 'active' check (status in ('active', 'suspended', 'ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.program_memberships (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('participant', 'coach', 'admin', 'stakeholder')),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (program_id, profile_id),
  check (ended_at is null or ended_at > joined_at)
);

create index if not exists organization_memberships_profile_active_idx
  on public.organization_memberships (profile_id, organization_id, role)
  where status = 'active';
create index if not exists programs_organization_idx on public.programs (organization_id);
create index if not exists program_memberships_profile_active_idx
  on public.program_memberships (profile_id, program_id, role)
  where status = 'active';

create or replace function private.has_org_role(target_organization uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization
      and membership.profile_id = (select auth.uid())
      and membership.role = any(allowed_roles)
      and membership.status = 'active'
      and (membership.ends_at is null or membership.ends_at > now())
  );
$$;

create or replace function private.has_program_role(target_program uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.program_memberships membership
    where membership.program_id = target_program
      and membership.profile_id = (select auth.uid())
      and membership.role = any(allowed_roles)
      and membership.status = 'active'
      and (membership.ended_at is null or membership.ended_at > now())
  );
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
drop trigger if exists programs_touch_updated_at on public.programs;
create trigger programs_touch_updated_at before update on public.programs
for each row execute function private.touch_updated_at();

create or replace function private.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Runner'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile after insert on auth.users
for each row execute function private.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.programs enable row level security;
alter table public.program_memberships enable row level security;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public;
revoke all on function private.has_program_role(uuid, text[]) from public;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.has_program_role(uuid, text[]) to authenticated;

comment on schema private is 'Security-definer helpers live outside exposed Data API schemas.';
comment on table public.organization_memberships is 'Authorization source of truth; never derive roles from user-editable JWT metadata.';
