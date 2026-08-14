create table public.activity_insights (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  template_version text not null check (template_version = 'activity-insight-v1'),
  content_category text not null check (content_category = 'activity_summary'),
  content_variant text not null check (content_variant in ('one_day', 'multiple_days')),
  distance_m numeric not null check (distance_m >= 0),
  duration_s numeric not null check (duration_s >= 0),
  steps numeric not null check (steps >= 0 and steps = trunc(steps)),
  pace_seconds_per_km numeric check (pace_seconds_per_km is null or pace_seconds_per_km > 0),
  activity_days smallint not null check (activity_days between 1 and 7),
  average_heart_rate_bpm numeric check (
    average_heart_rate_bpm is null or average_heart_rate_bpm between 20 and 250
  ),
  is_partial_week boolean not null,
  delete_after timestamptz not null,
  unique (program_id, participant_profile_id, week_start),
  check (extract(isodow from week_start) = 1),
  check (week_end = week_start + 7)
);

create table public.activity_insight_sources (
  activity_insight_id uuid not null
    references public.activity_insights(id) on delete cascade,
  accepted_structured_import_id uuid not null
    references public.accepted_structured_imports(id) on delete cascade,
  primary key (activity_insight_id, accepted_structured_import_id)
);

create index activity_insight_sources_import_idx
  on public.activity_insight_sources (accepted_structured_import_id);

create or replace function private.invalidate_activity_insights_for_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;

  delete from public.activity_insights insight
  using public.activity_insight_sources source
  where source.activity_insight_id = insight.id
    and source.accepted_structured_import_id = old.id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger activity_insights_invalidate_source
before update or delete on public.accepted_structured_imports
for each row execute function private.invalidate_activity_insights_for_source();

create or replace function private.rebuild_activity_insight(
  target_program uuid,
  target_participant uuid,
  target_week_start date,
  target_accepted_import_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_at timestamptz := statement_timestamp();
  target_week_end date;
  target_delete_after timestamptz;
  valid_source_ids uuid[] := '{}'::uuid[];
  insight_id uuid;
  aggregate_distance_m numeric;
  aggregate_duration_s numeric;
  aggregate_steps numeric;
  aggregate_activity_days smallint;
  weighted_heart_rate numeric;
  weighted_duration_s numeric;
  aggregate_pace numeric;
  aggregate_heart_rate numeric;
begin
  if target_program is null
    or target_participant is null
    or target_week_start is null
    or target_accepted_import_ids is null
    or array_position(target_accepted_import_ids, null) is not null
    or coalesce(array_ndims(target_accepted_import_ids), 1) <> 1
    or cardinality(target_accepted_import_ids) > 500 then
    raise exception 'invalid activity insight rebuild identity' using errcode = '22023';
  end if;

  if extract(isodow from target_week_start) <> 1 then
    raise exception 'activity insight week must start on Monday' using errcode = '22023';
  end if;
  target_week_end := target_week_start + 7;

  if cardinality(target_accepted_import_ids) <> (
    select count(distinct requested.id)
    from unnest(target_accepted_import_ids) requested(id)
  ) then
    raise exception 'activity insight source IDs must be unique' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(target_accepted_import_ids) requested(id)
    join public.accepted_structured_imports imported on imported.id = requested.id
    where imported.program_id <> target_program
      or imported.participant_profile_id <> target_participant
  ) then
    raise exception 'activity insight source ownership mismatch' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(target_accepted_import_ids) requested(id)
    join public.accepted_structured_imports imported on imported.id = requested.id
    where imported.program_id = target_program
      and imported.participant_profile_id = target_participant
      and 'duplicate_suspected' = any(imported.quality_flags)
  ) then
    raise exception 'duplicate-suspected activity source is not eligible' using errcode = '22023';
  end if;

  select program.identified_data_delete_after
  into target_delete_after
  from public.programs program
  join public.program_enrollments enrollment
    on enrollment.program_id = program.id
   and enrollment.profile_id = target_participant
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
  where program.id = target_program
    and private.is_active_program_member(
      target_participant, target_program, 'participant'
    );

  if target_delete_after is not null then
    select coalesce(array_agg(imported.id order by imported.id), '{}'::uuid[])
    into valid_source_ids
    from unnest(target_accepted_import_ids) requested(id)
    join public.accepted_structured_imports imported on imported.id = requested.id
    join public.consent_grants consent on consent.id = imported.consent_grant_id
    where imported.program_id = target_program
      and imported.participant_profile_id = target_participant
      and imported.observed_at >= (
        target_week_start::timestamp at time zone 'Asia/Seoul'
      )
      and imported.observed_at < (
        target_week_end::timestamp at time zone 'Asia/Seoul'
      )
      and imported.accepted_at <= target_at
      and imported.delete_after > target_at
      and not ('duplicate_suspected' = any(imported.quality_flags))
      and consent.program_id = target_program
      and consent.participant_profile_id = target_participant
      and consent.purpose = 'program_data_processing'
      and consent.status = 'active'
      and consent.granted_at <= target_at
      and consent.expires_at > target_at
      and consent.withdrawn_at is null;
  end if;

  if cardinality(valid_source_ids) = 0 then
    delete from public.activity_insights
    where program_id = target_program
      and participant_profile_id = target_participant
      and week_start = target_week_start;

    return jsonb_build_object(
      'status', 'removed',
      'programId', target_program,
      'participantId', target_participant,
      'weekStart', target_week_start,
      'weekEnd', target_week_end,
      'sourceCount', 0,
      'templateVersion', 'activity-insight-v1'
    );
  end if;

  select
    coalesce(sum((imported.metrics ->> 'distanceM')::numeric), 0),
    coalesce(sum((imported.metrics ->> 'durationS')::numeric), 0),
    coalesce(sum((imported.metrics ->> 'steps')::numeric), 0),
    count(distinct (imported.observed_at at time zone 'Asia/Seoul')::date)::smallint,
    coalesce(sum(
      (imported.metrics ->> 'durationS')::numeric
      * (imported.metrics ->> 'averageHeartRateBpm')::numeric
    ) filter (
      where imported.metrics ? 'durationS'
        and imported.metrics ? 'averageHeartRateBpm'
    ), 0),
    coalesce(sum((imported.metrics ->> 'durationS')::numeric) filter (
      where imported.metrics ? 'durationS'
        and imported.metrics ? 'averageHeartRateBpm'
    ), 0)
  into aggregate_distance_m, aggregate_duration_s, aggregate_steps,
    aggregate_activity_days, weighted_heart_rate, weighted_duration_s
  from public.accepted_structured_imports imported
  where imported.id = any(valid_source_ids);

  aggregate_pace := case
    when aggregate_distance_m > 0 and aggregate_duration_s > 0
      then aggregate_duration_s / (aggregate_distance_m / 1000)
    else null
  end;
  aggregate_heart_rate := case
    when weighted_duration_s > 0 then weighted_heart_rate / weighted_duration_s
    else null
  end;

  insert into public.activity_insights (
    program_id, participant_profile_id, week_start, week_end,
    template_version, content_category, content_variant,
    distance_m, duration_s, steps, pace_seconds_per_km, activity_days,
    average_heart_rate_bpm, is_partial_week, delete_after
  ) values (
    target_program, target_participant, target_week_start, target_week_end,
    'activity-insight-v1', 'activity_summary',
    case when aggregate_activity_days = 1 then 'one_day' else 'multiple_days' end,
    aggregate_distance_m, aggregate_duration_s, aggregate_steps,
    aggregate_pace, aggregate_activity_days, aggregate_heart_rate,
    target_at >= (target_week_start::timestamp at time zone 'Asia/Seoul')
      and target_at < (target_week_end::timestamp at time zone 'Asia/Seoul'),
    target_delete_after
  )
  on conflict (program_id, participant_profile_id, week_start) do update set
    week_end = excluded.week_end,
    template_version = excluded.template_version,
    content_category = excluded.content_category,
    content_variant = excluded.content_variant,
    distance_m = excluded.distance_m,
    duration_s = excluded.duration_s,
    steps = excluded.steps,
    pace_seconds_per_km = excluded.pace_seconds_per_km,
    activity_days = excluded.activity_days,
    average_heart_rate_bpm = excluded.average_heart_rate_bpm,
    is_partial_week = excluded.is_partial_week,
    delete_after = excluded.delete_after
  returning id into insight_id;

  insert into public.activity_insight_sources (
    activity_insight_id, accepted_structured_import_id
  )
  select insight_id, source_id
  from unnest(valid_source_ids) source_id
  on conflict do nothing;

  delete from public.activity_insight_sources source
  where source.activity_insight_id = insight_id
    and not (source.accepted_structured_import_id = any(valid_source_ids));

  return jsonb_build_object(
    'status', 'rebuilt',
    'insightId', insight_id,
    'programId', target_program,
    'participantId', target_participant,
    'weekStart', target_week_start,
    'weekEnd', target_week_end,
    'sourceCount', cardinality(valid_source_ids),
    'templateVersion', 'activity-insight-v1'
  );
end;
$$;

alter table public.activity_insights enable row level security;
alter table public.activity_insight_sources enable row level security;

create policy activity_insights_participant_select
on public.activity_insights for select to authenticated using (
  participant_profile_id = (select auth.uid())
  and private.is_active_program_member(
    (select auth.uid()), program_id, 'participant'
  )
);

create policy activity_insight_sources_participant_select
on public.activity_insight_sources for select to authenticated using (
  exists (
    select 1
    from public.activity_insights insight
    where insight.id = activity_insight_sources.activity_insight_id
      and insight.participant_profile_id = (select auth.uid())
      and private.is_active_program_member(
        (select auth.uid()), insight.program_id, 'participant'
      )
  )
);

create policy active_authenticated_only
on public.activity_insights as restrictive for all to authenticated
using ((select private.current_actor_is_active()))
with check ((select private.current_actor_is_active()));

create policy active_authenticated_only
on public.activity_insight_sources as restrictive for all to authenticated
using ((select private.current_actor_is_active()))
with check ((select private.current_actor_is_active()));

revoke all on public.activity_insights, public.activity_insight_sources
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
grant select on public.activity_insights, public.activity_insight_sources
to authenticated;

revoke all on function private.invalidate_activity_insights_for_source()
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
revoke all on function private.rebuild_activity_insight(uuid, uuid, date, uuid[])
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
grant execute on function private.rebuild_activity_insight(uuid, uuid, date, uuid[])
to plus_service_worker;

comment on table public.activity_insights is
  'Participant-only deterministic weekly display aggregates; raw imports, provider payloads, filenames, routes, and secrets are never stored.';
comment on table public.activity_insight_sources is
  'Provenance-only join from an activity insight header to accepted structured import UUIDs.';
comment on function private.rebuild_activity_insight(uuid, uuid, date, uuid[]) is
  'Service-worker rebuild boundary. UUID syntax is parsed by the Task 4 contract; this function independently enforces database ownership, consent, lifecycle, Seoul-week, and accepted-source state.';
