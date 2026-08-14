\set ON_ERROR_STOP on

create temporary table activity_insight_test_responses (
  attempt integer primary key,
  payload jsonb not null
);
grant insert, select on activity_insight_test_responses to service_role;

set role service_role;
insert into activity_insight_test_responses (attempt, payload) values
  (1, private.rebuild_activity_insight(
    '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103',
    date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
    array[
      '70000000-0000-4000-8000-000000000301'::uuid,
      '70000000-0000-4000-8000-000000000302'::uuid,
      '70000000-0000-4000-8000-000000000303'::uuid,
      '70000000-0000-4000-8000-000000000304'::uuid
    ]
  )),
  (2, private.rebuild_activity_insight(
    '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103',
    date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7,
    array[
      '70000000-0000-4000-8000-000000000301'::uuid,
      '70000000-0000-4000-8000-000000000302'::uuid,
      '70000000-0000-4000-8000-000000000303'::uuid,
      '70000000-0000-4000-8000-000000000304'::uuid
    ]
  ));
reset role;

do $$
declare
  first_response jsonb;
  replay_response jsonb;
  target_week date := date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7;
begin
  select payload into first_response from activity_insight_test_responses where attempt = 1;
  select payload into replay_response from activity_insight_test_responses where attempt = 2;

  if first_response ->> 'status' <> 'rebuilt'
    or first_response ->> 'templateVersion' <> 'activity-insight-v1'
    or (first_response ->> 'sourceCount')::integer <> 3
    or (first_response ->> 'weekStart')::date <> target_week
    or (first_response ->> 'weekEnd')::date <> target_week + 7
    or first_response ->> 'insightId' is null then
    raise exception 'activity insight rebuild response contract failed';
  end if;

  if replay_response ->> 'insightId' <> first_response ->> 'insightId'
    or (select count(*) from public.activity_insights
      where program_id = '70000000-0000-4000-8000-000000000010'
        and participant_profile_id = '70000000-0000-4000-8000-000000000103'
        and week_start = target_week) <> 1 then
    raise exception 'activity insight replay created a duplicate header';
  end if;

  if not exists (
    select 1
    from public.activity_insights insight
    join public.programs program on program.id = insight.program_id
    where insight.id = (first_response ->> 'insightId')::uuid
      and insight.week_start = target_week
      and insight.week_end = target_week + 7
      and insight.template_version = 'activity-insight-v1'
      and insight.content_category = 'activity_summary'
      and insight.content_variant = 'multiple_days'
      and insight.distance_m = 8000
      and insight.duration_s = 3000
      and insight.steps = 9200
      and insight.pace_seconds_per_km = 375
      and insight.activity_days = 3
      and insight.average_heart_rate_bpm = 138
      and not insight.is_partial_week
      and insight.delete_after = program.identified_data_delete_after
  ) then
    raise exception 'activity insight aggregate does not match deterministic Task 3 rules';
  end if;

  if (select count(*) from public.activity_insight_sources
      where activity_insight_id = (first_response ->> 'insightId')::uuid) <> 3
    or exists (
      select 1 from public.activity_insight_sources
      where activity_insight_id = (first_response ->> 'insightId')::uuid
        and accepted_structured_import_id = '70000000-0000-4000-8000-000000000304'
    ) then
    raise exception 'activity insight provenance did not keep exactly the in-week sources';
  end if;
end;
$$;

create temporary table activity_insight_partial_response (payload jsonb not null);
grant insert, select on activity_insight_partial_response to service_role;

set role service_role;
insert into activity_insight_partial_response (payload)
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000103',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date,
  array['70000000-0000-4000-8000-000000000304'::uuid]
);
reset role;

do $$
declare
  current_week date := date_trunc('week', now() at time zone 'Asia/Seoul')::date;
begin
  if (select payload ->> 'status' from activity_insight_partial_response) <> 'rebuilt'
    or (select (payload ->> 'sourceCount')::integer
      from activity_insight_partial_response) <> 1
    or not exists (
      select 1
      from public.activity_insights insight
      where insight.program_id = '70000000-0000-4000-8000-000000000010'
        and insight.participant_profile_id = '70000000-0000-4000-8000-000000000103'
        and insight.week_start = current_week
        and insight.content_variant = 'one_day'
        and insight.distance_m = 9000
        and insight.duration_s = 3600
        and insight.steps = 10000
        and insight.pace_seconds_per_km = 400
        and insight.activity_days = 1
        and insight.average_heart_rate_bpm is null
        and insight.is_partial_week
    ) then
    raise exception 'current-week activity insight is not a deterministic partial one-day summary';
  end if;
end;
$$;

set role service_role;
select private.rebuild_activity_insight(
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000103',
  date_trunc('week', now() at time zone 'Asia/Seoul')::date,
  array[]::uuid[]
);
reset role;

do $$
begin
  if exists (
    select 1
    from public.activity_insights
    where program_id = '70000000-0000-4000-8000-000000000010'
      and participant_profile_id = '70000000-0000-4000-8000-000000000103'
      and week_start = date_trunc('week', now() at time zone 'Asia/Seoul')::date
  ) then
    raise exception 'empty current-week rebuild did not remove its insight';
  end if;
end;
$$;

select 'ACTIVITY_INSIGHT_HAPPY_PASS' as result;
