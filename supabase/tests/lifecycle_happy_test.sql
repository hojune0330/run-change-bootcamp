\set ON_ERROR_STOP on

select private.set_lifecycle_hmac_key(
  'structured_import_duplicates',
  'structured-import-test-key-00000000000000000000000000000000'
);
select private.set_lifecycle_hmac_key(
  'account_deletion_tombstones',
  'account-deletion-test-key-00000000000000000000000000000000'
);
select private.set_lifecycle_hmac_key(
  'ai_control_evidence',
  'ai-control-test-key-000000000000000000000000000000000'
);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000101', '{"display_name":"Admin"}'),
  ('00000000-0000-4000-8000-000000000102', '{"display_name":"Coach"}'),
  ('00000000-0000-4000-8000-000000000103', '{"display_name":"Participant"}');

insert into public.organizations (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'PLUS Run Test');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000102', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000103', 'participant', 'active', '2026-01-01T00:00:00Z');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'PLUS Run 2026', '2026-01-01', '2026-12-31', 'active',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('00000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000101', 'admin', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000122', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000102', 'coach', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000103', 'participant', 'active', '2026-01-01T00:00:00Z');

insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose,
  provider, provider_project_id, endpoint, data_classes, stated_purpose,
  recipient, recipient_profile_id, audience, control, processor_disclosure,
  zero_data_retention_control, granted_at, expires_at
) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000103', 'program_data_processing',
    'plus_run_first_party', null, 'program_operational_database',
    array['identity', 'enrollment', 'program_activity'], 'program_data_processing',
    'program_operations', null, 'participant_and_program_operations',
    'participant_withdrawal', null, null,
    '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000103', 'screenshot_ai',
    'openai', 'proj_plus_run_zdr', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai', null,
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000103', 'generative_feedback_ai',
    'openai', 'proj_plus_run_zdr', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'generative_feedback_draft_creation', 'openai', null,
    'processor_and_named_coach_review', 'named_coach_review_required',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000103', 'named_coach_sensitive_metrics',
    'plus_run_first_party', null, 'audited_sensitive_metric_projection',
    array['activity_metrics', 'health_metrics', 'pain_metrics'],
    'named_coach_sensitive_metrics', 'named_coach',
    '00000000-0000-4000-8000-000000000102', 'participant_and_named_coach',
    'participant_revocable_named_grant', null, null,
    '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');

insert into public.named_coach_grants (
  id, consent_grant_id, program_id, participant_profile_id, coach_profile_id,
  granted_at, expires_at
) values (
  '00000000-0000-4000-8000-000000000205',
  '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000102',
  '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'
);

select private.register_ai_control_attestation(
  '00000000-0000-4000-8000-000000000001',
  'proj_plus_run_zdr',
  '/v1/responses',
  array['screenshot_ai', 'generative_feedback_ai'],
  array[
    'server_sanitized_screenshot_pixels', 'reviewable_metric_draft',
    'approved_nonsensitive_training_context', 'feedback_draft'
  ],
  'openai-approval-reference-test-only',
  '2026-01-01T00:00:00Z',
  '2027-01-01T00:00:00Z'
) as ai_attestation_id \gset

select private.accept_structured_import(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000201',
  'fit',
  '2026-08-28T07:30:00+09:00',
  'garmin',
  'Asia/Seoul',
  array['device_reported'],
  '{"distanceM":5000,"durationS":1800,"paceSecondsPerKm":360}'::jsonb,
  '00000000-0000-4000-8000-000000000103',
  'forerunner'
) as structured_import_id \gset

select private.create_screenshot_draft_job(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000202',
  :'ai_attestation_id'::uuid,
  'screen-2026-08-28-001',
  'image/jpeg',
  24000
) as screenshot_job_id \gset

select private.finish_screenshot_draft_job(:'screenshot_job_id'::uuid, 'succeeded');

insert into public.feedback_items (
  id, program_id, participant_id, origin, classification, body, status,
  consent_grant_id, ai_control_attestation_id
) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  'ai', 'low_risk', 'A deidentified training observation.', 'pending_approval',
  '00000000-0000-4000-8000-000000000203', :'ai_attestation_id'::uuid
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', false);
select public.review_feedback(
  '00000000-0000-4000-8000-000000000301',
  'approved',
  'Reviewed against the training plan.'
);

select private.record_audit(
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
  'lifecycle.safe_metadata',
  'consent_grant',
  '00000000-0000-4000-8000-000000000203',
  '{"consent_grant_id":"00000000-0000-4000-8000-000000000203","purpose":"generative_feedback_ai"}'::jsonb
);

select private.enqueue_notification_event(
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000010',
  'reminder', 'program_reminder', null, null,
  'reminder:2026-08-28:001', now()
);
select private.enqueue_notification_event(
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000010',
  'reminder', 'program_reminder', null, null,
  'reminder:2026-08-28:002', now()
);
select private.enqueue_notification_event(
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000010',
  'reminder', 'program_reminder', null, null,
  'reminder:2026-08-28:003', now()
);

do $$
begin
  if exists (select 1 from public.notification_outbox where channel = 'push') then
    raise exception 'push was created before explicit opt-in';
  end if;
end;
$$;

insert into public.notification_preferences (
  participant_profile_id, digest, channels
) values (
  '00000000-0000-4000-8000-000000000103',
  'daily',
  array['in_app', 'push']
);

select private.enqueue_notification_event(
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000010',
  'reminder', 'program_reminder', null, null,
  'reminder:2026-08-29:001', now() + interval '1 day'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', false);
select public.request_account_deletion() as deletion_request_id \gset
select requested_at as deletion_requested_at
from public.account_deletion_requests where id = :'deletion_request_id'::uuid \gset
select private.advance_account_deletion(
  :'deletion_request_id'::uuid, 'storage_live', :'deletion_requested_at'::timestamptz + interval '1 hour'
);
select private.advance_account_deletion(
  :'deletion_request_id'::uuid, 'database_live', :'deletion_requested_at'::timestamptz + interval '2 hours'
);
select private.advance_account_deletion(
  :'deletion_request_id'::uuid, 'auth_identity', :'deletion_requested_at'::timestamptz + interval '2 hours 5 minutes'
);
select private.advance_account_deletion(
  :'deletion_request_id'::uuid, 'backup_vendor_tombstone', :'deletion_requested_at'::timestamptz + interval '3 hours'
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('accepted_structured_imports', 'screenshot_draft_jobs')
      and column_name in (
        'raw_filename', 'local_fingerprint', 'client_hmac', 'coordinates',
        'route_coordinates', 'device_serial', 'pixels', 'object_path', 'upload_id'
      )
  ) then
    raise exception 'forbidden raw or client-derived lifecycle column exists';
  end if;
  if not exists (
    select 1 from public.accepted_structured_imports
    where participant_profile_id = '00000000-0000-4000-8000-000000000103'
      and server_duplicate_hmac ~ '^[0-9a-f]{64}$'
      and parser_name = 'plus_run_fit_adapter'
      and parser_version = '1'
      and delete_after <= ('2026-12-31'::date::timestamp at time zone 'Asia/Seoul') + interval '30 days'
  ) then
    raise exception 'structured import provenance or retention contract failed';
  end if;
  if not exists (
    select 1 from public.screenshot_draft_jobs
    where idempotency_key = 'screen-2026-08-28-001'
      and status = 'succeeded'
      and metadata_expires_at = completed_at + interval '24 hours'
  ) then
    raise exception 'screenshot metadata retention contract failed';
  end if;
  if not exists (
    select 1 from public.feedback_items
    where id = '00000000-0000-4000-8000-000000000301'
      and status = 'published'
      and approved_by = '00000000-0000-4000-8000-000000000102'
      and consent_grant_id = '00000000-0000-4000-8000-000000000203'
  ) then
    raise exception 'named coach feedback review contract failed';
  end if;
  if (select count(*) from public.notification_records
      where recipient_profile_id = '00000000-0000-4000-8000-000000000103') <> 4
    or exists (
      select 1 from public.notification_records
      where recipient_profile_id = '00000000-0000-4000-8000-000000000103'
      group by local_day
      having count(*) > 3
    ) then
    raise exception 'logical event cap did not stop at three per Seoul day';
  end if;
  if (select count(*) from public.notification_outbox where channel = 'in_app') <> 4
    or (select count(*) from public.notification_outbox where channel = 'push') <> 1 then
    raise exception 'push opt-in or downstream channel fanout failed';
  end if;
  if (select count(*) from public.notification_digest_queue where status = 'queued') <> 1 then
    raise exception 'overflow event was not queued for digest';
  end if;
  if exists (
    select 1 from public.notification_records
    where body <> 'Open PLUS Run to view this update.'
      or audience <> 'participant'
      or preview_kind <> 'metadata_only'
      or content_sensitivity <> 'metadata_only'
  ) then
    raise exception 'notification content is not generic';
  end if;
  if exists (
    select 1 from public.audit_events
    where not private.audit_details_are_content_free(details)
      or expires_at > occurred_at + interval '180 days'
  ) or not exists (
    select 1 from public.audit_events
    where event_type = 'lifecycle.safe_metadata'
      and details = jsonb_build_object(
        'consent_grant_id', '00000000-0000-4000-8000-000000000203',
        'purpose', 'generative_feedback_ai'
      )
  ) then
    raise exception 'safe audit metadata was not preserved under the 180-day deadline';
  end if;
  if not exists (
    select 1 from public.account_deletion_requests
    where profile_id = '00000000-0000-4000-8000-000000000103'
      and status = 'completed'
      and storage_deleted_at <= database_deleted_at
      and database_deleted_at <= auth_deleted_at
      and auth_deleted_at <= backup_vendor_tombstone_recorded_at
  ) or not exists (
    select 1 from public.account_deletion_tombstones tombstone
    join public.account_deletion_requests deletion on deletion.id = tombstone.request_id
    where deletion.profile_id = '00000000-0000-4000-8000-000000000103'
      and tombstone.subject_tombstone_hmac ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'ordered deletion or tombstone contract failed';
  end if;
  if (select count(*) from public.retention_rules) <> 6 then
    raise exception 'retention rule contract is incomplete';
  end if;
  if not exists (
    select 1 from public.programs
    where id = '00000000-0000-4000-8000-000000000010'
      and identified_data_delete_after
        = ('2026-12-31'::date::timestamp at time zone 'Asia/Seoul') + interval '30 days'
  ) then
    raise exception 'program identified-data end+30 deadline is incorrect';
  end if;
  if private.aggregate_retention_deadline('2026-08-31T12:00:00Z')
      <> '2027-08-31T12:00:00Z'::timestamptz then
    raise exception 'aggregate 12-month deadline is incorrect';
  end if;
end;
$$;

select 'LIFECYCLE_HAPPY_OK' as result;
