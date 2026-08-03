create or replace function private.selected_assessment_attempts(target_protocol_version uuid)
returns table (
  enrollment_id uuid,
  purpose text,
  elapsed_seconds numeric,
  attempt_id uuid
)
language sql stable security definer set search_path = '' as $$
  select attempt.enrollment_id, session.purpose, attempt.elapsed_seconds, attempt.id
  from public.assessment_attempts attempt
  join public.assessment_sessions session on session.id = attempt.assessment_session_id
  where attempt.protocol_version_id = target_protocol_version
    and attempt.status = 'accepted'
    and (
      attempt.attempt_kind = 'original'
      or (
        attempt.attempt_kind = 'technical_reattempt'
        and exists (
          select 1 from public.assessment_attempts original
          where original.id = attempt.original_attempt_id
            and original.status = 'invalidated'
            and original.invalidation_reason_code = 'technical_interruption'
        )
      )
    );
$$;

create or replace function private.three_kilometer_pairs(target_protocol_version uuid)
returns table (
  enrollment_id uuid,
  baseline_seconds numeric,
  retest_seconds numeric,
  raw_change_pct numeric,
  improved boolean
)
language sql stable security definer set search_path = '' as $$
  with selected as (
    select * from private.selected_assessment_attempts(target_protocol_version)
  )
  select
    baseline.enrollment_id,
    baseline.elapsed_seconds,
    retest.elapsed_seconds,
    100 * (baseline.elapsed_seconds - retest.elapsed_seconds) / baseline.elapsed_seconds,
    retest.elapsed_seconds < baseline.elapsed_seconds
  from selected baseline
  join selected retest on retest.enrollment_id = baseline.enrollment_id
  where baseline.purpose = 'baseline' and retest.purpose = 'retest';
$$;

create or replace function private.adherence_results(target_protocol_version uuid)
returns table (
  enrollment_id uuid,
  assigned_while_active_count bigint,
  accepted_linked_session_count bigint,
  raw_adherence_pct numeric,
  per_protocol boolean
)
language sql stable security definer set search_path = '' as $$
  with protocol as (
    select program_id from public.assessment_protocol_versions where id = target_protocol_version
  ), counts as (
    select
      enrollment.id as enrollment_id,
      count(prescription.id) filter (
        where prescription.assigned_while_active and prescription.status = 'assigned'
      ) as assigned_count,
      count(prescription.id) filter (
        where prescription.assigned_while_active
          and prescription.status = 'assigned'
          and exists (
            select 1 from public.session_adherence_evidence evidence
            where evidence.prescription_id = prescription.id
              and evidence.status = 'accepted'
              and private.is_valid_adherence_source(
                evidence.evidence_kind,
                evidence.linked_record_id,
                evidence.program_id,
                evidence.enrollment_id
              )
          )
      ) as accepted_count
    from public.program_enrollments enrollment
    join protocol on protocol.program_id = enrollment.program_id
    left join public.training_prescriptions prescription on prescription.enrollment_id = enrollment.id
    group by enrollment.id
  )
  select
    counts.enrollment_id,
    counts.assigned_count,
    counts.accepted_count,
    case when counts.assigned_count = 0 then null
      else 100 * counts.accepted_count::numeric / counts.assigned_count::numeric end,
    counts.assigned_count > 0
      and 100 * counts.accepted_count::numeric / counts.assigned_count::numeric >= 80
  from counts;
$$;

create or replace function private.measurement_report(target_protocol_version uuid)
returns table (
  all_enrolled_count bigint,
  baseline_count bigint,
  retest_count bigint,
  valid_pair_count bigint,
  per_protocol_count bigint,
  withdrawn_count bigint,
  improved_count bigint,
  improved_pct_raw numeric,
  q1_change_pct_raw numeric,
  median_change_pct_raw numeric,
  q3_change_pct_raw numeric,
  q1_change_pct_display numeric,
  median_change_pct_display numeric,
  q3_change_pct_display numeric,
  product_positive boolean
)
language sql stable security definer set search_path = '' as $$
  with protocol as (
    select program_id from public.assessment_protocol_versions where id = target_protocol_version
  ), enrolled as (
    select enrollment.* from public.program_enrollments enrollment
    join protocol on protocol.program_id = enrollment.program_id
  ), selected as (
    select * from private.selected_assessment_attempts(target_protocol_version)
  ), pairs as (
    select * from private.three_kilometer_pairs(target_protocol_version)
  ), adherence as (
    select * from private.adherence_results(target_protocol_version)
  ), aggregate as (
    select
      count(*)::bigint as pair_count,
      count(*) filter (where pairs.improved)::bigint as improved_count,
      percentile_cont(0.25) within group (order by pairs.raw_change_pct)::numeric as q1,
      percentile_cont(0.5) within group (order by pairs.raw_change_pct)::numeric as median,
      percentile_cont(0.75) within group (order by pairs.raw_change_pct)::numeric as q3
    from pairs
  )
  select
    (select count(*) from enrolled),
    (select count(*) from selected where purpose = 'baseline'),
    (select count(*) from selected where purpose = 'retest'),
    aggregate.pair_count,
    (select count(*) from pairs join adherence using (enrollment_id) where adherence.per_protocol),
    (select count(*) from enrolled where lifecycle_status = 'withdrawn'),
    aggregate.improved_count,
    case when aggregate.pair_count = 0 then null
      else 100 * aggregate.improved_count::numeric / aggregate.pair_count::numeric end,
    aggregate.q1,
    aggregate.median,
    aggregate.q3,
    round(aggregate.q1, 1),
    round(aggregate.median, 1),
    round(aggregate.q3, 1),
    aggregate.pair_count >= 15
      and aggregate.median >= 3
      and 100 * aggregate.improved_count::numeric / aggregate.pair_count::numeric >= 60
  from aggregate;
$$;

create or replace function private.resting_heart_rate_results(target_protocol_version uuid)
returns table (
  enrollment_id uuid,
  result_status text,
  baseline_distinct_days bigint,
  comparison_distinct_days bigint,
  source_family text,
  device_family text,
  baseline_window_median_bpm numeric,
  comparison_window_median_bpm numeric,
  raw_change_bpm numeric,
  display_change_bpm numeric,
  outcome_label text
)
language sql stable security definer set search_path = '' as $$
  with protocol as (
    select protocol.program_id, template.rhr_baseline_start_on, template.rhr_baseline_end_on,
      template.rhr_comparison_start_on, template.rhr_comparison_end_on
    from public.assessment_protocol_versions protocol
    join public.measurement_protocol_templates template
      on template.code = protocol.template_code and template.version = protocol.template_version
    where protocol.id = target_protocol_version
  ), eligible as (
    select reading.enrollment_id, reading.local_date, reading.bpm,
      reading.source_family, reading.device_family,
      case
        when reading.local_date between protocol.rhr_baseline_start_on and protocol.rhr_baseline_end_on
          then 'baseline'
        when reading.local_date between protocol.rhr_comparison_start_on and protocol.rhr_comparison_end_on
          then 'comparison'
      end as window_key
    from public.resting_heart_rate_readings reading
    join protocol on protocol.program_id = reading.program_id
    where reading.protocol_version_id = target_protocol_version
      and reading.status = 'accepted'
      and reading.local_time between time '04:00' and time '10:00'
      and (
        reading.local_date between protocol.rhr_baseline_start_on and protocol.rhr_baseline_end_on
        or reading.local_date between protocol.rhr_comparison_start_on and protocol.rhr_comparison_end_on
      )
  ), daily as (
    select enrollment_id, window_key, source_family, device_family, local_date,
      percentile_cont(0.5) within group (order by bpm)::numeric as daily_median
    from eligible
    group by enrollment_id, window_key, source_family, device_family, local_date
  ), window_stats as (
    select enrollment_id, window_key, source_family, device_family,
      count(*)::bigint as distinct_days,
      percentile_cont(0.5) within group (order by daily_median)::numeric as window_median
    from daily
    group by enrollment_id, window_key, source_family, device_family
  ), family_counts as (
    select enrollment_id, window_key, count(*)::bigint as family_count
    from window_stats group by enrollment_id, window_key
  ), enrollment_set as (
    select enrollment.id
    from public.program_enrollments enrollment
    join protocol on protocol.program_id = enrollment.program_id
  ), pivoted as (
    select
      enrollment_set.id as enrollment_id,
      coalesce(baseline_families.family_count, 0) as baseline_family_count,
      coalesce(comparison_families.family_count, 0) as comparison_family_count,
      baseline.source_family as baseline_source,
      baseline.device_family as baseline_device,
      comparison.source_family as comparison_source,
      comparison.device_family as comparison_device,
      coalesce(baseline.distinct_days, 0) as baseline_days,
      coalesce(comparison.distinct_days, 0) as comparison_days,
      baseline.window_median as baseline_median,
      comparison.window_median as comparison_median
    from enrollment_set
    left join family_counts baseline_families
      on baseline_families.enrollment_id = enrollment_set.id and baseline_families.window_key = 'baseline'
    left join family_counts comparison_families
      on comparison_families.enrollment_id = enrollment_set.id and comparison_families.window_key = 'comparison'
    left join window_stats baseline
      on baseline.enrollment_id = enrollment_set.id and baseline.window_key = 'baseline'
      and baseline_families.family_count = 1
    left join window_stats comparison
      on comparison.enrollment_id = enrollment_set.id and comparison.window_key = 'comparison'
      and comparison_families.family_count = 1
  )
  select
    pivoted.enrollment_id,
    case
      when pivoted.baseline_family_count > 1 or pivoted.comparison_family_count > 1
        or (
          pivoted.baseline_family_count = 1
          and pivoted.comparison_family_count = 1
          and (pivoted.baseline_source, pivoted.baseline_device)
            is distinct from (pivoted.comparison_source, pivoted.comparison_device)
        )
        then 'mismatched_device'
      when pivoted.baseline_days < 3 or pivoted.comparison_days < 3 then 'insufficient'
      else 'complete'
    end,
    pivoted.baseline_days,
    pivoted.comparison_days,
    case when pivoted.baseline_source = pivoted.comparison_source then pivoted.baseline_source end,
    case when pivoted.baseline_device = pivoted.comparison_device then pivoted.baseline_device end,
    case when pivoted.baseline_family_count = 1 and pivoted.comparison_family_count = 1
      and pivoted.baseline_source = pivoted.comparison_source
      and pivoted.baseline_device = pivoted.comparison_device
      and pivoted.baseline_days >= 3 and pivoted.comparison_days >= 3
      then pivoted.baseline_median end,
    case when pivoted.baseline_family_count = 1 and pivoted.comparison_family_count = 1
      and pivoted.baseline_source = pivoted.comparison_source
      and pivoted.baseline_device = pivoted.comparison_device
      and pivoted.baseline_days >= 3 and pivoted.comparison_days >= 3
      then pivoted.comparison_median end,
    case when pivoted.baseline_family_count = 1 and pivoted.comparison_family_count = 1
      and pivoted.baseline_source = pivoted.comparison_source
      and pivoted.baseline_device = pivoted.comparison_device
      and pivoted.baseline_days >= 3 and pivoted.comparison_days >= 3
      then pivoted.comparison_median - pivoted.baseline_median end,
    case when pivoted.baseline_family_count = 1 and pivoted.comparison_family_count = 1
      and pivoted.baseline_source = pivoted.comparison_source
      and pivoted.baseline_device = pivoted.comparison_device
      and pivoted.baseline_days >= 3 and pivoted.comparison_days >= 3
      then round(pivoted.comparison_median - pivoted.baseline_median, 1) end,
    'exploratory'
  from pivoted;
$$;

create or replace function private.apply_complementary_suppression(target_snapshot uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  candidate_cell uuid;
begin
  update public.report_aggregate_cells
  set numeric_value = null, suppressed = true, suppression_reason = 'primary'
  where snapshot_id = target_snapshot and participant_count < 5;

  loop
    with vulnerable_rows as (
      select row_key from public.report_aggregate_cells
      where snapshot_id = target_snapshot
      group by row_key
      having count(*) filter (where suppressed) = 1
        and count(*) filter (where not suppressed) > 0
    ), vulnerable_columns as (
      select column_key from public.report_aggregate_cells
      where snapshot_id = target_snapshot
      group by column_key
      having count(*) filter (where suppressed) = 1
        and count(*) filter (where not suppressed) > 0
    ), candidates as (
      select distinct cell.id, cell.participant_count, cell.row_key, cell.column_key
      from public.report_aggregate_cells cell
      where cell.snapshot_id = target_snapshot and not cell.suppressed
        and (
          cell.row_key in (select row_key from vulnerable_rows)
          or cell.column_key in (select column_key from vulnerable_columns)
        )
    )
    select id into candidate_cell from candidates
    order by participant_count, row_key || ':' || column_key
    limit 1;

    exit when candidate_cell is null;
    update public.report_aggregate_cells
    set numeric_value = null, suppressed = true, suppression_reason = 'complementary'
    where id = candidate_cell;
    candidate_cell := null;
  end loop;
end;
$$;

create or replace function private.reject_frozen_report_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('frozen', 'released', 'superseded') then
    raise exception 'frozen measurement report snapshots are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger measurement_report_snapshots_lock
before update or delete on public.measurement_report_snapshots
for each row execute function private.reject_frozen_report_mutation();

create or replace function private.reject_frozen_aggregate_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.measurement_report_snapshots snapshot
    where snapshot.id = old.snapshot_id
      and snapshot.status in ('frozen', 'released', 'superseded')
  ) then
    raise exception 'aggregate cells in frozen report snapshots are immutable' using errcode = '23514';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1 from public.measurement_report_snapshots snapshot
    where snapshot.id = new.snapshot_id
      and snapshot.status in ('frozen', 'released', 'superseded')
  ) then
    raise exception 'aggregate cells in frozen report snapshots are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger report_aggregate_cells_lock
before insert or update or delete on public.report_aggregate_cells
for each row execute function private.reject_frozen_aggregate_mutation();

revoke all on function private.selected_assessment_attempts(uuid) from public, anon, authenticated;
revoke all on function private.three_kilometer_pairs(uuid) from public, anon, authenticated;
revoke all on function private.adherence_results(uuid) from public, anon, authenticated;
revoke all on function private.measurement_report(uuid) from public, anon, authenticated;
revoke all on function private.resting_heart_rate_results(uuid) from public, anon, authenticated;
revoke all on function private.apply_complementary_suppression(uuid) from public, anon, authenticated;
revoke all on function private.reject_frozen_report_mutation() from public, anon, authenticated;
revoke all on function private.reject_frozen_aggregate_mutation() from public, anon, authenticated;

comment on function private.measurement_report(uuid) is
  'Descriptive paired 3K report. Raw percentages drive quartiles and thresholds; display fields alone are rounded.';
comment on function private.resting_heart_rate_results(uuid) is
  'Exploratory only: median daily accepted 04:00-10:00 readings, then median across qualifying same-device windows.';
comment on function private.apply_complementary_suppression(uuid) is
  'Suppresses n<5, then deterministically adds the smallest lexicographic complementary cells until no total has one hidden value.';
