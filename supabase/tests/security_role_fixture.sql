\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"display_name":"Participant"}'),
  ('00000000-0000-0000-0000-000000000002', '{"display_name":"Participant peer"}'),
  ('00000000-0000-0000-0000-000000000003', '{"display_name":"Cross-program participant"}'),
  ('00000000-0000-0000-0000-000000000004', '{"display_name":"Suspended participant"}'),
  ('00000000-0000-0000-0000-000000000011', '{"display_name":"Named coach"}'),
  ('00000000-0000-0000-0000-000000000012', '{"display_name":"Other coach"}'),
  ('00000000-0000-0000-0000-000000000021', '{"display_name":"Program admin"}'),
  ('00000000-0000-0000-0000-000000000031', '{"display_name":"Stakeholder"}'),
  ('00000000-0000-0000-0000-000000000041', '{"display_name":"Precreated unaccepted user"}');

update auth.users
set email = 'precreated-unaccepted@example.test'
where id = '00000000-0000-0000-0000-000000000041';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'email'
      and data_type = 'character varying'
      and character_maximum_length = 255
      and is_nullable = 'YES'
  ) then
    raise exception 'portable auth.users.email contract does not match Supabase Auth';
  end if;
end;
$$;

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-000000000100', 'Security matrix organization'),
  ('00000000-0000-0000-0000-000000000200', 'Cross-program organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000002', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000003', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000004', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000011', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000512', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000012', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000521', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000021', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000031', 'stakeholder', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000541', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000041', 'participant', 'active', '2026-01-01T00:00:00Z');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000100', 'Security role program', '2026-01-01', '2026-12-31', 'active', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', 'Cross-program boundary', '2026-01-01', '2026-12-31', 'active', '00000000-0000-0000-0000-000000000003');

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', 'participant', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000012', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000021', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000631', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000031', 'stakeholder', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000641', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000041', 'participant', 'active', '2026-01-01T00:00:00Z');

update public.organization_memberships
set status = 'suspended'
where id = '00000000-0000-0000-0000-000000000504';

insert into public.program_invitations (
  id, program_id, invitee_profile_id, invitee_email_hash, role,
  status, invited_at, expires_at, accepted_at
) values
  (
    '00000000-0000-0000-0000-000000000651',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000041',
    encode(extensions.digest(
      convert_to('precreated-unaccepted@example.test', 'UTF8'), 'sha256'
    ), 'hex'),
    'participant', 'created', '2026-08-01T00:00:00Z',
    '2099-01-01T00:00:00Z', null
  ),
  (
    '00000000-0000-0000-0000-000000000652',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    encode(extensions.digest(
      convert_to('active-participant@example.test', 'UTF8'), 'sha256'
    ), 'hex'),
    'participant', 'accepted', '2026-08-01T00:00:00Z',
    '2099-01-01T00:00:00Z', '2026-08-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000653',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000003',
    encode(extensions.digest(
      convert_to('other-program-participant@example.test', 'UTF8'), 'sha256'
    ), 'hex'),
    'participant', 'accepted', '2026-08-01T00:00:00Z',
    '2099-01-01T00:00:00Z', '2026-08-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000654',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000004',
    encode(extensions.digest(
      convert_to('suspended-participant@example.test', 'UTF8'), 'sha256'
    ), 'hex'),
    'participant', 'accepted', '2026-08-01T00:00:00Z',
    '2099-01-01T00:00:00Z', '2026-08-01T00:00:00Z'
  );

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'program_memberships'
    and column_name = 'auth_activated_at'
) as has_auth_activation_column \gset
\if :has_auth_activation_column
update public.program_memberships
set auth_activated_at = '2026-08-01T00:00:00Z'
where profile_id <> '00000000-0000-0000-0000-000000000041';
\endif

insert into public.tenant_configs (organization_id, brand_key, program_config_key) values
  ('00000000-0000-0000-0000-000000000100', 'plus_run', 'plus_run_complete_2026'),
  ('00000000-0000-0000-0000-000000000200', 'plus_run', 'plus_run_complete_2026');

insert into public.program_sessions (
  id, program_id, session_number, scheduled_at, session_kind, title
) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000101', 1, '2026-08-27T09:00:00+09:00', 'time_trial', 'Security baseline'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000101', 2, '2026-09-01T09:00:00+09:00', 'training', 'Security training'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000201', 1, '2026-08-27T09:00:00+09:00', 'time_trial', 'Cross baseline');

insert into public.time_trial_decisions (
  program_id, initial_session_number, protocol, decided_by
) values
  ('00000000-0000-0000-0000-000000000101', 1, '3k', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000201', 1, '3k', '00000000-0000-0000-0000-000000000003');

insert into public.assignments (
  id, program_id, session_id, title, instructions, assignment_kind,
  due_at, published_at, created_by
) values (
  '00000000-0000-0000-0000-000000000711',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000702',
  'Security assignment', 'Submit low-information completion evidence.',
  'running', '2026-09-02T09:00:00+09:00', '2026-08-20T09:00:00+09:00',
  '00000000-0000-0000-0000-000000000011'
);

insert into public.announcements (
  id, program_id, title, body, published_at, created_by
) values (
  '00000000-0000-0000-0000-000000000721',
  '00000000-0000-0000-0000-000000000101',
  'Security notice', 'The next session schedule is available.',
  '2026-08-20T09:00:00+09:00',
  '00000000-0000-0000-0000-000000000011'
);

insert into public.program_enrollments (
  id, program_id, profile_id, program_membership_id, invitation_id,
  lifecycle_status, enrolled_on, active_from
) values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000652', 'active', '2026-01-01', '2026-01-01'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000653', 'active', '2026-01-01', '2026-01-01'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000654', 'active', '2026-01-01', '2026-01-01');

insert into public.assessment_protocol_versions (
  id, program_id, template_code, template_version, version,
  status, created_by, locked_at
) values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000101', 'plus_run_complete_2026', 1, 1, 'locked', '00000000-0000-0000-0000-000000000021', '2026-08-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000201', 'plus_run_complete_2026', 1, 1, 'locked', '00000000-0000-0000-0000-000000000003', '2026-08-01T00:00:00Z');

insert into public.assessment_sessions (
  id, program_id, protocol_version_id, purpose, scheduled_on
) values
  ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000901', 'baseline', '2026-08-27'),
  ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000903', 'baseline', '2026-08-27');

insert into public.assessment_attempts (
  id, program_id, protocol_version_id, assessment_session_id, enrollment_id,
  attempt_kind, status, elapsed_seconds, recorded_at
) values (
  '00000000-0000-0000-0000-000000000921',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000911',
  '00000000-0000-0000-0000-000000000801',
  'original', 'pending_review', 1050, '2026-08-27T09:00:00+09:00'
);
insert into public.assessment_attempt_conditions (
  attempt_id, route_version, measured_distance_m, surface_key,
  timing_method_key, warmup_protocol_key, started_local_at,
  timezone, source_family, device_family
) values (
  '00000000-0000-0000-0000-000000000921', 'security-route-v1', 3000,
  'track', 'chip', 'warmup-v1', '09:00:00', 'Asia/Seoul',
  'official_timer', 'chip_timer'
);
update public.assessment_attempts
set status = 'accepted', accepted_at = '2026-08-27T10:00:00+09:00'
where id = '00000000-0000-0000-0000-000000000921';

insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, accepted_at, recorded_at
) values (
  '00000000-0000-0000-0000-000000000931',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000801',
  '2026-08-27', '06:00:00', 'Asia/Seoul', 61, 'garmin', 'forerunner',
  'accepted', '2026-08-27T07:00:00+09:00', '2026-08-27T06:00:00+09:00'
);

insert into public.training_prescriptions (
  id, program_id, enrollment_id, session_id, assigned_at
) values (
  '00000000-0000-0000-0000-000000000941',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000702',
  '2026-08-20T09:00:00+09:00'
);

insert into public.metric_records (
  id, program_id, owner_profile_id, source, metric_type, numeric_value, unit,
  observed_at, sensitivity, verification_status
) values (
  '00000000-0000-0000-0000-000000002001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'manual', 'heart_rate_bpm', 87, 'bpm', '2026-08-27T06:00:00+09:00',
  'health', 'accepted'
);

alter table public.data_uploads disable trigger data_uploads_reject_new_raw;
insert into public.data_uploads (
  id, program_id, owner_profile_id, upload_kind, bucket_id,
  object_path, byte_size, detected_mime_type, status
) values (
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'screenshot', 'screenshots',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000101/existing.jpg',
  1024, 'image/jpeg', 'uploaded'
);
alter table public.data_uploads enable trigger data_uploads_reject_new_raw;

alter table storage.objects disable trigger storage_objects_reject_legacy_raw;
insert into storage.objects (id, bucket_id, name, owner) values (
  '00000000-0000-0000-0000-000000004002', 'screenshots',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000101/existing.jpg',
  '00000000-0000-0000-0000-000000000001'
);
alter table storage.objects enable trigger storage_objects_reject_legacy_raw;

insert into public.governance_release_statuses (
  id, program_id, protocol_version_id, status
) values (
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901', 'pending'
);
insert into public.measurement_report_snapshots (
  id, program_id, protocol_version_id, governance_release_status_id,
  calculation_version, status, report_payload
) values (
  '00000000-0000-0000-0000-000000005011',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000005001',
  'plus_run_measurement_v1', 'draft', '{}'
);
insert into public.report_aggregate_cells (
  id, snapshot_id, row_key, column_key, participant_count,
  numeric_value, suppressed, suppression_reason
) values
  ('00000000-0000-0000-0000-000000005021', '00000000-0000-0000-0000-000000005011', 'cohort', 'small_group', 3, null, true, 'primary'),
  ('00000000-0000-0000-0000-000000005022', '00000000-0000-0000-0000-000000005011', 'cohort', 'all_participants', 20, 42, false, null);
update public.governance_release_statuses
set status = 'released', candidate_sha = repeat('a', 40),
  program_owner_approved_at = '2026-08-01T00:00:00Z',
  privacy_approved_at = '2026-08-01T00:00:00Z',
  released_at = '2026-08-01T00:00:00Z'
where id = '00000000-0000-0000-0000-000000005001';
update public.measurement_report_snapshots
set status = 'released', frozen_at = '2026-08-01T00:00:00Z',
  released_at = '2026-08-01T00:00:00Z'
where id = '00000000-0000-0000-0000-000000005011';

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider,
  endpoint, data_classes, stated_purpose, recipient, recipient_profile_id,
  audience, control, granted_at, expires_at
) values
  (
    '00000000-0000-0000-0000-000000001002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'named_coach_sensitive_metrics', 'plus_run_first_party',
    'audited_sensitive_metric_projection',
    array['activity_metrics', 'health_metrics', 'pain_metrics'],
    'named_coach_sensitive_metrics', 'named_coach',
    '00000000-0000-0000-0000-000000000011',
    'participant_and_named_coach', 'participant_revocable_named_grant',
    '2026-08-01T00:00:00Z', '2099-01-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000001005',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'social_publication', 'plus_run_first_party', 'program_social_feed',
    array['low_information_social_content'], 'social_publication',
    'program_cohort', null, 'program_cohort',
    'explicit_per_post_publication',
    '2026-08-01T00:00:00Z', '2099-01-01T00:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000001006',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'program_data_processing', 'plus_run_first_party',
    'program_operational_database',
    array['identity', 'enrollment', 'program_activity'],
    'program_data_processing', 'program_operations', null,
    'participant_and_program_operations', 'participant_withdrawal',
    '2026-08-01T00:00:00Z', '2099-01-01T00:00:00Z'
  );
insert into public.named_coach_grants (
  id, consent_grant_id, program_id, participant_profile_id,
  coach_profile_id, granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000001011',
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '2026-08-01T00:00:00Z', '2099-01-01T00:00:00Z'
);
insert into public.metric_consents (
  id, metric_record_id, owner_profile_id, grantee_profile_id,
  grantee_role, purpose, granted_at, expires_at,
  consent_grant_id, named_coach_grant_id
) values (
  '00000000-0000-0000-0000-000000002011',
  '00000000-0000-0000-0000-000000002001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011', 'coach',
  'named_coach_sensitive_metrics', '2026-08-01T00:00:00Z',
  '2099-01-01T00:00:00Z',
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000001011'
);
insert into public.private_question_threads (
  id, program_id, participant_profile_id, question_body, content_origin
) values (
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'How should the next easy run feel?', 'training'
);
commit;

insert into public.accepted_structured_imports (
  id, program_id, participant_profile_id, consent_grant_id, format,
  observed_at, source_family, source_model, parser_name, parser_version,
  timezone, quality_flags, metrics, server_duplicate_hmac,
  accepted_by, delete_after
) values (
  '00000000-0000-0000-0000-000000002101',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000001006',
  'fit', '2026-08-27T07:00:00+09:00', 'garmin', 'forerunner',
  'plus_run_fit_adapter', '1', 'Asia/Seoul', array['device_reported'],
  '{"distanceM":5000,"durationS":1800,"paceSecondsPerKm":360,"averageHeartRateBpm":150,"maxHeartRateBpm":180,"steps":6200,"elevationGainM":45}'::jsonb,
  repeat('d', 64), '00000000-0000-0000-0000-000000000001', now()
);

select 'SECURITY_ROLE_FIXTURE_PASS' as result;
