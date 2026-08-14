\set ON_ERROR_STOP on

do $$
declare
  function_signature text := 'private.rebuild_activity_insight(uuid,uuid,date,uuid[])';
begin
  if has_function_privilege('anon', function_signature, 'EXECUTE')
    or has_function_privilege('authenticated', function_signature, 'EXECUTE')
    or not has_function_privilege('service_role', function_signature, 'EXECUTE') then
    raise exception 'activity insight rebuild execute boundary is not service-only';
  end if;
end;
$$;

set role service_role;
do $$
begin
  begin
    perform private.rebuild_activity_insight(
      '70000000-0000-4000-8000-000000000010',
      '70000000-0000-4000-8000-000000000103',
      date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
      array['70000000-0000-4000-8000-000000000305'::uuid]
    );
    raise exception 'expected cross-participant accepted import rejection';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform private.rebuild_activity_insight(
      '70000000-0000-4000-8000-000000000010',
      '70000000-0000-4000-8000-000000000103',
      date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
      array[
        '70000000-0000-4000-8000-000000000303'::uuid,
        '70000000-0000-4000-8000-000000000303'::uuid
      ]
    );
    raise exception 'expected duplicate accepted import UUID rejection';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103') <> 1 then
    raise exception 'cross-participant rejection changed the existing insight';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000103', false);
do $$
begin
  if (select count(*) from public.activity_insights) <> 1
    or (select count(*) from public.activity_insight_sources) <> 3 then
    raise exception 'participant cannot read their own activity insight provenance';
  end if;
  begin
    insert into public.activity_insights (program_id)
    values ('70000000-0000-4000-8000-000000000010');
    raise exception 'expected authenticated activity insight insert rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.activity_insights set distance_m = 1;
    raise exception 'expected authenticated activity insight update rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.activity_insights;
    raise exception 'expected authenticated activity insight delete rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.rebuild_activity_insight(
      '70000000-0000-4000-8000-000000000010',
      '70000000-0000-4000-8000-000000000103',
      date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
      array[]::uuid[]
    );
    raise exception 'expected authenticated activity insight rebuild rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000102', false);
do $$
begin
  if exists (select 1 from public.activity_insights)
    or exists (select 1 from public.activity_insight_sources) then
    raise exception 'coach read participant-only activity insight rows';
  end if;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000104', false);
do $$
begin
  if exists (select 1 from public.activity_insights)
    or exists (select 1 from public.activity_insight_sources) then
    raise exception 'another participant read activity insight rows';
  end if;
end;
$$;
reset role;

set role anon;
do $$
begin
  begin
    perform 1 from public.activity_insights;
    raise exception 'expected anonymous activity insight read rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.activity_insights (program_id)
    values ('70000000-0000-4000-8000-000000000010');
    raise exception 'expected anonymous activity insight write rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
declare
  header_columns text[];
  source_columns text[];
begin
  select array_agg(column_name order by ordinal_position)
  into header_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'activity_insights';

  select array_agg(column_name order by ordinal_position)
  into source_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'activity_insight_sources';

  if header_columns <> array[
      'id', 'program_id', 'participant_profile_id', 'week_start', 'week_end',
      'template_version', 'content_category', 'content_variant', 'distance_m',
      'duration_s', 'steps', 'pace_seconds_per_km', 'activity_days',
      'average_heart_rate_bpm', 'is_partial_week', 'delete_after'
    ]::text[]
    or source_columns <> array[
      'activity_insight_id', 'accepted_structured_import_id'
    ]::text[] then
    raise exception 'activity insight tables contain data beyond the safe header and source UUID contract';
  end if;

  begin
    execute 'insert into public.activity_insights (raw_bytes) values (decode(''00'', ''hex''))';
    raise exception 'expected raw activity insight column rejection';
  exception when undefined_column then null;
  end;
  begin
    execute 'insert into public.activity_insight_sources (activity_insight_id, accepted_structured_import_id, filename) values (gen_random_uuid(), gen_random_uuid(), ''run.fit'')';
    raise exception 'expected filename provenance column rejection';
  exception when undefined_column then null;
  end;
end;
$$;

delete from public.accepted_structured_imports
where id = '70000000-0000-4000-8000-000000000301';

do $$
begin
  if exists (
    select 1 from public.activity_insights
    where participant_profile_id = '70000000-0000-4000-8000-000000000103'
  ) or exists (
    select 1
    from public.activity_insight_sources source
    left join public.activity_insights insight on insight.id = source.activity_insight_id
    where insight.id is null
  ) then
    raise exception 'source deletion left activity insight content or orphan provenance';
  end if;
end;
$$;

set role service_role;
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000103',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array[
    '70000000-0000-4000-8000-000000000302'::uuid,
    '70000000-0000-4000-8000-000000000303'::uuid
  ]
);
reset role;

update public.accepted_structured_imports
set quality_flags = array['device_reported', 'duplicate_suspected']
where id = '70000000-0000-4000-8000-000000000302';

do $$
begin
  if exists (
    select 1 from public.activity_insights
    where participant_profile_id = '70000000-0000-4000-8000-000000000103'
  ) or exists (
    select 1
    from public.activity_insight_sources source
    left join public.activity_insights insight on insight.id = source.activity_insight_id
    where insight.id is null
  ) then
    raise exception 'source invalidation left activity insight content or orphan provenance';
  end if;
end;
$$;

set role service_role;
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000103',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array['70000000-0000-4000-8000-000000000303'::uuid]
);
reset role;

update public.consent_grants
set status = 'withdrawn', withdrawn_at = now(),
  withdrawn_by_profile_id = '70000000-0000-4000-8000-000000000103',
  withdrawal_reason_code = 'participant_request'
where id = '70000000-0000-4000-8000-000000000201';

create temporary table activity_insight_removed_response (payload jsonb not null);
grant insert, select on activity_insight_removed_response to service_role;
set role service_role;
insert into activity_insight_removed_response (payload)
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000103',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array['70000000-0000-4000-8000-000000000303'::uuid]
);
reset role;

do $$
begin
  if (select payload ->> 'status' from activity_insight_removed_response) <> 'removed'
    or exists (
      select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103'
    ) then
    raise exception 'inactive program-data-processing consent retained an activity insight';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accepted_structured_imports'
      and column_name = 'consent_grant_id'
      and is_nullable <> 'NO'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.accepted_structured_imports'::regclass
      and confrelid = 'public.consent_grants'::regclass
      and confdeltype = 'r'
  ) then
    raise exception 'accepted imports can outlive or omit their consent grant';
  end if;

  begin
    update public.accepted_structured_imports
    set consent_grant_id = null
    where id = '70000000-0000-4000-8000-000000000305';
    raise exception 'expected missing consent rejection';
  exception when check_violation or not_null_violation then null;
  end;
end;
$$;

set role service_role;
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000104',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array['70000000-0000-4000-8000-000000000305'::uuid]
);
reset role;

update public.program_enrollments
set lifecycle_status = 'paused'
where id = '70000000-0000-4000-8000-000000000142';

create temporary table activity_insight_lifecycle_response (payload jsonb not null);
grant insert, select on activity_insight_lifecycle_response to service_role;
set role service_role;
insert into activity_insight_lifecycle_response (payload)
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000104',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array['70000000-0000-4000-8000-000000000305'::uuid]
);
reset role;

do $$
begin
  if (select payload ->> 'status' from activity_insight_lifecycle_response) <> 'removed'
    or exists (
      select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000104'
    ) then
    raise exception 'inactive participant lifecycle retained an activity insight';
  end if;
end;
$$;

select 'ACTIVITY_INSIGHT_PAUSED_ENROLLMENT_PASS' as result;

delete from public.program_enrollments
where id = '70000000-0000-4000-8000-000000000142';

delete from public.program_invitations
where id = '70000000-0000-4000-8000-000000000132';

do $$
begin
  if not private.is_active_program_member(
    '70000000-0000-4000-8000-000000000104',
    '70000000-0000-4000-8000-000000000010',
    'participant'
  ) then
    raise exception 'missing-enrollment fixture did not reach the legacy membership path';
  end if;
end;
$$;

create temporary table activity_insight_missing_enrollment_response (payload jsonb not null);
grant insert, select on activity_insight_missing_enrollment_response to service_role;
set role service_role;
insert into activity_insight_missing_enrollment_response (payload)
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000104',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
  array['70000000-0000-4000-8000-000000000305'::uuid]
);
reset role;

do $$
begin
  if (select payload ->> 'status' from activity_insight_missing_enrollment_response) <> 'removed'
    or exists (
      select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000104'
    ) or exists (
      select 1
      from public.activity_insight_sources source
      join public.activity_insights insight on insight.id = source.activity_insight_id
      where insight.participant_profile_id = '70000000-0000-4000-8000-000000000104'
    ) then
    raise exception 'participant without a current enrollment retained an activity insight';
  end if;
end;
$$;

select 'ACTIVITY_INSIGHT_MISSING_ENROLLMENT_PASS' as result;

select 'ACTIVITY_INSIGHT_RLS_PASS' as result;
select 'ACTIVITY_INSIGHT_HOSTILE_PASS' as result;
