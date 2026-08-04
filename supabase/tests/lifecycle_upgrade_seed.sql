\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000101', '{"display_name":"Legacy Admin"}'),
  ('10000000-0000-4000-8000-000000000102', '{"display_name":"Legacy Participant"}');

insert into public.organizations (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Legacy PLUS Run');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('10000000-0000-4000-8000-000000000111', '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000101', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000112', '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000102', 'participant', 'active', '2026-01-01T00:00:00Z');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '10000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  'Legacy Program', '2026-01-01', '2026-12-31', 'active',
  '10000000-0000-4000-8000-000000000101'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('10000000-0000-4000-8000-000000000121', '10000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000101', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000122', '10000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000102', 'participant', 'active', '2026-01-01T00:00:00Z');

insert into public.notification_records (
  id, recipient_profile_id, program_id, category, title, body, contains_sensitive_data, created_at
) values (
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000102',
  '10000000-0000-4000-8000-000000000010',
  'reminder', 'Morning health reminder', 'Heart rate 180 and pain score 7', false,
  '2026-08-01T09:00:00+09:00'
);

insert into public.audit_events (
  organization_id, actor_profile_id, subject_profile_id,
  event_type, entity_type, entity_id, details, occurred_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000102',
  'legacy.health_body', 'legacy_test', '10000000-0000-4000-8000-000000000201',
  '{"body":"Heart rate 180","device_serial":"legacy-serial"}'::jsonb,
  '2026-08-01T09:00:00+09:00'
);

insert into public.audit_events (
  organization_id, actor_profile_id, subject_profile_id,
  event_type, entity_type, entity_id, details, occurred_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000102',
  'legacy.safe_metadata', 'legacy_test', '10000000-0000-4000-8000-000000000201',
  '{"consent_grant_id":"10000000-0000-4000-8000-000000000501","purpose":"program_data_processing"}'::jsonb,
  '2026-08-01T10:00:00+09:00'
);

insert into public.data_uploads (
  id, program_id, owner_profile_id, upload_kind, bucket_id,
  object_path, byte_size, detected_mime_type, status
) values (
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000102',
  'screenshot', 'screenshots',
  '10000000-0000-4000-8000-000000000102/10000000-0000-4000-8000-000000000010/legacy.jpg',
  24000, 'image/jpeg', 'uploaded'
);

insert into storage.objects (id, bucket_id, name, owner) values (
  '10000000-0000-4000-8000-000000000302',
  'screenshots',
  '10000000-0000-4000-8000-000000000102/10000000-0000-4000-8000-000000000010/legacy.jpg',
  '10000000-0000-4000-8000-000000000102'
);

insert into public.account_deletion_requests (
  id, profile_id, status, requested_at
) values (
  '10000000-0000-4000-8000-000000000401',
  '10000000-0000-4000-8000-000000000102',
  'requested', '2026-08-01T00:00:00Z'
);
