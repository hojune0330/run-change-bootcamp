\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-0000-0000-000000000001', 'legacy-admin@example.test', '{"display_name":"Legacy admin"}'),
  ('90000000-0000-0000-0000-000000000002', 'legacy-participant@example.test', '{"display_name":"Legacy participant"}');

insert into public.organizations (id, name) values (
  '90000000-0000-0000-0000-000000000100', 'Security upgrade organization'
);
insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('90000000-0000-0000-0000-000000000111', '90000000-0000-0000-0000-000000000100', '90000000-0000-0000-0000-000000000001', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('90000000-0000-0000-0000-000000000112', '90000000-0000-0000-0000-000000000100', '90000000-0000-0000-0000-000000000002', 'participant', 'active', '2026-01-01T00:00:00Z');
insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000100',
  'Security upgrade program', '2026-01-01', '2026-12-31', 'active',
  '90000000-0000-0000-0000-000000000001'
);
insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('90000000-0000-0000-0000-000000000211', '90000000-0000-0000-0000-000000000200', '90000000-0000-0000-0000-000000000001', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('90000000-0000-0000-0000-000000000212', '90000000-0000-0000-0000-000000000200', '90000000-0000-0000-0000-000000000002', 'participant', 'active', '2026-01-01T00:00:00Z');
insert into public.tenant_configs (
  organization_id, brand_key, program_config_key
) values (
  '90000000-0000-0000-0000-000000000100',
  'plus_run', 'plus_run_complete_2026'
);
insert into public.program_enrollments (
  id, program_id, profile_id, program_membership_id,
  lifecycle_status, enrolled_on, active_from
) values (
  '90000000-0000-0000-0000-000000000301',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000212',
  'active', '2026-01-01', '2026-01-01'
);
insert into public.program_sessions (
  id, program_id, session_number, scheduled_at, session_kind, title
) values (
  '90000000-0000-0000-0000-000000000401',
  '90000000-0000-0000-0000-000000000200',
  1, '2026-08-27T09:00:00+09:00', 'time_trial', 'Legacy baseline'
);
insert into public.assignments (
  id, program_id, session_id, title, instructions,
  assignment_kind, published_at, created_by
) values (
  '90000000-0000-0000-0000-000000000411',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000401',
  'Legacy assignment', 'Complete the scheduled run.',
  'running', '2026-08-20T00:00:00Z',
  '90000000-0000-0000-0000-000000000001'
);
insert into public.homework_submissions (
  id, assignment_id, program_id, participant_id,
  response_text, status, submitted_at
) values (
  '90000000-0000-0000-0000-000000000421',
  '90000000-0000-0000-0000-000000000411',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000002',
  'Legacy completion retained.', 'reviewed', '2026-08-28T00:00:00Z'
);
insert into public.assessment_protocol_versions (
  id, program_id, template_code, template_version, version,
  status, created_by, locked_at
) values (
  '90000000-0000-0000-0000-000000000501',
  '90000000-0000-0000-0000-000000000200',
  'plus_run_complete_2026', 1, 1, 'locked',
  '90000000-0000-0000-0000-000000000001', '2026-08-01T00:00:00Z'
);
insert into public.assessment_sessions (
  id, program_id, protocol_version_id, purpose, scheduled_on
) values (
  '90000000-0000-0000-0000-000000000511',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000501',
  'baseline', '2026-08-27'
);
insert into public.assessment_attempts (
  id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
  attempt_kind, status, elapsed_seconds, recorded_at
) values (
  '90000000-0000-0000-0000-000000000521',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000501',
  '90000000-0000-0000-0000-000000000511',
  '90000000-0000-0000-0000-000000000301',
  'original', 'pending_review', 1000, '2026-08-27T09:00:00+09:00'
);
insert into public.assessment_attempt_conditions (
  attempt_id, route_version, measured_distance_m, surface_key,
  timing_method_key, warmup_protocol_key, started_local_at,
  timezone, source_family, device_family
) values (
  '90000000-0000-0000-0000-000000000521', 'legacy-route-v1', 3000,
  'track', 'chip', 'warmup-v1', '09:00:00', 'Asia/Seoul',
  'official_timer', 'chip_timer'
);
update public.assessment_attempts
set status = 'accepted', accepted_at = '2026-08-27T10:00:00+09:00'
where id = '90000000-0000-0000-0000-000000000521';
insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, accepted_at, recorded_at
) values (
  '90000000-0000-0000-0000-000000000531',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000501',
  '90000000-0000-0000-0000-000000000301',
  '2026-08-27', '06:00:00', 'Asia/Seoul', 60, 'garmin', 'forerunner',
  'accepted', '2026-08-27T07:00:00+09:00', '2026-08-27T06:00:00+09:00'
);
insert into public.metric_records (
  id, program_id, owner_profile_id, source, metric_type,
  numeric_value, unit, observed_at, sensitivity, verification_status
) values (
  '90000000-0000-0000-0000-000000000541',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000002',
  'manual', 'distance_m', 3000, 'm', '2026-08-27T09:00:00+09:00',
  'activity', 'accepted'
);
select set_config(
  'request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', false
);
insert into public.private_question_threads (
  id, program_id, participant_profile_id, question_body, content_origin
) values (
  '90000000-0000-0000-0000-000000000601',
  '90000000-0000-0000-0000-000000000200',
  '90000000-0000-0000-0000-000000000002',
  'Legacy private question retained.', 'training'
);
select set_config('request.jwt.claim.sub', '', false);
insert into public.notification_records (
  id, recipient_profile_id, program_id, category, title, body,
  contains_sensitive_data, entity_type, entity_id
) values (
  '90000000-0000-0000-0000-000000000611',
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000200',
  'assignment', 'caller text', 'caller body', true,
  'assignment', '90000000-0000-0000-0000-000000000411'
);

select 'SECURITY_UPGRADE_SEED_PASS' as result;
