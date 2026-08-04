\set ON_ERROR_STOP on

create or replace function private.test_uuid(seed text)
returns uuid language sql immutable set search_path = '' as $$
  select (
    substr(md5(seed), 1, 8) || '-' || substr(md5(seed), 9, 4) || '-' ||
    substr(md5(seed), 13, 4) || '-' || substr(md5(seed), 17, 4) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid;
$$;

create or replace function private.test_assert(assertion boolean, message text)
returns void language plpgsql set search_path = '' as $$
begin
  if not coalesce(assertion, false) then
    raise exception 'measurement test assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users (id, raw_user_meta_data) values
  (private.test_uuid('admin'), '{"display_name":"Admin"}'),
  (private.test_uuid('coach'), '{"display_name":"Coach"}');
insert into auth.users (id, raw_user_meta_data)
select private.test_uuid('participant-' || participant_number),
  jsonb_build_object('display_name', 'Participant ' || participant_number)
from generate_series(1, 20) participant_number;

insert into public.organizations (id, name)
values (private.test_uuid('organization-plus'), 'PLUS Run Test');
insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values (
  private.test_uuid('org-admin'), private.test_uuid('organization-plus'),
  private.test_uuid('admin'), 'admin', 'active', '2026-08-01T00:00:00+09:00'
);
insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
)
select private.test_uuid('org-participant-' || participant_number),
  private.test_uuid('organization-plus'), private.test_uuid('participant-' || participant_number),
  'participant', 'active', '2026-08-01T00:00:00+09:00'
from generate_series(1, 20) participant_number;

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  private.test_uuid('program-plus'), private.test_uuid('organization-plus'),
  'PLUS Run 2026', '2026-08-24', '2026-10-24', 'active', private.test_uuid('admin')
);
insert into public.tenant_configs (organization_id, brand_key, program_config_key)
values (private.test_uuid('organization-plus'), 'plus_run', 'plus_run_complete_2026');
insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
)
select private.test_uuid('program-participant-' || participant_number),
  private.test_uuid('program-plus'), private.test_uuid('participant-' || participant_number),
  'participant', 'active', '2026-08-24T00:00:00+09:00'
from generate_series(1, 20) participant_number;
insert into public.program_enrollments (
  id, program_id, profile_id, program_membership_id, lifecycle_status, enrolled_on, active_from
)
select private.test_uuid('enrollment-' || participant_number), private.test_uuid('program-plus'),
  private.test_uuid('participant-' || participant_number),
  private.test_uuid('program-participant-' || participant_number), 'active', '2026-08-24', '2026-08-24'
from generate_series(1, 20) participant_number;
update public.program_enrollments
set lifecycle_status = 'withdrawn', withdrawn_at = '2026-09-10T12:00:00+09:00'
where id = private.test_uuid('enrollment-18');
insert into public.program_attrition_events (
  id, program_id, enrollment_id, event_kind, effective_at, reason_code
) values (
  private.test_uuid('attrition-18'), private.test_uuid('program-plus'),
  private.test_uuid('enrollment-18'), 'withdrawal', '2026-09-10T12:00:00+09:00', 'participant_request'
);

insert into public.assessment_protocol_versions (
  id, program_id, template_code, template_version, version, status, created_by, locked_at
) values (
  private.test_uuid('protocol-plus-v1'), private.test_uuid('program-plus'),
  'plus_run_complete_2026', 1, 1, 'locked', private.test_uuid('admin'),
  '2026-08-16T12:00:00+09:00'
);
insert into public.assessment_sessions (
  id, program_id, protocol_version_id, purpose, scheduled_on
) values
  (private.test_uuid('assessment-baseline'), private.test_uuid('program-plus'),
    private.test_uuid('protocol-plus-v1'), 'baseline', '2026-08-27'),
  (private.test_uuid('assessment-retest'), private.test_uuid('program-plus'),
    private.test_uuid('protocol-plus-v1'), 'retest', '2026-10-15');

do $$
declare
  participant_number integer;
  attempt_id uuid;
  retest_seconds numeric[] := array[1020, 1000, 990, 980, 970, 970, 960, 960, 960, 950, 950, 940, 930, 920, 900];
begin
  for participant_number in 1..16 loop
    attempt_id := private.test_uuid('baseline-attempt-' || participant_number);
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
    ) values (
      attempt_id, private.test_uuid('program-plus'), private.test_uuid('protocol-plus-v1'),
      private.test_uuid('assessment-baseline'), private.test_uuid('enrollment-' || participant_number),
      'original', null, 'pending_review', 1000, '2026-08-27T08:00:00+09:00'
    );
    insert into public.assessment_attempt_conditions (
      attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
      warmup_protocol_key, started_local_at, timezone, source_family, device_family
    ) values (
      attempt_id, 'route-v1', 3000, 'track', 'chip', 'warmup-v1', '08:00:00',
      'Asia/Seoul', 'official_timer', 'chip_timer'
    );
    update public.assessment_attempts
    set status = 'accepted', accepted_at = '2026-08-27T09:00:00+09:00'
    where id = attempt_id;
  end loop;

  for participant_number in 1..15 loop
    attempt_id := private.test_uuid('retest-attempt-' || participant_number);
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
    ) values (
      attempt_id, private.test_uuid('program-plus'), private.test_uuid('protocol-plus-v1'),
      private.test_uuid('assessment-retest'), private.test_uuid('enrollment-' || participant_number),
      'original', null, 'pending_review', retest_seconds[participant_number],
      '2026-10-15T08:00:00+09:00'
    );
    insert into public.assessment_attempt_conditions (
      attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
      warmup_protocol_key, started_local_at, timezone, source_family, device_family
    ) values (
      attempt_id, 'route-v1', 3000, 'track', 'chip', 'warmup-v1', '08:00:00',
      'Asia/Seoul', 'official_timer', 'chip_timer'
    );
    update public.assessment_attempts
    set status = 'accepted', accepted_at = '2026-10-15T09:00:00+09:00'
    where id = attempt_id;
  end loop;

  attempt_id := private.test_uuid('retest-attempt-17');
  insert into public.assessment_attempts (
    id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
    attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
  ) values (
    attempt_id, private.test_uuid('program-plus'), private.test_uuid('protocol-plus-v1'),
    private.test_uuid('assessment-retest'), private.test_uuid('enrollment-17'),
    'original', null, 'pending_review', 950, '2026-10-15T08:00:00+09:00'
  );
  insert into public.assessment_attempt_conditions (
    attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
    warmup_protocol_key, started_local_at, timezone, source_family, device_family
  ) values (
    attempt_id, 'route-v1', 3000, 'track', 'chip', 'warmup-v1', '08:00:00',
    'Asia/Seoul', 'official_timer', 'chip_timer'
  );
  update public.assessment_attempts
  set status = 'accepted', accepted_at = '2026-10-15T09:00:00+09:00'
  where id = attempt_id;
end;
$$;

insert into public.program_sessions (
  id, program_id, session_number, scheduled_at, session_kind, title
)
select private.test_uuid('training-session-' || session_number), private.test_uuid('program-plus'),
  session_number, ('2026-08-24'::date + session_number)::timestamptz,
  'training', 'Training ' || session_number
from generate_series(1, 10) session_number;

insert into public.assignments (
  id, program_id, session_id, title, instructions, assignment_kind,
  published_at, created_by
)
select private.test_uuid('training-assignment-' || session_number),
  private.test_uuid('program-plus'), private.test_uuid('training-session-' || session_number),
  'Training evidence ' || session_number, 'Submit completion evidence for coach review.',
  'running', '2026-08-24T09:00:00+09:00', private.test_uuid('admin')
from generate_series(1, 10) session_number;

do $$
declare
  participant_number integer;
  session_number integer;
  prescription_id uuid;
  accepted_target integer;
begin
  for participant_number in 1..15 loop
    accepted_target := case when participant_number <= 12 then 8 else 7 end;
    for session_number in 1..10 loop
      prescription_id := private.test_uuid('prescription-' || participant_number || '-' || session_number);
      insert into public.training_prescriptions (
        id, program_id, enrollment_id, session_id, assigned_at
      ) values (
        prescription_id, private.test_uuid('program-plus'),
        private.test_uuid('enrollment-' || participant_number),
        private.test_uuid('training-session-' || session_number), '2026-08-25T09:00:00+09:00'
      );
      if session_number <= accepted_target then
        insert into public.homework_submissions (
          id, assignment_id, program_id, participant_id, response_text,
          status, submitted_at
        ) values (
          private.test_uuid('completion-submission-' || participant_number || '-' || session_number),
          private.test_uuid('training-assignment-' || session_number),
          private.test_uuid('program-plus'), private.test_uuid('participant-' || participant_number),
          'Completion evidence reviewed by coach.', 'reviewed',
          '2026-09-01T08:00:00+09:00'
        );
        insert into public.session_adherence_evidence (
          id, program_id, enrollment_id, prescription_id, evidence_kind,
          linked_record_id, status, accepted_at
        ) values (
          private.test_uuid('evidence-' || participant_number || '-' || session_number),
          private.test_uuid('program-plus'), private.test_uuid('enrollment-' || participant_number),
          prescription_id, 'submission',
          private.test_uuid('completion-submission-' || participant_number || '-' || session_number),
          'accepted', '2026-09-01T09:00:00+09:00'
        );
      end if;
    end loop;
  end loop;
end;
$$;

insert into public.training_prescriptions (
  id, program_id, enrollment_id, session_id, assigned_at
) values (
  private.test_uuid('prescription-seoul-boundary'), private.test_uuid('program-plus'),
  private.test_uuid('enrollment-20'), private.test_uuid('training-session-1'),
  '2026-08-23T15:30:00+00:00'
);
select private.test_assert(
  (select assigned_while_active from public.training_prescriptions
   where id = private.test_uuid('prescription-seoul-boundary')),
  'assigned day is derived in locked Asia/Seoul timezone'
);
do $$
begin
  begin
    insert into public.session_adherence_evidence (
      id, program_id, enrollment_id, prescription_id, evidence_kind,
      linked_record_id, status, accepted_at
    ) values (
      private.test_uuid('forged-adherence-evidence'), private.test_uuid('program-plus'),
      private.test_uuid('enrollment-20'), private.test_uuid('prescription-seoul-boundary'),
      'submission', private.test_uuid('nonexistent-submission'), 'accepted', now()
    );
    raise exception 'arbitrary adherence UUID unexpectedly accepted';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, accepted_at
)
select private.test_uuid('rhr-p1-' || ordinal), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('enrollment-1'),
  local_date, local_time, 'Asia/Seoul', bpm, 'garmin', 'forerunner',
  'accepted', '2026-10-15T12:00:00+09:00'
from (values
  (1, date '2026-08-17', time '06:00', 60), (2, date '2026-08-17', time '06:05', 64),
  (3, date '2026-08-18', time '07:00', 58), (4, date '2026-08-19', time '05:30', 61),
  (5, date '2026-10-08', time '06:00', 56), (6, date '2026-10-08', time '06:10', 58),
  (7, date '2026-10-09', time '07:00', 55), (8, date '2026-10-10', time '05:00', 56),
  (9, date '2026-10-11', time '03:59', 20)
) readings(ordinal, local_date, local_time, bpm);

insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, accepted_at
)
select private.test_uuid('rhr-p2-' || ordinal), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('enrollment-2'),
  local_date, time '06:00', 'Asia/Seoul', bpm, 'garmin', 'forerunner',
  'accepted', '2026-10-15T12:00:00+09:00'
from (values
  (1, date '2026-08-17', 60), (2, date '2026-08-18', 61),
  (3, date '2026-10-08', 58), (4, date '2026-10-09', 57)
) readings(ordinal, local_date, bpm);

insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, accepted_at
)
select private.test_uuid('rhr-p3-' || ordinal), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('enrollment-3'),
  local_date, time '06:00', 'Asia/Seoul', bpm,
  case when local_date < date '2026-10-01' then 'garmin' else 'apple' end,
  case when local_date < date '2026-10-01' then 'forerunner' else 'watch' end,
  'accepted', '2026-10-15T12:00:00+09:00'
from (values
  (1, date '2026-08-17', 60), (2, date '2026-08-18', 61), (3, date '2026-08-19', 62),
  (4, date '2026-10-08', 58), (5, date '2026-10-09', 57), (6, date '2026-10-10', 56)
) readings(ordinal, local_date, bpm);

do $$
declare
  report record;
  rhr record;
begin
  select * into report from private.measurement_report(private.test_uuid('protocol-plus-v1'));
  perform private.test_assert(report.all_enrolled_count = 20, 'all-enrolled denominator');
  perform private.test_assert(report.baseline_count = 16, 'baseline denominator');
  perform private.test_assert(report.retest_count = 16, 'retest denominator');
  perform private.test_assert(report.valid_pair_count = 15, 'valid-pair denominator');
  perform private.test_assert(report.per_protocol_count = 12, 'per-protocol denominator');
  perform private.test_assert(report.withdrawn_count = 1, 'withdrawn denominator');
  perform private.test_assert(report.improved_count = 13, 'raw positive improved count');
  perform private.test_assert(abs(report.q1_change_pct_raw - 2.5) < 0.000001, 'percentile_cont q1');
  perform private.test_assert(abs(report.median_change_pct_raw - 4) < 0.000001, 'percentile_cont median');
  perform private.test_assert(abs(report.q3_change_pct_raw - 5.5) < 0.000001, 'percentile_cont q3');
  perform private.test_assert(report.product_positive, '15/3/60 product-positive threshold');

  select * into rhr from private.resting_heart_rate_results(private.test_uuid('protocol-plus-v1'))
  where enrollment_id = private.test_uuid('enrollment-1');
  perform private.test_assert(rhr.result_status = 'complete', 'complete RHR status');
  perform private.test_assert(rhr.baseline_distinct_days = 3 and rhr.comparison_distinct_days = 3,
    'RHR distinct-day minimum');
  perform private.test_assert(rhr.baseline_window_median_bpm = 61, 'RHR daily then window baseline median');
  perform private.test_assert(rhr.comparison_window_median_bpm = 56, 'RHR daily then window comparison median');
  perform private.test_assert(rhr.raw_change_bpm = -5 and rhr.outcome_label = 'exploratory',
    'RHR retest-minus-baseline exploratory change');

  select * into rhr from private.resting_heart_rate_results(private.test_uuid('protocol-plus-v1'))
  where enrollment_id = private.test_uuid('enrollment-2');
  perform private.test_assert(rhr.result_status = 'insufficient' and rhr.raw_change_bpm is null,
    'incomplete RHR is never imputed');
  select * into rhr from private.resting_heart_rate_results(private.test_uuid('protocol-plus-v1'))
  where enrollment_id = private.test_uuid('enrollment-3');
  perform private.test_assert(rhr.result_status = 'mismatched_device' and rhr.raw_change_bpm is null,
    'mismatched RHR device is never imputed');
end;
$$;

insert into public.measurement_report_snapshots (
  id, program_id, protocol_version_id, calculation_version, report_payload
) values (
  private.test_uuid('snapshot'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), 'plus_run_measurement_v1', '{}'
);
insert into public.report_aggregate_cells (
  id, snapshot_id, row_key, column_key, participant_count, numeric_value
) values
  (private.test_uuid('cell-aa'), private.test_uuid('snapshot'), 'group_a', 'stage_a', 3, 1),
  (private.test_uuid('cell-ab'), private.test_uuid('snapshot'), 'group_a', 'stage_b', 5, 2),
  (private.test_uuid('cell-ac'), private.test_uuid('snapshot'), 'group_a', 'stage_c', 9, 3),
  (private.test_uuid('cell-ba'), private.test_uuid('snapshot'), 'group_b', 'stage_a', 8, 4),
  (private.test_uuid('cell-bb'), private.test_uuid('snapshot'), 'group_b', 'stage_b', 10, 5),
  (private.test_uuid('cell-bc'), private.test_uuid('snapshot'), 'group_b', 'stage_c', 11, 6);
select private.apply_complementary_suppression(private.test_uuid('snapshot'));
select private.test_assert(
  (select count(*) from public.report_aggregate_cells
   where snapshot_id = private.test_uuid('snapshot') and suppression_reason = 'primary') = 1,
  'one primary n-under-five suppression'
);
select private.test_assert(
  (select array_agg(row_key || ':' || column_key order by row_key, column_key)
   from public.report_aggregate_cells
   where snapshot_id = private.test_uuid('snapshot') and suppression_reason = 'complementary')
  = array['group_a:stage_b', 'group_b:stage_a', 'group_b:stage_b'],
  'deterministic complementary suppression'
);
select private.test_assert(
  not exists (
    select 1 from public.report_aggregate_cells
    where snapshot_id = private.test_uuid('snapshot')
      and suppressed
      and numeric_value is not null
  ),
  'suppressed aggregate values are not exposed'
);

update public.measurement_report_snapshots
set status = 'frozen', frozen_at = now()
where id = private.test_uuid('snapshot');
do $$
begin
  begin
    update public.report_aggregate_cells set participant_count = 99
    where id = private.test_uuid('cell-aa');
    raise exception 'frozen aggregate cell unexpectedly changed';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.assessment_protocol_versions (
  id, program_id, template_code, template_version, version, status, created_by, locked_at
) values (
  private.test_uuid('protocol-plus-v2'), private.test_uuid('program-plus'),
  'plus_run_complete_2026', 1, 2, 'locked', private.test_uuid('admin'), now()
);
insert into public.governance_release_statuses (
  id, program_id, protocol_version_id, status, candidate_sha,
  program_owner_approved_at, privacy_approved_at, released_at
) values (
  private.test_uuid('governance-v2'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v2'), 'released', repeat('a', 40), now(), now(), now()
);
insert into public.governance_release_statuses (
  id, program_id, protocol_version_id, status
) values (
  private.test_uuid('governance-v1'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), 'pending'
);
do $$
begin
  begin
    insert into public.measurement_report_snapshots (
      id, program_id, protocol_version_id, governance_release_status_id,
      calculation_version, status, report_payload
    ) values (
      private.test_uuid('snapshot-cross-scope'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('governance-v2'),
      'plus_run_measurement_v1', 'draft', '{}'
    );
    raise exception 'cross-protocol governance reference unexpectedly accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.measurement_report_snapshots (
      id, program_id, protocol_version_id, governance_release_status_id,
      calculation_version, status, report_payload, frozen_at, released_at
    ) values (
      private.test_uuid('snapshot-premature-release'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('governance-v1'),
      'plus_run_measurement_v1', 'released', '{}', now(), now()
    );
    raise exception 'snapshot released without released governance';
  exception when check_violation then null;
  end;
end;
$$;
update public.governance_release_statuses
set status = 'released', candidate_sha = repeat('b', 40),
  program_owner_approved_at = now(), privacy_approved_at = now(), released_at = now()
where id = private.test_uuid('governance-v1');
insert into public.measurement_report_snapshots (
  id, program_id, protocol_version_id, governance_release_status_id,
  calculation_version, status, report_payload, frozen_at, released_at
) values (
  private.test_uuid('snapshot-released'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('governance-v1'),
  'plus_run_measurement_v1', 'released', '{}', now(), now()
);
do $$
begin
  begin
    update public.governance_release_statuses set status = 'pending', released_at = null
    where id = private.test_uuid('governance-v1');
    raise exception 'released governance unexpectedly changed';
  exception when check_violation then null;
  end;
  begin
    insert into public.report_aggregate_cells (
      id, snapshot_id, row_key, column_key, participant_count, numeric_value
    ) values (
      private.test_uuid('late-released-cell'), private.test_uuid('snapshot-released'),
      'all', 'baseline', 20, 20
    );
    raise exception 'aggregate cell unexpectedly added to released snapshot';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.assessment_protocol_versions set version = 2
    where id = private.test_uuid('protocol-plus-v1');
    raise exception 'late protocol edit unexpectedly succeeded';
  exception when check_violation then null;
  end;
  begin
    update public.assessment_attempts set elapsed_seconds = 1
    where id = private.test_uuid('baseline-attempt-1');
    raise exception 'accepted attempt edit unexpectedly succeeded';
  exception when check_violation then null;
  end;
  begin
    update public.assessment_attempt_conditions set surface_key = 'road'
    where attempt_id = private.test_uuid('baseline-attempt-1');
    raise exception 'accepted conditions edit unexpectedly succeeded';
  exception when check_violation then null;
  end;
  begin
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, status, elapsed_seconds, recorded_at
    ) values (
      private.test_uuid('ordinary-second'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
      private.test_uuid('enrollment-1'), 'original', 'pending_review', 900, now()
    );
    raise exception 'ordinary second attempt unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end;
$$;

insert into public.assessment_attempts (
  id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
  attempt_kind, status, elapsed_seconds, recorded_at, invalidated_at, invalidation_reason_code
) values (
  private.test_uuid('technical-original'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
  private.test_uuid('enrollment-19'), 'original', 'invalidated', 1000,
  '2026-08-27T08:00:00+09:00', '2026-08-27T08:05:00+09:00',
  'technical_interruption'
);
insert into public.assessment_attempt_conditions (
  attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
  warmup_protocol_key, started_local_at, timezone, source_family, device_family
) values (
  private.test_uuid('technical-original'), 'route-v1', 3000, 'track', 'chip',
  'warmup-v1', '08:00', 'Asia/Seoul', 'official_timer', 'chip_timer'
);
insert into public.assessment_attempts (
  id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
  attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
) values (
  private.test_uuid('technical-reattempt'), private.test_uuid('program-plus'),
  private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
  private.test_uuid('enrollment-19'), 'technical_reattempt', private.test_uuid('technical-original'),
  'pending_review', 950, '2026-08-30T08:00:00+09:00'
);
insert into public.assessment_attempt_conditions (
  attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
  warmup_protocol_key, started_local_at, timezone, source_family, device_family
) values (
  private.test_uuid('technical-reattempt'), 'route-v1', 3000, 'track', 'chip',
  'warmup-v1', '08:00', 'Asia/Seoul', 'official_timer', 'chip_timer'
);
update public.assessment_attempts
set status = 'accepted', accepted_at = now()
where id = private.test_uuid('technical-reattempt');
select private.test_assert(
  (select attempt_id from private.selected_assessment_attempts(private.test_uuid('protocol-plus-v1'))
   where enrollment_id = private.test_uuid('enrollment-19') and purpose = 'baseline')
    = private.test_uuid('technical-reattempt'),
  'single accepted technical reattempt selection'
);

do $$
begin
  begin
    update public.assessment_attempts set elapsed_seconds = 999
    where id = private.test_uuid('technical-original');
    raise exception 'original in accepted reattempt chain unexpectedly changed';
  exception when check_violation then null;
  end;
  begin
    update public.assessment_attempt_conditions set surface_key = 'road'
    where attempt_id = private.test_uuid('technical-original');
    raise exception 'original conditions in accepted reattempt chain unexpectedly changed';
  exception when check_violation then null;
  end;
  begin
    update public.assessment_attempt_conditions
    set attempt_id = private.test_uuid('technical-original')
    where attempt_id = private.test_uuid('technical-reattempt');
    raise exception 'accepted conditions unexpectedly moved to another attempt';
  exception when check_violation then null;
  end;
  begin
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
    ) values (
      private.test_uuid('technical-reattempt-before'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
      private.test_uuid('enrollment-19'), 'technical_reattempt', private.test_uuid('technical-original'),
      'pending_review', 940, '2026-08-27T07:59:59+09:00'
    );
    raise exception 'technical reattempt before original unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
    ) values (
      private.test_uuid('technical-reattempt-late'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
      private.test_uuid('enrollment-19'), 'technical_reattempt', private.test_uuid('technical-original'),
      'pending_review', 940, '2026-09-03T08:00:01+09:00'
    );
    raise exception 'technical reattempt after seven days unexpectedly accepted';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.assessment_attempts (
      id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
      attempt_kind, original_attempt_id, status, elapsed_seconds, recorded_at
    ) values (
      private.test_uuid('technical-reattempt-two'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
      private.test_uuid('enrollment-19'), 'technical_reattempt', private.test_uuid('technical-original'),
      'pending_review', 940, '2026-08-31T08:00:00+09:00'
    );
    raise exception 'second technical reattempt unexpectedly succeeded';
  exception when unique_violation then null;
  end;

  insert into public.assessment_attempts (
    id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
    attempt_kind, status, elapsed_seconds, recorded_at
  ) values (
    private.test_uuid('missing-conditions'), private.test_uuid('program-plus'),
    private.test_uuid('protocol-plus-v1'), private.test_uuid('assessment-baseline'),
    private.test_uuid('enrollment-20'), 'original', 'pending_review', 1000, now()
  );
  begin
    update public.assessment_attempts set status = 'accepted', accepted_at = now()
    where id = private.test_uuid('missing-conditions');
    raise exception 'attempt without conditions unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.assessment_attempt_conditions (
      attempt_id, route_version, measured_distance_m, surface_key, timing_method_key,
      warmup_protocol_key, started_local_at, timezone, source_family, device_family
    ) values (
      private.test_uuid('missing-conditions'), 'route-v1', 2999, 'track', 'chip',
      'warmup-v1', '08:00', 'Asia/Seoul', 'official_timer', 'chip_timer'
    );
    raise exception 'mismatched assessment distance unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.resting_heart_rate_readings (
      id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
      timezone, bpm, source_family, device_family, status, accepted_at
    ) values (
      private.test_uuid('missing-rhr-device'), private.test_uuid('program-plus'),
      private.test_uuid('protocol-plus-v1'), private.test_uuid('enrollment-20'),
      '2026-08-17', '06:00', 'Asia/Seoul', 60, 'manual', null, 'accepted', now()
    );
    raise exception 'RHR without device family unexpectedly accepted';
  exception when not_null_violation then null;
  end;
end;
$$;

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  private.test_uuid('program-other'), private.test_uuid('organization-plus'),
  'Other Program', '2026-08-24', '2026-10-24', 'active', private.test_uuid('admin')
);
do $$
begin
  begin
    insert into public.program_enrollments (
      id, program_id, profile_id, program_membership_id, lifecycle_status, enrolled_on
    ) values (
      private.test_uuid('cross-program-enrollment'), private.test_uuid('program-other'),
      private.test_uuid('participant-1'), private.test_uuid('program-participant-1'),
      'onboarding', '2026-08-24'
    );
    raise exception 'cross-program enrollment reference unexpectedly succeeded';
  exception when check_violation then
    if sqlerrm <> 'enrollment must reference the participant membership in the same program' then
      raise;
    end if;
  end;
end;
$$;

select 'MEASUREMENT_PROTOCOL_SQL_PASS' as result;
