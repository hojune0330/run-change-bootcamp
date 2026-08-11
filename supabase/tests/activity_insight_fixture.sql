\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('70000000-0000-4000-8000-000000000101', 'task5-admin@example.test', '{"display_name":"Task 5 Admin"}'),
  ('70000000-0000-4000-8000-000000000102', 'task5-coach@example.test', '{"display_name":"Task 5 Coach"}'),
  ('70000000-0000-4000-8000-000000000103', 'task5-participant@example.test', '{"display_name":"Task 5 Participant"}'),
  ('70000000-0000-4000-8000-000000000104', 'task5-foreign@example.test', '{"display_name":"Task 5 Foreign"}');

insert into public.organizations (id, name) values
  ('70000000-0000-4000-8000-000000000001', 'Task 5 Organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('70000000-0000-4000-8000-000000000111', '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000101', 'admin', 'active', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000112', '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000102', 'coach', 'active', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000113', '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000103', 'participant', 'active', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000114', '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000104', 'participant', 'active', now() - interval '60 days');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '70000000-0000-4000-8000-000000000010',
  '70000000-0000-4000-8000-000000000001',
  'Task 5 Program', current_date - 60, current_date + 60, 'active',
  '70000000-0000-4000-8000-000000000101'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at, auth_activated_at
) values
  ('70000000-0000-4000-8000-000000000121', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000101', 'admin', 'active', now() - interval '60 days', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000122', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000102', 'coach', 'active', now() - interval '60 days', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000123', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103', 'participant', 'active', now() - interval '60 days', now() - interval '60 days'),
  ('70000000-0000-4000-8000-000000000124', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000104', 'participant', 'active', now() - interval '60 days', now() - interval '60 days');

insert into public.program_invitations (
  id, program_id, invitee_profile_id, invitee_email_hash, role, status,
  invited_at, expires_at, accepted_at
) values
  ('70000000-0000-4000-8000-000000000131', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103', repeat('a', 64), 'participant', 'accepted',
    now() - interval '30 days', now() + interval '30 days', now() - interval '29 days'),
  ('70000000-0000-4000-8000-000000000132', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000104', repeat('b', 64), 'participant', 'accepted',
    now() - interval '30 days', now() + interval '30 days', now() - interval '29 days');

insert into public.program_enrollments (
  id, program_id, profile_id, program_membership_id, invitation_id,
  lifecycle_status, enrolled_on, active_from, active_until
) values
  ('70000000-0000-4000-8000-000000000141', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103', '70000000-0000-4000-8000-000000000123',
    '70000000-0000-4000-8000-000000000131', 'active', current_date - 29,
    current_date - 29, current_date + 30),
  ('70000000-0000-4000-8000-000000000142', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000104', '70000000-0000-4000-8000-000000000124',
    '70000000-0000-4000-8000-000000000132', 'active', current_date - 29,
    current_date - 29, current_date + 30);

insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose,
  provider, provider_project_id, endpoint, data_classes, stated_purpose,
  recipient, recipient_profile_id, audience, control, processor_disclosure,
  zero_data_retention_control, granted_at, expires_at
) values
  ('70000000-0000-4000-8000-000000000201', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000103', 'program_data_processing',
    'plus_run_first_party', null, 'program_operational_database',
    array['identity', 'enrollment', 'program_activity'], 'program_data_processing',
    'program_operations', null, 'participant_and_program_operations',
    'participant_withdrawal', null, null, now() - interval '60 days', now() + interval '60 days'),
  ('70000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000010',
    '70000000-0000-4000-8000-000000000104', 'program_data_processing',
    'plus_run_first_party', null, 'program_operational_database',
    array['identity', 'enrollment', 'program_activity'], 'program_data_processing',
    'program_operations', null, 'participant_and_program_operations',
    'participant_withdrawal', null, null, now() - interval '60 days', now() + interval '60 days');

with bounds as (
  select date_trunc('week', now() at time zone 'Asia/Seoul')::date - 7 as week_start
), sources (
  id, participant_id, consent_id, day_offset, local_time, metrics, duplicate_hmac
) as (
  values
    ('70000000-0000-4000-8000-000000000301'::uuid, '70000000-0000-4000-8000-000000000103'::uuid,
      '70000000-0000-4000-8000-000000000201'::uuid, 1, time '07:30',
      '{"distanceM":5000,"durationS":1800,"averageHeartRateBpm":150,"steps":6200}'::jsonb, repeat('1', 64)),
    ('70000000-0000-4000-8000-000000000302'::uuid, '70000000-0000-4000-8000-000000000103'::uuid,
      '70000000-0000-4000-8000-000000000201'::uuid, 6, time '23:59:59',
      '{"distanceM":3000,"durationS":1200,"averageHeartRateBpm":120,"steps":3000}'::jsonb, repeat('2', 64)),
    ('70000000-0000-4000-8000-000000000303'::uuid, '70000000-0000-4000-8000-000000000103'::uuid,
      '70000000-0000-4000-8000-000000000201'::uuid, 2, time '07:30',
      '{"averageHeartRateBpm":200}'::jsonb, repeat('3', 64)),
    ('70000000-0000-4000-8000-000000000304'::uuid, '70000000-0000-4000-8000-000000000103'::uuid,
      '70000000-0000-4000-8000-000000000201'::uuid, 7, time '00:00',
      '{"distanceM":9000,"durationS":3600,"steps":10000}'::jsonb, repeat('4', 64)),
    ('70000000-0000-4000-8000-000000000305'::uuid, '70000000-0000-4000-8000-000000000104'::uuid,
      '70000000-0000-4000-8000-000000000202'::uuid, 3, time '08:00',
      '{"distanceM":1000,"durationS":600,"steps":1200}'::jsonb, repeat('5', 64))
)
insert into public.accepted_structured_imports (
  id, program_id, participant_profile_id, consent_grant_id, format, observed_at,
  source_family, source_model, parser_name, parser_version, timezone,
  quality_flags, metrics, server_duplicate_hmac, accepted_by, accepted_at, delete_after
)
select source.id, '70000000-0000-4000-8000-000000000010', source.participant_id,
  source.consent_id, 'fit',
  ((bounds.week_start + source.day_offset) + source.local_time) at time zone 'Asia/Seoul',
  'garmin', 'forerunner', 'plus_run_fit_adapter', '1', 'Asia/Seoul',
  array['device_reported'], source.metrics, source.duplicate_hmac,
  source.participant_id, now() - interval '1 minute', now()
from bounds cross join sources source;

select 'ACTIVITY_INSIGHT_FIXTURE_READY' as result;
