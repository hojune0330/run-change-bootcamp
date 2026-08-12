\set ON_ERROR_STOP on

select private.set_lifecycle_hmac_key(
  'structured_import_duplicates',
  repeat('task6-isolated-test-key-', 2)
);

create temporary table activity_insight_acceptance_payload (
  rebuild jsonb not null,
  accepted_import jsonb not null,
  consent_grant_id uuid not null
);

insert into activity_insight_acceptance_payload
select
  jsonb_build_object(
    'programId', '70000000-0000-4000-8000-000000000010',
    'participantId', '70000000-0000-4000-8000-000000000103',
    'acceptedImportIds', jsonb_build_array(),
    'weekStart', date_trunc('week', now() at time zone 'Asia/Seoul')::date,
    'idempotencyKey', 'task6-acceptance-2026-08-12'
  ),
  jsonb_build_object(
    'programId', '70000000-0000-4000-8000-000000000010',
    'participantId', '70000000-0000-4000-8000-000000000103',
    'format', 'csv',
    'observedAt', (
      date_trunc('week', now() at time zone 'Asia/Seoul')::date
        + interval '1 day 06:30'
    ) at time zone 'Asia/Seoul',
    'sourceFamily', 'reviewed_csv',
    'timezone', 'Asia/Seoul',
    'qualityFlags', jsonb_build_array('device_reported'),
    'metrics', jsonb_build_object(
      'distanceM', 5000, 'durationS', 1800, 'steps', 6200
    )
  ),
  '70000000-0000-4000-8000-000000000201';

grant select on activity_insight_acceptance_payload
to anon, authenticated, service_role;

create temporary table activity_insight_acceptance_responses (
  attempt text primary key,
  payload jsonb not null
);
grant insert, select on activity_insight_acceptance_responses to service_role;

create function pg_temp.activity_insight_orphan_count()
returns bigint language sql stable set search_path = '' as $$
  select count(*)
  from public.activity_insight_sources source
  left join public.activity_insights insight
    on insight.id = source.activity_insight_id
  left join public.accepted_structured_imports imported
    on imported.id = source.accepted_structured_import_id
  where insight.id is null or imported.id is null;
$$;

\ir activity_insight_acceptance_role_test.sql

begin;
set role service_role;
insert into activity_insight_acceptance_responses (attempt, payload)
select 'first', public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
insert into activity_insight_acceptance_responses (attempt, payload)
select 'replay', public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '70000000-0000-4000-8000-000000000103', false
);
do $$
begin
  if (select count(*) from public.activity_insights) <> 1
    or (select count(*) from public.activity_insight_sources) <> 1 then
    raise exception 'participant cannot read their accepted activity insight';
  end if;
end;
$$;
reset role;

select 'TASK6_PARTICIPANT_RLS_PASS' as result;

do $$
declare
  target_week date := date_trunc('week', now() at time zone 'Asia/Seoul')::date;
begin
  if (select payload ->> 'status' from activity_insight_acceptance_responses
      where attempt = 'first') <> 'rebuilt'
    or (select payload ->> 'insightId' from activity_insight_acceptance_responses
      where attempt = 'first') is distinct from (
        select payload ->> 'insightId' from activity_insight_acceptance_responses
        where attempt = 'replay'
      )
    or (select count(*) from public.accepted_structured_imports
      where source_family = 'reviewed_csv') <> 1
    or (select count(*) from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103'
        and week_start = target_week) <> 1
    or (select count(*) from public.activity_insight_sources source
      join public.activity_insights insight on insight.id = source.activity_insight_id
      where insight.participant_profile_id = '70000000-0000-4000-8000-000000000103'
        and insight.week_start = target_week) <> 1
    or (select count(*) from private.activity_insight_acceptance_requests) <> 1 then
    raise exception 'acceptance did not create exactly one idempotent weekly insight';
  end if;
end;
$$;

select
  (select payload ->> 'insightId' from activity_insight_acceptance_responses
    where attempt = 'first') as first_insight_id,
  (select payload ->> 'insightId' from activity_insight_acceptance_responses
    where attempt = 'replay') as replay_insight_id,
  (select count(*) from public.accepted_structured_imports
    where source_family = 'reviewed_csv') as accepted_source_count,
  (select count(*) from public.activity_insights
    where participant_profile_id = '70000000-0000-4000-8000-000000000103'
      and week_start = date_trunc('week', now() at time zone 'Asia/Seoul')::date
  ) as weekly_insight_count,
  (select count(*) from public.activity_insight_sources source
    join public.activity_insights insight on insight.id = source.activity_insight_id
    where insight.participant_profile_id = '70000000-0000-4000-8000-000000000103'
      and insight.week_start = date_trunc('week', now() at time zone 'Asia/Seoul')::date
  ) as insight_source_count;
rollback;

select 'TASK6_ACCEPT_REPLAY_PASS' as result;

begin;
set role service_role;
do $$
begin
  begin
    perform public.accept_activity_import_and_rebuild(
      payload.rebuild || '{"rawBytes":"AAE="}'::jsonb,
      payload.accepted_import,
      payload.consent_grant_id
    ) from activity_insight_acceptance_payload payload;
    raise exception 'expected malformed Task 4 payload rejection';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.accepted_structured_imports
      where source_family = 'reviewed_csv') then
    raise exception 'malformed Task 4 payload reached acceptance';
  end if;
end;
$$;
rollback;

select 'TASK6_MALFORMED_REJECTED' as result;

begin;
set role service_role;
do $$
begin
  begin
    perform public.accept_activity_import_and_rebuild(
      jsonb_set(
        payload.rebuild,
        '{acceptedImportIds}',
        '["70000000-0000-4000-8000-000000000305"]'::jsonb
      ),
      payload.accepted_import,
      payload.consent_grant_id
    ) from activity_insight_acceptance_payload payload;
    raise exception 'expected cross-participant source rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.accepted_structured_imports
      where source_family = 'reviewed_csv')
    or exists (select 1 from private.activity_insight_acceptance_requests) then
    raise exception 'failed rebuild did not roll back its accepted import';
  end if;
end;
$$;
rollback;

select 'TASK6_COMPENSATION_PASS' as result;

begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
do $$
begin
  begin
    perform public.accept_activity_import_and_rebuild(
      payload.rebuild,
      jsonb_set(payload.accepted_import, '{metrics,distanceM}', '6000'::jsonb),
      payload.consent_grant_id
    ) from activity_insight_acceptance_payload payload;
    raise exception 'expected changed idempotency replay rejection';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
rollback;

select 'TASK6_STALE_REPLAY_REJECTED' as result;

\ir activity_insight_acceptance_lifecycle_test.sql

select 'ACTIVITY_INSIGHT_ACCEPTANCE_PASS' as result;
