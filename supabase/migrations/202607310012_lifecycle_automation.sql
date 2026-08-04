do $$
declare
  required_contract record;
  actual_type text;
begin
  if to_regclass('public.consent_grants') is null then
    raise exception 'public.consent_grants from migration 202607310011 is required'
      using errcode = '42P01';
  end if;
  for required_contract in
    select * from (values
      ('id', 'uuid'),
      ('program_id', 'uuid'),
      ('participant_profile_id', 'uuid'),
      ('purpose', 'text'),
      ('status', 'text'),
      ('granted_at', 'timestamp with time zone'),
      ('expires_at', 'timestamp with time zone'),
      ('withdrawn_at', 'timestamp with time zone'),
      ('provider', 'text'),
      ('provider_project_id', 'text'),
      ('endpoint', 'text'),
      ('data_classes', 'text[]'),
      ('zero_data_retention_control', 'text'),
      ('processor_disclosure', 'text')
    ) as required(column_name, type_name)
  loop
    select format_type(attribute.atttypid, attribute.atttypmod)
    into actual_type
    from pg_attribute attribute
    where attribute.attrelid = 'public.consent_grants'::regclass
      and attribute.attname = required_contract.column_name
      and not attribute.attisdropped;
    if actual_type is distinct from required_contract.type_name then
      raise exception 'public.consent_grants.% must be %, found %',
        required_contract.column_name, required_contract.type_name, actual_type
        using errcode = '42703';
    end if;
  end loop;
  if to_regprocedure('private.audit_details_are_content_free(jsonb)') is null
    or to_regprocedure('private.validate_audit_event_content()') is null
    or to_regprocedure('private.record_audit(uuid,uuid,uuid,text,text,uuid,jsonb)') is null
    or to_regprocedure('private.is_active_named_coach(uuid,uuid,uuid)') is null then
    raise exception 'migration 202607310011 audit and named-coach contracts are required'
      using errcode = '42883';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.audit_events'::regclass
      and tgname = 'audit_events_content_free'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.notification_records'::regclass
      and tgname = 'notification_records_metadata_only'
      and not tgisinternal
  ) then
    raise exception 'migration 202607310011 audit and notification triggers are required'
      using errcode = '42710';
  end if;
end;
$$;

create table private.lifecycle_hmac_keys (
  purpose text primary key check (purpose in (
    'structured_import_duplicates', 'account_deletion_tombstones', 'ai_control_evidence'
  )),
  secret_value text not null check (char_length(secret_value) >= 32),
  activated_at timestamptz not null default now(),
  retired_at timestamptz,
  check (retired_at is null or retired_at > activated_at)
);

create or replace function private.set_lifecycle_hmac_key(target_purpose text, target_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_purpose not in (
    'structured_import_duplicates', 'account_deletion_tombstones', 'ai_control_evidence'
  ) or char_length(target_secret) < 32 then
    raise exception 'invalid lifecycle HMAC key' using errcode = '22023';
  end if;
  insert into private.lifecycle_hmac_keys (purpose, secret_value)
  values (target_purpose, target_secret)
  on conflict (purpose) do update set
    secret_value = excluded.secret_value,
    activated_at = now(),
    retired_at = null;
  if target_purpose = 'account_deletion_tombstones' then
    update public.account_deletion_requests deletion
    set subject_tombstone_hmac = encode(extensions.hmac(
      jsonb_build_object('profile_id', deletion.profile_id)::text,
      target_secret,
      'sha256'
    ), 'hex')
    where deletion.subject_tombstone_hmac is null
      and deletion.profile_id is not null;
  end if;
end;
$$;

create or replace function private.lifecycle_hmac(target_purpose text, canonical_payload jsonb)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  server_secret text;
begin
  select secret_value into server_secret
  from private.lifecycle_hmac_keys
  where purpose = target_purpose and retired_at is null;
  if server_secret is null then
    raise exception 'lifecycle HMAC key is unavailable' using errcode = '55000';
  end if;
  return encode(extensions.hmac(canonical_payload::text, server_secret, 'sha256'), 'hex');
end;
$$;

create table private.import_parser_registry (
  format text primary key check (format in ('csv', 'fit', 'gpx', 'tcx', 'apple-xml', 'samsung-json')),
  parser_name text not null check (char_length(parser_name) between 1 and 120),
  parser_version text not null check (char_length(parser_version) between 1 and 80)
);

insert into private.import_parser_registry (format, parser_name, parser_version) values
  ('csv', 'plus_run_csv_adapter', '1'),
  ('fit', 'plus_run_fit_adapter', '1'),
  ('gpx', 'plus_run_gpx_adapter', '1'),
  ('tcx', 'plus_run_tcx_adapter', '1'),
  ('apple-xml', 'plus_run_apple_xml_adapter', '1'),
  ('samsung-json', 'plus_run_samsung_json_adapter', '1');

create or replace function private.program_identified_retention_deadline(target_ends_on date)
returns timestamptz language sql immutable set search_path = '' as $$
  select (target_ends_on::timestamp at time zone 'Asia/Seoul') + interval '30 days';
$$;

create or replace function private.aggregate_retention_deadline(target_generated_at timestamptz)
returns timestamptz language sql immutable set search_path = '' as $$
  select target_generated_at + interval '12 months';
$$;

create table public.ai_control_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'openai'),
  provider_project_id text not null check (char_length(provider_project_id) between 3 and 120),
  endpoint text not null check (endpoint = '/v1/responses'),
  zero_data_retention_control text not null
    check (zero_data_retention_control = 'approved_project_endpoint_zdr'),
  purposes text[] not null check (
    cardinality(purposes) between 1 and 2
    and purposes <@ array['screenshot_ai', 'generative_feedback_ai']::text[]
    and (cardinality(purposes) = 1 or purposes[1] <> purposes[2])
  ),
  data_classes text[] not null check (
    cardinality(data_classes) between 2 and 4
    and cardinality(data_classes) = 2 * cardinality(purposes)
    and data_classes <@ array[
      'server_sanitized_screenshot_pixels', 'reviewable_metric_draft',
      'approved_nonsensitive_training_context', 'feedback_draft'
    ]::text[]
  ),
  approval_reference_hash text not null check (approval_reference_hash ~ '^[0-9a-f]{64}$'),
  store_false_required boolean not null default true check (store_false_required),
  approved_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_project_id, endpoint, approved_at),
  check (expires_at > approved_at),
  check (revoked_at is null or revoked_at >= approved_at),
  check (
    (purposes = array['screenshot_ai']::text[]
      and data_classes = array[
        'server_sanitized_screenshot_pixels', 'reviewable_metric_draft'
      ]::text[])
    or (purposes = array['generative_feedback_ai']::text[]
      and data_classes = array[
        'approved_nonsensitive_training_context', 'feedback_draft'
      ]::text[])
    or (purposes = array['screenshot_ai', 'generative_feedback_ai']::text[]
      and data_classes = array[
        'server_sanitized_screenshot_pixels', 'reviewable_metric_draft',
        'approved_nonsensitive_training_context', 'feedback_draft'
      ]::text[])
  ),
  check (
    ('screenshot_ai' = any(purposes))
      = ('server_sanitized_screenshot_pixels' = any(data_classes))
    and ('screenshot_ai' = any(purposes))
      = ('reviewable_metric_draft' = any(data_classes))
    and ('generative_feedback_ai' = any(purposes))
      = ('approved_nonsensitive_training_context' = any(data_classes))
    and ('generative_feedback_ai' = any(purposes))
      = ('feedback_draft' = any(data_classes))
  )
);

create or replace function private.register_ai_control_attestation(
  target_organization uuid,
  target_project text,
  target_endpoint text,
  target_purposes text[],
  target_data_classes text[],
  target_approval_reference text,
  target_approved_at timestamptz,
  target_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  attestation_id uuid;
begin
  insert into public.ai_control_attestations (
    organization_id, provider, provider_project_id, endpoint,
    zero_data_retention_control, purposes, data_classes,
    approval_reference_hash, approved_at, expires_at
  ) values (
    target_organization, 'openai', target_project, target_endpoint,
    'approved_project_endpoint_zdr', target_purposes, target_data_classes,
    private.lifecycle_hmac(
      'ai_control_evidence',
      jsonb_build_object('organization_id', target_organization, 'reference', target_approval_reference)
    ),
    target_approved_at, target_expires_at
  ) returning id into attestation_id;
  return attestation_id;
end;
$$;

create or replace function private.assert_active_consent(
  target_consent uuid,
  target_program uuid,
  target_participant uuid,
  target_purpose text,
  target_at timestamptz,
  target_project text,
  target_endpoint text,
  target_data_classes text[]
)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  consent public.consent_grants;
  expected_data_classes text[];
begin
  select * into consent from public.consent_grants where id = target_consent;
  if consent.id is null
    or consent.program_id <> target_program
    or consent.participant_profile_id <> target_participant
    or consent.purpose <> target_purpose
    or consent.status <> 'active'
    or consent.granted_at > target_at
    or consent.expires_at <= target_at
    or (consent.withdrawn_at is not null and consent.withdrawn_at <= target_at) then
    raise exception 'active purpose consent is required' using errcode = '23514';
  end if;
  if target_project is not null then
    expected_data_classes := case target_purpose
      when 'screenshot_ai' then
        array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft']::text[]
      when 'generative_feedback_ai' then
        array['approved_nonsensitive_training_context', 'feedback_draft']::text[]
      else null
    end;
    if expected_data_classes is null
      or target_endpoint <> '/v1/responses'
      or target_data_classes <> expected_data_classes
      or consent.provider <> 'openai'
      or consent.provider_project_id is distinct from target_project
      or consent.endpoint <> target_endpoint
      or consent.processor_disclosure <> 'openai_subprocessor_disclosed'
      or consent.zero_data_retention_control <> 'approved_project_endpoint_zdr'
      or consent.data_classes <> expected_data_classes then
      raise exception 'consent AI controls do not match the approved boundary'
        using errcode = '23514';
    end if;
  end if;
end;
$$;

create or replace function private.assert_ai_control(
  target_attestation uuid,
  target_consent uuid,
  target_program uuid,
  target_participant uuid,
  target_purpose text,
  target_data_classes text[],
  target_at timestamptz
)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  attestation public.ai_control_attestations;
  program_organization uuid;
  expected_data_classes text[];
begin
  select * into attestation from public.ai_control_attestations where id = target_attestation;
  select organization_id into program_organization
  from public.programs where id = target_program;
  expected_data_classes := case target_purpose
    when 'screenshot_ai' then
      array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft']::text[]
    when 'generative_feedback_ai' then
      array['approved_nonsensitive_training_context', 'feedback_draft']::text[]
    else null
  end;
  if attestation.id is null
    or program_organization is null
    or attestation.organization_id <> program_organization
    or attestation.provider <> 'openai'
    or attestation.endpoint <> '/v1/responses'
    or attestation.zero_data_retention_control <> 'approved_project_endpoint_zdr'
    or not target_purpose = any(attestation.purposes)
    or expected_data_classes is null
    or target_data_classes <> expected_data_classes
    or not target_data_classes <@ attestation.data_classes
    or attestation.approved_at > target_at
    or attestation.expires_at <= target_at
    or (attestation.revoked_at is not null and attestation.revoked_at <= target_at) then
    raise exception 'approved project endpoint ZDR attestation is required' using errcode = '23514';
  end if;
  perform private.assert_active_consent(
    target_consent, target_program, target_participant, target_purpose, target_at,
    attestation.provider_project_id, attestation.endpoint, target_data_classes
  );
end;
$$;

create table public.accepted_structured_imports (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_grant_id uuid not null references public.consent_grants(id) on delete restrict,
  format text not null check (format in ('csv', 'fit', 'gpx', 'tcx', 'apple-xml', 'samsung-json')),
  observed_at timestamptz not null,
  source_family text not null check (char_length(source_family) between 1 and 80),
  source_model text check (source_model is null or char_length(source_model) between 1 and 120),
  parser_name text not null check (char_length(parser_name) between 1 and 120),
  parser_version text not null check (char_length(parser_version) between 1 and 80),
  timezone text not null check (timezone = 'Asia/Seoul'),
  quality_flags text[] not null default '{}'::text[] check (
    cardinality(quality_flags) <= 12
    and quality_flags <@ array[
      'device_reported', 'estimated', 'corrected', 'partial',
      'timezone_inferred', 'duplicate_suspected'
    ]::text[]
  ),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object' and metrics <> '{}'::jsonb),
  server_duplicate_hmac text not null check (server_duplicate_hmac ~ '^[0-9a-f]{64}$'),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz not null default now(),
  delete_after timestamptz not null,
  unique (program_id, participant_profile_id, server_duplicate_hmac)
);

create or replace function private.validate_structured_import()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  program_ends_on date;
begin
  if new.quality_flags <> (
    select coalesce(array_agg(allowed.flag order by allowed.ordinality), '{}'::text[])
    from unnest(array[
      'device_reported', 'estimated', 'corrected', 'partial',
      'timezone_inferred', 'duplicate_suspected'
    ]::text[]) with ordinality as allowed(flag, ordinality)
    where allowed.flag = any(new.quality_flags)
  ) then
    raise exception 'quality flags must use the canonical unique order' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_each(new.metrics)
    where key not in (
      'distanceM', 'durationS', 'paceSecondsPerKm', 'averageHeartRateBpm',
      'maxHeartRateBpm', 'steps', 'elevationGainM'
    ) or jsonb_typeof(value) <> 'number'
  ) then
    raise exception 'structured metrics contain a forbidden key or nonnumeric value'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_each_text(new.metrics)
    where value::numeric < 0
      or (key in ('distanceM', 'durationS', 'paceSecondsPerKm') and value::numeric <= 0)
      or (key in ('averageHeartRateBpm', 'maxHeartRateBpm') and value::numeric not between 20 and 250)
      or (key = 'steps' and value::numeric <> trunc(value::numeric))
  ) then
    raise exception 'structured metrics are outside the accepted domain' using errcode = '23514';
  end if;
  perform private.assert_active_consent(
    new.consent_grant_id, new.program_id, new.participant_profile_id,
    'program_data_processing', new.accepted_at, null, null, null
  );
  if not exists (
    select 1 from public.program_memberships
    where program_id = new.program_id
      and profile_id = new.participant_profile_id
      and role = 'participant'
      and status = 'active'
  ) then
    raise exception 'accepted import requires an active participant membership' using errcode = '23514';
  end if;
  select ends_on into program_ends_on from public.programs where id = new.program_id;
  new.delete_after := private.program_identified_retention_deadline(program_ends_on);
  return new;
end;
$$;

create trigger accepted_structured_imports_validate
before insert or update on public.accepted_structured_imports
for each row execute function private.validate_structured_import();

create or replace function private.accept_structured_import(
  target_program uuid,
  target_participant uuid,
  target_consent uuid,
  target_format text,
  target_observed_at timestamptz,
  target_source_family text,
  target_timezone text,
  target_quality_flags text[],
  target_metrics jsonb,
  target_accepted_by uuid,
  target_source_model text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  import_id uuid;
  duplicate_hmac text;
  server_parser_name text;
  server_parser_version text;
  canonical_quality_flags text[];
begin
  select parser_name, parser_version
  into server_parser_name, server_parser_version
  from private.import_parser_registry
  where format = target_format;
  if server_parser_name is null or server_parser_version is null then
    raise exception 'server parser registry has no accepted adapter' using errcode = '22023';
  end if;
  if target_quality_flags is null
    or array_position(target_quality_flags, null) is not null
    or not target_quality_flags <@ array[
      'device_reported', 'estimated', 'corrected', 'partial',
      'timezone_inferred', 'duplicate_suspected'
    ]::text[] then
    raise exception 'quality flags are not allowlisted' using errcode = '22023';
  end if;
  select coalesce(array_agg(allowed.flag order by allowed.ordinality), '{}'::text[])
  into canonical_quality_flags
  from unnest(array[
    'device_reported', 'estimated', 'corrected', 'partial',
    'timezone_inferred', 'duplicate_suspected'
  ]::text[]) with ordinality as allowed(flag, ordinality)
  where allowed.flag = any(target_quality_flags);
  duplicate_hmac := private.lifecycle_hmac(
    'structured_import_duplicates',
    jsonb_build_object(
      'program_id', target_program,
      'participant_profile_id', target_participant,
      'format', target_format,
      'observed_at', target_observed_at,
      'source_family', target_source_family,
      'source_model', target_source_model,
      'parser_name', server_parser_name,
      'parser_version', server_parser_version,
      'timezone', target_timezone,
      'quality_flags', canonical_quality_flags,
      'metrics', target_metrics
    )
  );
  insert into public.accepted_structured_imports (
    program_id, participant_profile_id, consent_grant_id, format, observed_at,
    source_family, source_model, parser_name, parser_version, timezone,
    quality_flags, metrics, server_duplicate_hmac, accepted_by, delete_after
  ) values (
    target_program, target_participant, target_consent, target_format, target_observed_at,
    target_source_family, target_source_model, server_parser_name, server_parser_version,
    target_timezone, canonical_quality_flags, target_metrics, duplicate_hmac,
    target_accepted_by, now()
  ) returning id into import_id;
  return import_id;
end;
$$;

create table public.screenshot_draft_jobs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_grant_id uuid not null references public.consent_grants(id) on delete restrict,
  ai_control_attestation_id uuid not null references public.ai_control_attestations(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_length integer not null check (byte_length between 1 and 8388608),
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  error_code text check (
    error_code is null or error_code in (
      'provider_unavailable', 'provider_timeout', 'unsupported_image', 'invalid_response', 'consent_inactive'
    )
  ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata_expires_at timestamptz not null,
  unique (participant_profile_id, idempotency_key),
  check ((status = 'processing') = (completed_at is null)),
  check ((status = 'failed') = (error_code is not null))
);

create or replace function private.validate_screenshot_draft_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.program_id is distinct from old.program_id
    or new.participant_profile_id is distinct from old.participant_profile_id
    or new.consent_grant_id is distinct from old.consent_grant_id
    or new.ai_control_attestation_id is distinct from old.ai_control_attestation_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.mime_type is distinct from old.mime_type
    or new.byte_length is distinct from old.byte_length
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'screenshot job request metadata is immutable' using errcode = '23514';
  end if;
  perform private.assert_ai_control(
    new.ai_control_attestation_id, new.consent_grant_id, new.program_id,
    new.participant_profile_id, 'screenshot_ai',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft']::text[],
    new.created_at
  );
  if new.status = 'processing' then
    new.completed_at := null;
    new.error_code := null;
    new.metadata_expires_at := new.created_at + interval '7 days';
  elsif new.status = 'succeeded' then
    new.completed_at := coalesce(new.completed_at, now());
    new.error_code := null;
    new.metadata_expires_at := new.completed_at + interval '24 hours';
  else
    new.completed_at := coalesce(new.completed_at, now());
    new.metadata_expires_at := new.created_at + interval '7 days';
  end if;
  return new;
end;
$$;

create trigger screenshot_draft_jobs_validate
before insert or update on public.screenshot_draft_jobs
for each row execute function private.validate_screenshot_draft_job();

create or replace function private.create_screenshot_draft_job(
  target_program uuid,
  target_participant uuid,
  target_consent uuid,
  target_attestation uuid,
  target_idempotency_key text,
  target_mime_type text,
  target_byte_length integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  job_id uuid;
begin
  insert into public.screenshot_draft_jobs (
    program_id, participant_profile_id, consent_grant_id, ai_control_attestation_id,
    idempotency_key, mime_type, byte_length, metadata_expires_at
  ) values (
    target_program, target_participant, target_consent, target_attestation,
    target_idempotency_key, target_mime_type, target_byte_length, now()
  )
  on conflict (participant_profile_id, idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning id into job_id;
  return job_id;
end;
$$;

alter table public.feedback_items
  add column consent_grant_id uuid references public.consent_grants(id) on delete restrict,
  add column ai_control_attestation_id uuid references public.ai_control_attestations(id) on delete restrict;

alter table public.feedback_items
  add constraint feedback_items_ai_control_link_check check (
    (origin = 'ai') = (consent_grant_id is not null and ai_control_attestation_id is not null)
  ) not valid;

alter table public.feedback_review_events
  add column consent_grant_id uuid references public.consent_grants(id) on delete restrict;

create or replace function private.validate_feedback_ai_controls()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.origin = 'ai' then
    if new.consent_grant_id is null or new.ai_control_attestation_id is null then
      raise exception 'generative feedback requires consent and ZDR attestation' using errcode = '23514';
    end if;
    perform private.assert_ai_control(
      new.ai_control_attestation_id, new.consent_grant_id, new.program_id,
      new.participant_id, 'generative_feedback_ai',
      array['approved_nonsensitive_training_context', 'feedback_draft']::text[],
      new.created_at
    );
    if new.status = 'published' and (
      new.approved_by is null
      or new.approved_at is null
      or not coalesce(private.is_active_named_coach(
        new.program_id, new.participant_id, new.approved_by
      ), false)
    ) then
      raise exception 'generative feedback requires named coach review' using errcode = '23514';
    end if;
  elsif new.consent_grant_id is not null or new.ai_control_attestation_id is not null then
    raise exception 'coach feedback cannot claim AI control evidence' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger feedback_items_ai_controls_validate
before insert or update on public.feedback_items
for each row execute function private.validate_feedback_ai_controls();

create table public.notification_preferences (
  participant_profile_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  quiet_starts_at time not null default time '21:00' check (quiet_starts_at = time '21:00'),
  quiet_ends_at time not null default time '08:00' check (quiet_ends_at = time '08:00'),
  nonurgent_daily_cap smallint not null default 3 check (nonurgent_daily_cap = 3),
  digest text not null default 'daily' check (digest in ('off', 'daily')),
  channels text[] not null default array['in_app']::text[] check (
    cardinality(channels) between 1 and 2
    and channels <@ array['in_app', 'push']::text[]
    and (cardinality(channels) = 1 or channels[1] <> channels[2])
  ),
  updated_at timestamptz not null default now()
);

alter table public.notification_records
  add column urgency text,
  add column timezone text,
  add column scheduled_at timestamptz,
  add column local_day date,
  add column logical_event_key text;

update public.notification_records set
  urgency = 'nonurgent',
  timezone = 'Asia/Seoul',
  scheduled_at = created_at,
  local_day = (created_at at time zone 'Asia/Seoul')::date,
  logical_event_key = 'legacy:' || id::text;

alter table public.notification_records
  alter column urgency set not null,
  alter column timezone set not null,
  alter column scheduled_at set not null,
  alter column local_day set not null,
  alter column logical_event_key set not null,
  add constraint notification_records_urgency_check check (urgency in ('urgent', 'nonurgent')),
  add constraint notification_records_timezone_check check (timezone = 'Asia/Seoul'),
  add constraint notification_records_event_key_check check (
    logical_event_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  ),
  add constraint notification_records_local_day_check check (
    local_day = (scheduled_at at time zone timezone)::date
  );

create unique index notification_records_logical_event_key
  on public.notification_records (recipient_profile_id, logical_event_key);
create index notification_records_daily_cap_idx
  on public.notification_records (recipient_profile_id, local_day, urgency);

create table public.notification_digest_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  category text not null check (category in ('assignment', 'announcement', 'feedback', 'reminder')),
  entity_type text check (entity_type is null or char_length(entity_type) between 1 and 80),
  entity_id uuid,
  logical_event_key text not null check (
    logical_event_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  ),
  local_day date not null,
  status text not null check (status in ('queued', 'suppressed', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (recipient_profile_id, logical_event_key),
  check ((status = 'sent') = (sent_at is not null))
);

create or replace function private.next_nonurgent_delivery(target_at timestamptz)
returns timestamptz language sql immutable set search_path = '' as $$
  select case
    when (target_at at time zone 'Asia/Seoul')::time >= time '21:00' then
      (((target_at at time zone 'Asia/Seoul')::date + 1) + time '08:00') at time zone 'Asia/Seoul'
    when (target_at at time zone 'Asia/Seoul')::time < time '08:00' then
      ((target_at at time zone 'Asia/Seoul')::date + time '08:00') at time zone 'Asia/Seoul'
    else target_at
  end;
$$;

create or replace function private.validate_notification_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local_time time;
begin
  new.urgency := coalesce(new.urgency, 'nonurgent');
  new.timezone := coalesce(new.timezone, 'Asia/Seoul');
  if new.scheduled_at is null then
    new.scheduled_at := private.next_nonurgent_delivery(coalesce(new.created_at, now()));
  end if;
  new.logical_event_key := coalesce(new.logical_event_key, 'legacy:' || new.id::text);
  new.local_day := coalesce(
    new.local_day,
    (new.scheduled_at at time zone new.timezone)::date
  );
  local_time := (new.scheduled_at at time zone new.timezone)::time;
  if new.urgency = 'nonurgent' and (local_time >= time '21:00' or local_time < time '08:00') then
    raise exception 'nonurgent notification is inside quiet hours' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.recipient_profile_id::text || ':' || new.local_day::text,
    0
  ));
  if new.urgency = 'nonurgent' and (
    select count(*) from public.notification_records
    where recipient_profile_id = new.recipient_profile_id
      and local_day = new.local_day
      and urgency = 'nonurgent'
  ) >= 3 then
    raise exception 'nonurgent notification daily cap reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger notification_records_validate_event
before insert on public.notification_records
for each row execute function private.validate_notification_event();

create or replace function private.enforce_notification_push_opt_in()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.channel = 'push' and not exists (
    select 1
    from public.notification_records notification
    join public.notification_preferences preference
      on preference.participant_profile_id = notification.recipient_profile_id
    where notification.id = new.notification_id
      and 'push' = any(preference.channels)
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger notification_outbox_push_opt_in
before insert or update of notification_id, channel on public.notification_outbox
for each row execute function private.enforce_notification_push_opt_in();

create or replace function private.enqueue_notification_event(
  target_recipient uuid,
  target_program uuid,
  target_category text,
  target_template text,
  target_entity_type text,
  target_entity_id uuid,
  target_event_key text,
  target_scheduled_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  event_id uuid;
  delivery_at timestamptz;
  delivery_day date;
  target_title text;
  target_body text;
  expected_template text;
  target_channels text[];
  target_digest text;
begin
  select id into event_id from public.notification_records
  where recipient_profile_id = target_recipient and logical_event_key = target_event_key;
  if event_id is not null then
    return event_id;
  end if;
  delivery_at := private.next_nonurgent_delivery(target_scheduled_at);
  delivery_day := (delivery_at at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(target_recipient::text || ':' || delivery_day::text, 0));
  select id into event_id from public.notification_records
  where recipient_profile_id = target_recipient and logical_event_key = target_event_key;
  if event_id is not null then
    return event_id;
  end if;
  select channels, digest into target_channels, target_digest
  from public.notification_preferences where participant_profile_id = target_recipient;
  target_channels := coalesce(target_channels, array['in_app']::text[]);
  target_digest := coalesce(target_digest, 'daily');
  target_title := case target_category
    when 'assignment' then 'Program assignment update'
    when 'announcement' then 'Program notice available'
    when 'feedback' then 'Coach feedback available'
    when 'reminder' then 'Program reminder'
    else null
  end;
  expected_template := case target_category
    when 'assignment' then 'assignment_update'
    when 'announcement' then 'announcement_available'
    when 'feedback' then 'feedback_available'
    when 'reminder' then 'program_reminder'
    else null
  end;
  if target_title is null or target_template is distinct from expected_template then
    raise exception 'notification template is not allowlisted' using errcode = '22023';
  end if;
  target_body := 'Open PLUS Run to view this update.';
  if (
    select count(*) from public.notification_records
    where recipient_profile_id = target_recipient
      and local_day = delivery_day
      and urgency = 'nonurgent'
  ) >= 3 then
    insert into public.notification_digest_queue (
      recipient_profile_id, program_id, category,
      entity_type, entity_id, logical_event_key, local_day, status
    ) values (
      target_recipient, target_program, target_category,
      target_entity_type, target_entity_id, target_event_key, delivery_day,
      case when target_digest = 'daily' then 'queued' else 'suppressed' end
    ) on conflict (recipient_profile_id, logical_event_key) do nothing;
    return null;
  end if;
  insert into public.notification_records (
    recipient_profile_id, program_id, category, template_key, title, body,
    contains_sensitive_data, entity_type, entity_id, urgency, timezone,
    scheduled_at, local_day, logical_event_key
  ) values (
    target_recipient, target_program, target_category, target_template, target_title, target_body,
    false, target_entity_type, target_entity_id, 'nonurgent', 'Asia/Seoul',
    delivery_at, delivery_day, target_event_key
  ) returning id into event_id;
  if 'in_app' = any(target_channels) then
    insert into public.notification_outbox (notification_id, channel, idempotency_key)
    values (event_id, 'in_app', target_event_key || ':in_app')
    on conflict (idempotency_key) do nothing;
  end if;
  if 'push' = any(target_channels) then
    insert into public.notification_outbox (notification_id, channel, idempotency_key)
    values (event_id, 'push', target_event_key || ':push')
    on conflict (idempotency_key) do nothing;
  end if;
  return event_id;
end;
$$;

create or replace function public.review_feedback(target_feedback uuid, target_decision text, review_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  feedback public.feedback_items;
  target_organization uuid;
begin
  if target_decision not in ('approved', 'rejected') then
    raise exception 'invalid feedback decision' using errcode = '22023';
  end if;
  select * into feedback from public.feedback_items where id = target_feedback for update;
  if feedback.id is null then
    raise exception 'feedback review forbidden' using errcode = '42501';
  end if;
  if (
    feedback.origin = 'ai'
    and not coalesce(private.is_active_named_coach(
      feedback.program_id, feedback.participant_id, (select auth.uid())
    ), false)
  ) or (
    feedback.origin <> 'ai'
    and not private.has_program_role(feedback.program_id, array['coach', 'admin'])
  ) then
    raise exception 'feedback review forbidden' using errcode = '42501';
  end if;
  if feedback.status <> 'pending_approval' then
    raise exception 'feedback is not pending approval' using errcode = '23514';
  end if;
  if target_decision = 'approved' then
    update public.feedback_items set
      status = 'published', approved_by = (select auth.uid()),
      approved_at = now(), published_at = now()
    where id = target_feedback;
    perform private.enqueue_notification_event(
      feedback.participant_id, feedback.program_id, 'feedback',
      'feedback_available', 'feedback_item', target_feedback,
      'feedback:' || target_feedback::text || ':published', now()
    );
  else
    update public.feedback_items set status = 'rejected' where id = target_feedback;
  end if;
  insert into public.feedback_review_events (
    feedback_id, reviewer_profile_id, decision, note, consent_grant_id
  ) values (
    target_feedback, (select auth.uid()), target_decision, review_note, feedback.consent_grant_id
  );
  select organization_id into target_organization from public.programs where id = feedback.program_id;
  perform private.record_audit(
    target_organization, (select auth.uid()), feedback.participant_id,
    'feedback.' || target_decision, 'feedback_item', target_feedback
  );
  return target_feedback;
end;
$$;

create or replace function private.finish_screenshot_draft_job(
  target_job uuid,
  target_status text,
  target_error_code text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_status not in ('succeeded', 'failed') then
    raise exception 'invalid screenshot terminal status' using errcode = '22023';
  end if;
  update public.screenshot_draft_jobs set
    status = target_status,
    error_code = case when target_status = 'failed' then target_error_code else null end,
    completed_at = now()
  where id = target_job and status = 'processing';
  if not found then
    raise exception 'screenshot job is not processing' using errcode = '23514';
  end if;
end;
$$;

create table public.retention_rules (
  rule_key text primary key,
  maximum_amount smallint not null check (maximum_amount > 0),
  unit text not null check (unit in ('hours', 'days', 'months', 'days_after_program_end')),
  created_at timestamptz not null default now()
);

insert into public.retention_rules (rule_key, maximum_amount, unit) values
  ('screenshot_terminal_metadata', 24, 'hours'),
  ('screenshot_pending_error_metadata', 7, 'days'),
  ('identified_program_data', 30, 'days_after_program_end'),
  ('content_free_audit', 180, 'days'),
  ('deidentified_aggregate', 12, 'months'),
  ('backup_vendor_tombstone', 30, 'days');

create or replace function private.reject_retention_rule_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'retention rules are migration-controlled' using errcode = '23514';
end;
$$;

create trigger retention_rules_immutable
before update or delete on public.retention_rules
for each row execute function private.reject_retention_rule_mutation();

alter table public.programs
  add column identified_data_delete_after timestamptz;

update public.programs
set identified_data_delete_after = private.program_identified_retention_deadline(ends_on);

alter table public.programs
  alter column identified_data_delete_after set not null,
  add constraint programs_identified_retention_check check (
    identified_data_delete_after = private.program_identified_retention_deadline(ends_on)
  );

create or replace function private.enforce_program_retention_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.identified_data_delete_after := private.program_identified_retention_deadline(new.ends_on);
  return new;
end;
$$;

create trigger programs_identified_retention_deadline
before insert or update of ends_on, identified_data_delete_after on public.programs
for each row execute function private.enforce_program_retention_deadline();

create table public.aggregate_retention_deadlines (
  snapshot_id uuid primary key
    references public.measurement_report_snapshots(id) on delete cascade,
  generated_at timestamptz not null,
  delete_after timestamptz not null,
  check (delete_after = private.aggregate_retention_deadline(generated_at))
);

insert into public.aggregate_retention_deadlines (snapshot_id, generated_at, delete_after)
select id, generated_at, private.aggregate_retention_deadline(generated_at)
from public.measurement_report_snapshots;

create or replace function private.sync_aggregate_retention_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.aggregate_retention_deadlines (snapshot_id, generated_at, delete_after)
  values (new.id, new.generated_at, private.aggregate_retention_deadline(new.generated_at))
  on conflict (snapshot_id) do update set
    generated_at = excluded.generated_at,
    delete_after = excluded.delete_after;
  return new;
end;
$$;

create trigger measurement_report_snapshots_retention_deadline
after insert or update of generated_at on public.measurement_report_snapshots
for each row execute function private.sync_aggregate_retention_deadline();

alter table public.audit_events
  add column expires_at timestamptz;

update public.audit_events
set details = '{}'::jsonb
where not private.audit_details_are_content_free(details);

update public.audit_events
set expires_at = occurred_at + interval '180 days';

alter table public.audit_events
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '180 days'),
  add constraint audit_events_task4_content_free_check check (
    private.audit_details_are_content_free(details)
  ),
  add constraint audit_events_retention_check check (
    expires_at >= occurred_at and expires_at <= occurred_at + interval '180 days'
  );

create or replace function private.enforce_audit_retention_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.expires_at := least(
    coalesce(new.expires_at, new.occurred_at + interval '180 days'),
    new.occurred_at + interval '180 days'
  );
  return new;
end;
$$;

create trigger audit_events_retention_deadline
before insert or update of occurred_at, expires_at on public.audit_events
for each row execute function private.enforce_audit_retention_deadline();

alter table public.account_deletion_requests
  drop constraint account_deletion_requests_profile_id_fkey,
  drop constraint account_deletion_requests_status_check,
  drop constraint account_deletion_requests_check,
  drop constraint account_deletion_requests_profile_id_status_key,
  alter column profile_id drop not null,
  add column subject_tombstone_hmac text,
  add column phase text not null default 'storage_live',
  add column storage_deleted_at timestamptz,
  add column database_deleted_at timestamptz,
  add column auth_deleted_at timestamptz,
  add column backup_vendor_tombstone_due_at timestamptz,
  add column backup_vendor_tombstone_recorded_at timestamptz,
  add column retry_count smallint not null default 0,
  add column next_retry_at timestamptz,
  add column last_error_code text,
  add column alert_state text not null default 'none';

update public.account_deletion_requests set
  backup_vendor_tombstone_due_at = requested_at + interval '30 days';

alter table public.account_deletion_requests
  alter column backup_vendor_tombstone_due_at set not null,
  add constraint account_deletion_requests_profile_id_fkey
    foreign key (profile_id) references public.profiles(id) on delete set null,
  add constraint account_deletion_requests_status_check check (
    status in ('requested', 'processing', 'retrying', 'completed', 'cancelled', 'failed')
  ),
  add constraint account_deletion_requests_phase_check check (
    phase in ('storage_live', 'database_live', 'auth_identity', 'backup_vendor_tombstone')
  ),
  add constraint account_deletion_requests_hmac_check check (
    subject_tombstone_hmac is null or subject_tombstone_hmac ~ '^[0-9a-f]{64}$'
  ),
  add constraint account_deletion_requests_retry_check check (retry_count between 0 and 20),
  add constraint account_deletion_requests_error_check check (
    last_error_code is null or last_error_code in (
      'storage_delete_failed', 'database_delete_failed', 'auth_delete_failed',
      'vendor_tombstone_failed', 'retry_exhausted'
    )
  ),
  add constraint account_deletion_requests_alert_check check (
    alert_state in ('none', 'warning', 'escalated')
  ),
  add constraint account_deletion_requests_order_check check (
    (storage_deleted_at is null or (
      storage_deleted_at >= requested_at
      and storage_deleted_at <= requested_at + interval '24 hours'
    ))
    and (database_deleted_at is null or (
      storage_deleted_at is not null
      and database_deleted_at >= storage_deleted_at
      and database_deleted_at <= requested_at + interval '7 days'
    ))
    and (auth_deleted_at is null or (
      database_deleted_at is not null
      and auth_deleted_at >= database_deleted_at
      and auth_deleted_at <= database_deleted_at + interval '15 minutes'
    ))
    and backup_vendor_tombstone_due_at <= requested_at + interval '30 days'
    and (backup_vendor_tombstone_recorded_at is null or (
      auth_deleted_at is not null
      and backup_vendor_tombstone_recorded_at >= auth_deleted_at
      and backup_vendor_tombstone_recorded_at <= backup_vendor_tombstone_due_at
    ))
    and (completed_at is null or completed_at >= requested_at)
  ) not valid,
  add constraint account_deletion_requests_phase_progress_check check (
    (phase = 'storage_live')
    or (phase = 'database_live' and storage_deleted_at is not null)
    or (phase = 'auth_identity' and storage_deleted_at is not null and database_deleted_at is not null)
    or (phase = 'backup_vendor_tombstone'
      and storage_deleted_at is not null and database_deleted_at is not null and auth_deleted_at is not null)
  ) not valid,
  add constraint account_deletion_requests_completed_check check (
    status <> 'completed'
    or (completed_at is not null and backup_vendor_tombstone_recorded_at is not null)
  ) not valid;

create unique index account_deletion_requests_one_active
  on public.account_deletion_requests (profile_id)
  where profile_id is not null and status in ('requested', 'processing', 'retrying');

create table public.account_deletion_tombstones (
  request_id uuid primary key references public.account_deletion_requests(id) on delete restrict,
  subject_tombstone_hmac text not null check (subject_tombstone_hmac ~ '^[0-9a-f]{64}$'),
  storage_deleted_at timestamptz not null,
  database_deleted_at timestamptz not null,
  auth_deleted_at timestamptz not null,
  backup_vendor_tombstone_recorded_at timestamptz not null,
  purge_after timestamptz not null,
  created_at timestamptz not null default now(),
  check (storage_deleted_at <= database_deleted_at),
  check (database_deleted_at <= auth_deleted_at),
  check (auth_deleted_at <= backup_vendor_tombstone_recorded_at),
  check (backup_vendor_tombstone_recorded_at <= purge_after)
);

create table public.deletion_job_alerts (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.account_deletion_requests(id) on delete cascade,
  alert_code text not null check (alert_code in (
    'storage_sla_missed', 'database_sla_missed', 'auth_immediacy_missed',
    'vendor_tombstone_due', 'retry_exhausted'
  )),
  severity text not null check (severity in ('warning', 'critical')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (request_id, alert_code),
  check (resolved_at is null or resolved_at >= opened_at)
);

create or replace function public.request_account_deletion()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  requester uuid;
  request_id uuid;
begin
  requester := (select auth.uid());
  if requester is null or not exists (select 1 from public.profiles where id = requester) then
    raise exception 'authenticated profile is required' using errcode = '42501';
  end if;
  insert into public.account_deletion_requests (
    profile_id, status, subject_tombstone_hmac, backup_vendor_tombstone_due_at
  ) values (
    requester,
    'requested',
    private.lifecycle_hmac('account_deletion_tombstones', jsonb_build_object('profile_id', requester)),
    now() + interval '30 days'
  ) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.cancel_account_deletion(target_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.account_deletion_requests set status = 'cancelled'
  where id = target_request
    and profile_id = (select auth.uid())
    and status = 'requested'
    and storage_deleted_at is null;
  if not found then
    raise exception 'deletion request cannot be cancelled' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.advance_account_deletion(
  target_request uuid,
  target_step text,
  target_occurred_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  deletion public.account_deletion_requests;
begin
  select * into deletion from public.account_deletion_requests where id = target_request for update;
  if deletion.id is null or deletion.status in ('completed', 'cancelled', 'failed') then
    raise exception 'deletion job is not active' using errcode = '23514';
  end if;
  if deletion.subject_tombstone_hmac is null then
    if deletion.profile_id is null then
      raise exception 'deletion tombstone identity is unavailable' using errcode = '23514';
    end if;
    update public.account_deletion_requests set
      subject_tombstone_hmac = private.lifecycle_hmac(
        'account_deletion_tombstones',
        jsonb_build_object('profile_id', deletion.profile_id)
      )
    where id = deletion.id;
    select * into deletion from public.account_deletion_requests where id = target_request;
  end if;
  if target_step = 'storage_live' and deletion.storage_deleted_at is null then
    update public.account_deletion_requests set
      status = 'processing', phase = 'database_live', storage_deleted_at = target_occurred_at,
      next_retry_at = null, last_error_code = null
    where id = target_request;
  elsif target_step = 'database_live'
    and deletion.storage_deleted_at is not null and deletion.database_deleted_at is null then
    update public.account_deletion_requests set
      status = 'processing', phase = 'auth_identity', database_deleted_at = target_occurred_at,
      next_retry_at = null, last_error_code = null
    where id = target_request;
  elsif target_step = 'auth_identity'
    and deletion.database_deleted_at is not null and deletion.auth_deleted_at is null then
    update public.account_deletion_requests set
      status = 'processing', phase = 'backup_vendor_tombstone', auth_deleted_at = target_occurred_at,
      next_retry_at = null, last_error_code = null
    where id = target_request;
  elsif target_step = 'backup_vendor_tombstone'
    and deletion.auth_deleted_at is not null and deletion.backup_vendor_tombstone_recorded_at is null then
    update public.account_deletion_requests set
      status = 'completed', backup_vendor_tombstone_recorded_at = target_occurred_at,
      completed_at = target_occurred_at, next_retry_at = null, last_error_code = null
    where id = target_request;
    select * into deletion from public.account_deletion_requests where id = target_request;
    insert into public.account_deletion_tombstones (
      request_id, subject_tombstone_hmac, storage_deleted_at, database_deleted_at,
      auth_deleted_at, backup_vendor_tombstone_recorded_at, purge_after
    ) values (
      deletion.id, deletion.subject_tombstone_hmac, deletion.storage_deleted_at,
      deletion.database_deleted_at, deletion.auth_deleted_at,
      deletion.backup_vendor_tombstone_recorded_at, deletion.backup_vendor_tombstone_due_at
    );
  else
    raise exception 'deletion step is out of order' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.record_account_deletion_failure(
  target_request uuid,
  target_error_code text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempts integer;
begin
  if target_error_code not in (
    'storage_delete_failed', 'database_delete_failed', 'auth_delete_failed',
    'vendor_tombstone_failed', 'retry_exhausted'
  ) then
    raise exception 'invalid deletion failure code' using errcode = '22023';
  end if;
  update public.account_deletion_requests set
    status = case when retry_count >= 19 then 'failed' else 'retrying' end,
    retry_count = retry_count + 1,
    next_retry_at = case
      when retry_count >= 19 then null
      else now() + make_interval(secs => least(3600, (power(2, retry_count) * 60)::integer))
    end,
    last_error_code = case when retry_count >= 19 then 'retry_exhausted' else target_error_code end,
    alert_state = case when retry_count >= 4 then 'escalated' when retry_count >= 2 then 'warning' else alert_state end
  where id = target_request and status not in ('completed', 'cancelled', 'failed')
  returning retry_count into attempts;
  if attempts is null then
    raise exception 'deletion job is not retryable' using errcode = '23514';
  end if;
  if attempts >= 20 then
    insert into public.deletion_job_alerts (request_id, alert_code, severity)
    values (target_request, 'retry_exhausted', 'critical')
    on conflict (request_id, alert_code) do nothing;
  end if;
end;
$$;

create or replace function private.scan_deletion_job_alerts(target_now timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer;
begin
  insert into public.deletion_job_alerts (request_id, alert_code, severity, opened_at)
  select id, alert_code, severity, target_now
  from (
    select id, 'storage_sla_missed'::text alert_code, 'critical'::text severity
    from public.account_deletion_requests
    where status in ('requested', 'processing', 'retrying')
      and storage_deleted_at is null and requested_at + interval '24 hours' < target_now
    union all
    select id, 'database_sla_missed', 'critical'
    from public.account_deletion_requests
    where status in ('processing', 'retrying')
      and database_deleted_at is null and requested_at + interval '7 days' < target_now
    union all
    select id, 'auth_immediacy_missed', 'critical'
    from public.account_deletion_requests
    where status in ('processing', 'retrying')
      and database_deleted_at is not null and auth_deleted_at is null
      and database_deleted_at + interval '15 minutes' < target_now
    union all
    select id, 'vendor_tombstone_due', 'warning'
    from public.account_deletion_requests
    where status in ('processing', 'retrying')
      and auth_deleted_at is not null and backup_vendor_tombstone_recorded_at is null
      and backup_vendor_tombstone_due_at < target_now
  ) alerts
  on conflict (request_id, alert_code) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function private.reject_legacy_data_upload_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'raw upload persistence is disabled' using errcode = '42501';
end;
$$;

create trigger data_uploads_reject_new_raw
before insert on public.data_uploads
for each row execute function private.reject_legacy_data_upload_insert();

create or replace function private.reject_legacy_storage_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'legacy screenshot and health-import Storage writes are disabled' using errcode = '42501';
end;
$$;

drop policy if exists screenshots_owner_insert on storage.objects;
drop policy if exists health_imports_owner_insert on storage.objects;
create trigger storage_objects_reject_legacy_raw
before insert or update of bucket_id, name on storage.objects
for each row when (new.bucket_id in ('screenshots', 'health-imports'))
execute function private.reject_legacy_storage_write();

drop policy if exists uploads_owner_only on public.data_uploads;
create policy uploads_owner_select_legacy on public.data_uploads for select to authenticated
using (owner_profile_id = (select auth.uid()));
create policy uploads_owner_delete_legacy on public.data_uploads for delete to authenticated
using (owner_profile_id = (select auth.uid()));
revoke insert, update on public.data_uploads from authenticated;

alter table public.ai_control_attestations enable row level security;
alter table public.accepted_structured_imports enable row level security;
alter table public.screenshot_draft_jobs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_digest_queue enable row level security;
alter table public.retention_rules enable row level security;
alter table public.aggregate_retention_deadlines enable row level security;
alter table public.account_deletion_tombstones enable row level security;
alter table public.deletion_job_alerts enable row level security;

create policy accepted_structured_imports_select_scoped
on public.accepted_structured_imports for select to authenticated using (
  participant_profile_id = (select auth.uid())
  or private.is_active_named_coach(
    program_id, participant_profile_id, (select auth.uid())
  )
);
create policy screenshot_draft_jobs_select_scoped
on public.screenshot_draft_jobs for select to authenticated using (
  participant_profile_id = (select auth.uid())
  or private.has_program_role(program_id, array['coach', 'admin'])
);
create policy notification_preferences_owner
on public.notification_preferences for all to authenticated
using (participant_profile_id = (select auth.uid()))
with check (participant_profile_id = (select auth.uid()));
create policy notification_digest_queue_select_owner
on public.notification_digest_queue for select to authenticated
using (recipient_profile_id = (select auth.uid()));
create policy retention_rules_read
on public.retention_rules for select to authenticated using (true);

revoke all on public.ai_control_attestations, public.accepted_structured_imports,
  public.screenshot_draft_jobs, public.notification_preferences,
  public.notification_digest_queue, public.retention_rules,
  public.aggregate_retention_deadlines,
  public.account_deletion_tombstones, public.deletion_job_alerts
from public, anon, authenticated;
revoke all on private.import_parser_registry from public, anon, authenticated;
grant select on public.accepted_structured_imports, public.screenshot_draft_jobs,
  public.notification_digest_queue, public.retention_rules to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
revoke insert, update on public.account_deletion_requests from authenticated;
revoke update on public.notification_records from authenticated;
grant update (read_at) on public.notification_records to authenticated;

revoke all on function private.set_lifecycle_hmac_key(text, text) from public, anon, authenticated;
revoke all on function private.lifecycle_hmac(text, jsonb) from public, anon, authenticated;
revoke all on function private.program_identified_retention_deadline(date) from public, anon, authenticated;
revoke all on function private.aggregate_retention_deadline(timestamptz) from public, anon, authenticated;
revoke all on function private.register_ai_control_attestation(uuid, text, text, text[], text[], text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.assert_active_consent(uuid, uuid, uuid, text, timestamptz, text, text, text[]) from public, anon, authenticated;
revoke all on function private.assert_ai_control(uuid, uuid, uuid, uuid, text, text[], timestamptz) from public, anon, authenticated;
revoke all on function private.accept_structured_import(uuid, uuid, uuid, text, timestamptz, text, text, text[], jsonb, uuid, text) from public, anon, authenticated;
revoke all on function private.create_screenshot_draft_job(uuid, uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function private.finish_screenshot_draft_job(uuid, text, text) from public, anon, authenticated;
revoke all on function private.enqueue_notification_event(uuid, uuid, text, text, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function private.enforce_notification_push_opt_in() from public, anon, authenticated;
revoke all on function private.enforce_program_retention_deadline() from public, anon, authenticated;
revoke all on function private.sync_aggregate_retention_deadline() from public, anon, authenticated;
revoke all on function private.enforce_audit_retention_deadline() from public, anon, authenticated;
revoke all on function private.advance_account_deletion(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function private.record_account_deletion_failure(uuid, text) from public, anon, authenticated;
revoke all on function private.scan_deletion_job_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion(uuid) from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;
grant execute on function private.set_lifecycle_hmac_key(text, text) to service_role;
grant execute on function private.register_ai_control_attestation(uuid, text, text, text[], text[], text, timestamptz, timestamptz) to service_role;
grant execute on function private.accept_structured_import(uuid, uuid, uuid, text, timestamptz, text, text, text[], jsonb, uuid, text) to service_role;
grant execute on function private.create_screenshot_draft_job(uuid, uuid, uuid, uuid, text, text, integer) to service_role;
grant execute on function private.finish_screenshot_draft_job(uuid, text, text) to service_role;
grant execute on function private.enqueue_notification_event(uuid, uuid, text, text, text, uuid, text, timestamptz) to service_role;
grant execute on function private.advance_account_deletion(uuid, text, timestamptz) to service_role;
grant execute on function private.record_account_deletion_failure(uuid, text) to service_role;
grant execute on function private.scan_deletion_job_alerts(timestamptz) to service_role;

comment on table public.ai_control_attestations is
  'Server-verified OpenAI organization/project/endpoint control evidence; application request flags are not control evidence.';
comment on column public.ai_control_attestations.store_false_required is
  'A necessary request setting under the approved control, never proof that ZDR is active.';
comment on table public.accepted_structured_imports is
  'Accepted structured measurements and reviewed provenance only; browser-local files and fingerprints are never stored.';
comment on table private.import_parser_registry is
  'Server-owned allowlist that binds each accepted format to an auditable parser name and version.';
comment on table public.screenshot_draft_jobs is
  'Metadata-only job ledger for image bytes processed in memory; no object path, upload identifier, or image bytes exist here.';
comment on table public.notification_records is
  'One generic logical event counted before delivery fanout; exact allowlisted copy prevents health data in push and in-app records.';
comment on table public.notification_digest_queue is
  'Content-free overflow metadata for logical events beyond the participant-local daily cap.';
comment on table public.retention_rules is
  'Maximum lifecycle windows consumed by the Todo 16 scheduled purge worker.';
comment on column public.programs.identified_data_delete_after is
  'Program-wide identified-data deadline fixed at administrative end plus 30 days.';
comment on table public.aggregate_retention_deadlines is
  'Aggregate snapshot deadlines fixed at generated time plus 12 calendar months.';
comment on table public.audit_events is
  'Content-free security metadata retained for at most 180 days.';
comment on table public.account_deletion_tombstones is
  'Pseudonymous completion proof for ordered live Storage, database, Auth, and vendor cleanup.';
