create or replace function private.audit_details_are_content_free(target_details jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(target_details) = 'object' and not exists (
    select 1 from jsonb_each(target_details) detail
    where detail.key not in (
      'consent_grant_id', 'purpose', 'recipient_profile_id',
      'named_coach_grant_id', 'coach_profile_id', 'program_id', 'participant_profile_id'
    )
    or case
      when detail.key = 'purpose' then
        jsonb_typeof(detail.value) <> 'string'
        or detail.value #>> '{}' not in (
          'program_data_processing', 'named_coach_sensitive_metrics',
          'screenshot_ai', 'generative_feedback_ai', 'social_publication',
          'aggregate_analysis_reporting'
        )
      else
        jsonb_typeof(detail.value) not in ('string', 'null')
        or (jsonb_typeof(detail.value) = 'string' and detail.value #>> '{}'
          !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    end
  ), false);
$$;

create or replace function private.validate_audit_event_content()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.audit_details_are_content_free(new.details) then
    raise exception 'audit events cannot store bodies, values, prompts, or payloads'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger audit_events_content_free
before insert or update on public.audit_events
for each row execute function private.validate_audit_event_content();

create or replace function private.record_audit(
  target_organization uuid, actor_profile uuid, subject_profile uuid,
  target_event text, target_entity_type text, target_entity_id uuid,
  target_details jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.audit_details_are_content_free(coalesce(target_details, '{}'::jsonb)) then
    raise exception 'audit details must contain identifiers and event metadata only'
      using errcode = '23514';
  end if;
  insert into public.audit_events (
    organization_id, actor_profile_id, subject_profile_id,
    event_type, entity_type, entity_id, details
  ) values (
    target_organization, actor_profile, subject_profile,
    target_event, target_entity_type, target_entity_id, coalesce(target_details, '{}'::jsonb)
  );
end;
$$;

create table public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null,
  provider text not null,
  provider_project_id text,
  endpoint text not null,
  data_classes text[] not null,
  stated_purpose text not null,
  recipient text not null,
  recipient_profile_id uuid references public.profiles(id) on delete restrict,
  audience text not null,
  control text not null,
  processor_disclosure text,
  zero_data_retention_control text,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at timestamptz,
  withdrawn_by_profile_id uuid references public.profiles(id) on delete restrict,
  withdrawal_reason_code text,
  created_at timestamptz not null default now(),
  check (expires_at > granted_at),
  check (
    (status = 'active' and withdrawn_at is null
      and withdrawn_by_profile_id is null and withdrawal_reason_code is null)
    or (status = 'withdrawn' and withdrawn_at is not null
      and withdrawn_by_profile_id is not null and withdrawal_reason_code is not null)
  )
);

create table public.named_coach_grants (
  id uuid primary key default gen_random_uuid(),
  consent_grant_id uuid not null unique references public.consent_grants(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at timestamptz,
  withdrawn_by_profile_id uuid references public.profiles(id) on delete restrict,
  withdrawal_reason_code text
);

create or replace function private.is_active_named_coach(
  target_program uuid, target_participant uuid, target_coach uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.consent_grants consent
    join public.named_coach_grants coach_grant
      on coach_grant.consent_grant_id = consent.id
    join public.program_memberships membership
      on membership.program_id = coach_grant.program_id
      and membership.profile_id = coach_grant.coach_profile_id
      and membership.role = 'coach' and membership.status = 'active'
    where coach_grant.program_id = target_program
      and coach_grant.participant_profile_id = target_participant
      and coach_grant.coach_profile_id = target_coach
      and coach_grant.status = 'active' and coach_grant.expires_at > now()
      and consent.status = 'active' and consent.expires_at > now()
  );
$$;

alter table public.notification_records
  add column template_key text not null default 'generic_update',
  add column audience text not null default 'participant',
  add column preview_kind text not null default 'metadata_only',
  add column content_sensitivity text generated always as ('metadata_only'::text) stored;

update public.notification_records set
  title = case category
    when 'assignment' then 'Program assignment update'
    when 'announcement' then 'Program notice available'
    when 'feedback' then 'Coach feedback available'
    else 'Program reminder'
  end,
  body = 'Open PLUS Run to view this update.',
  contains_sensitive_data = false,
  template_key = case category
    when 'assignment' then 'assignment_update'
    when 'announcement' then 'announcement_available'
    when 'feedback' then 'feedback_available'
    else 'program_reminder'
  end,
  audience = 'participant', preview_kind = 'metadata_only';

alter table public.notification_records
  add constraint notification_records_template_key_check check (
    template_key in (
      'assignment_update', 'announcement_available', 'feedback_available', 'program_reminder'
    )
  ),
  add constraint notification_records_audience_check check (audience = 'participant'),
  add constraint notification_records_preview_kind_check check (preview_kind = 'metadata_only'),
  add constraint notification_records_generic_body_check check (
    body = 'Open PLUS Run to view this update.'
  );

create or replace function private.enforce_notification_metadata_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := case new.category
    when 'assignment' then 'Program assignment update'
    when 'announcement' then 'Program notice available'
    when 'feedback' then 'Coach feedback available'
    else 'Program reminder'
  end;
  new.body := 'Open PLUS Run to view this update.';
  new.contains_sensitive_data := false;
  new.template_key := case new.category
    when 'assignment' then 'assignment_update'
    when 'announcement' then 'announcement_available'
    when 'feedback' then 'feedback_available'
    else 'program_reminder'
  end;
  new.audience := 'participant';
  new.preview_kind := 'metadata_only';
  return new;
end;
$$;

create trigger notification_records_metadata_only
before insert or update of
  category, title, body, contains_sensitive_data, template_key, audience, preview_kind
on public.notification_records
for each row execute function private.enforce_notification_metadata_only();
