create table private.activity_insight_acceptance_requests (
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null
    references public.profiles(id) on delete cascade,
  idempotency_key text not null check (
    idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  ),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  accepted_structured_import_id uuid
    references public.accepted_structured_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (program_id, participant_profile_id, idempotency_key)
);

create or replace function public.accept_activity_import_and_rebuild(
  target_rebuild jsonb,
  target_import jsonb,
  target_consent uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_program uuid;
  request_participant uuid;
  request_week_start date;
  request_idempotency_key text;
  import_observed_at timestamptz;
  import_quality_flags text[];
  canonical_quality_flags text[];
  requested_source_ids uuid[];
  rebuild_source_ids uuid[];
  accepted_import_id uuid;
  request_fingerprint text;
  existing_request private.activity_insight_acceptance_requests;
  rebuild_response jsonb;
begin
  if target_consent is null
    or jsonb_typeof(target_rebuild) <> 'object'
    or not target_rebuild ?& array[
      'programId', 'participantId', 'acceptedImportIds',
      'weekStart', 'idempotencyKey'
    ]
    or target_rebuild - array[
      'programId', 'participantId', 'acceptedImportIds',
      'weekStart', 'idempotencyKey'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(target_rebuild -> 'acceptedImportIds') <> 'array'
    or jsonb_typeof(target_import) <> 'object'
    or not target_import ?& array[
      'programId', 'participantId', 'format', 'observedAt',
      'sourceFamily', 'timezone', 'qualityFlags', 'metrics'
    ]
    or target_import - array[
      'programId', 'participantId', 'format', 'observedAt',
      'sourceFamily', 'sourceModel', 'timezone', 'qualityFlags', 'metrics'
    ]::text[] <> '{}'::jsonb
    or jsonb_typeof(target_import -> 'qualityFlags') <> 'array'
    or jsonb_typeof(target_import -> 'metrics') <> 'object' then
    raise exception 'invalid activity insight acceptance payload'
      using errcode = '22023';
  end if;

  request_program := (target_rebuild ->> 'programId')::uuid;
  request_participant := (target_rebuild ->> 'participantId')::uuid;
  request_week_start := (target_rebuild ->> 'weekStart')::date;
  request_idempotency_key := target_rebuild ->> 'idempotencyKey';
  import_observed_at := (target_import ->> 'observedAt')::timestamptz;

  select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
  into requested_source_ids
  from jsonb_array_elements_text(
    target_rebuild -> 'acceptedImportIds'
  ) with ordinality as source(value, ordinality);

  select coalesce(array_agg(value order by ordinality), '{}'::text[])
  into import_quality_flags
  from jsonb_array_elements_text(
    target_import -> 'qualityFlags'
  ) with ordinality as flag(value, ordinality);

  if request_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or extract(isodow from request_week_start) <> 1
    or target_import ->> 'programId' <> request_program::text
    or target_import ->> 'participantId' <> request_participant::text
    or target_import ->> 'format' = 'fit'
    or import_observed_at < (
      request_week_start::timestamp at time zone 'Asia/Seoul'
    )
    or import_observed_at >= (
      (request_week_start + 7)::timestamp at time zone 'Asia/Seoul'
    ) then
    raise exception 'activity insight acceptance identity is invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.consent_grants consent
  where consent.id = target_consent
  for share;
  if not found then
    raise exception 'activity insight acceptance consent is missing'
      using errcode = '23514';
  end if;

  request_fingerprint := private.lifecycle_hmac(
    'structured_import_duplicates',
    jsonb_build_object(
      'consentGrantId', target_consent,
      'import', target_import,
      'rebuild', target_rebuild
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    request_program::text || ':' || request_participant::text
      || ':' || request_idempotency_key,
    0
  ));

  select * into existing_request
  from private.activity_insight_acceptance_requests request
  where request.program_id = request_program
    and request.participant_profile_id = request_participant
    and request.idempotency_key = request_idempotency_key
  for update;

  if existing_request.idempotency_key is not null then
    if existing_request.request_fingerprint <> request_fingerprint then
      raise exception 'activity insight idempotency key was reused'
        using errcode = '22023';
    end if;
    if existing_request.accepted_structured_import_id is null then
      return private.rebuild_activity_insight(
        request_program, request_participant, request_week_start, '{}'::uuid[]
      );
    end if;
    select array_agg(distinct source_id order by source_id)
    into rebuild_source_ids
    from unnest(
      requested_source_ids
        || existing_request.accepted_structured_import_id
    ) source_id;
    return private.rebuild_activity_insight(
      request_program, request_participant, request_week_start,
      rebuild_source_ids
    );
  end if;

  select coalesce(array_agg(allowed.flag order by allowed.ordinality), '{}'::text[])
  into canonical_quality_flags
  from unnest(array[
    'device_reported', 'estimated', 'corrected', 'partial',
    'timezone_inferred', 'duplicate_suspected'
  ]::text[]) with ordinality as allowed(flag, ordinality)
  where allowed.flag = any(import_quality_flags);

  begin
    accepted_import_id := private.accept_structured_import(
      request_program,
      request_participant,
      target_consent,
      target_import ->> 'format',
      import_observed_at,
      target_import ->> 'sourceFamily',
      target_import ->> 'timezone',
      import_quality_flags,
      target_import -> 'metrics',
      null,
      target_import ->> 'sourceModel'
    );
  exception when unique_violation then
    select imported.id into accepted_import_id
    from public.accepted_structured_imports imported
    join private.import_parser_registry parser
      on parser.format = imported.format
      and parser.parser_name = imported.parser_name
      and parser.parser_version = imported.parser_version
    where imported.program_id = request_program
      and imported.participant_profile_id = request_participant
      and imported.format = target_import ->> 'format'
      and imported.observed_at = import_observed_at
      and imported.source_family = target_import ->> 'sourceFamily'
      and imported.source_model is not distinct from target_import ->> 'sourceModel'
      and imported.timezone = target_import ->> 'timezone'
      and imported.quality_flags = canonical_quality_flags
      and imported.metrics = target_import -> 'metrics';
    if accepted_import_id is null then
      raise;
    end if;
  end;

  insert into private.activity_insight_acceptance_requests (
    program_id, participant_profile_id, idempotency_key,
    request_fingerprint, accepted_structured_import_id
  ) values (
    request_program, request_participant, request_idempotency_key,
    request_fingerprint, accepted_import_id
  );

  select array_agg(distinct source_id order by source_id)
  into rebuild_source_ids
  from unnest(requested_source_ids || accepted_import_id) source_id;
  rebuild_response := private.rebuild_activity_insight(
    request_program, request_participant, request_week_start,
    rebuild_source_ids
  );
  if rebuild_response ->> 'status' <> 'rebuilt' then
    raise exception 'accepted import is not eligible for an activity insight'
      using errcode = '23514';
  end if;
  return rebuild_response;
end;
$$;

revoke all on private.activity_insight_acceptance_requests
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
revoke all on function public.accept_activity_import_and_rebuild(jsonb, jsonb, uuid)
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
grant execute on function public.accept_activity_import_and_rebuild(jsonb, jsonb, uuid)
to plus_service_worker;

comment on table private.activity_insight_acceptance_requests is
  'Content-free service idempotency metadata; deleted accepted sources cannot be resurrected by stale replay.';
comment on function public.accept_activity_import_and_rebuild(jsonb, jsonb, uuid) is
  'Service-only atomic boundary: accept reviewed structured fields, then rebuild one participant weekly insight.';
