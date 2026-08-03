\set ON_ERROR_STOP on

create extension if not exists dblink with schema public;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000104', '{"display_name":"Deletion Order Test"}'),
  ('00000000-0000-4000-8000-000000000105', '{"display_name":"Other Coach"}');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values (
  '00000000-0000-4000-8000-000000000115',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000105',
  'coach', 'active', '2026-01-01T00:00:00Z'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values (
  '00000000-0000-4000-8000-000000000125',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000105',
  'coach', 'active', '2026-01-01T00:00:00Z'
);

insert into public.organizations (id, name) values (
  '00000000-0000-4000-8000-000000000002', 'Other Organization'
);

select private.register_ai_control_attestation(
  '00000000-0000-4000-8000-000000000002',
  'proj_other_zdr', '/v1/responses',
  array['screenshot_ai'],
  array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
  'other-organization-approval',
  '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'
);

do $$
begin
  begin
    perform private.register_ai_control_attestation(
      '00000000-0000-4000-8000-000000000001',
      'proj_duplicate_zdr', '/v1/responses',
      array['screenshot_ai'],
      array['server_sanitized_screenshot_pixels', 'server_sanitized_screenshot_pixels'],
      'duplicate-class-approval',
      '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'
    );
    raise exception 'expected duplicate AI class rejection';
  exception when check_violation then null;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner) values (
      'screenshots',
      '00000000-0000-4000-8000-000000000103/00000000-0000-4000-8000-000000000010/raw.jpg',
      '00000000-0000-4000-8000-000000000103'
    );
    raise exception 'expected screenshot Storage write rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.data_uploads (
      program_id, owner_profile_id, upload_kind, bucket_id,
      object_path, byte_size, detected_mime_type
    ) values (
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      'fit', 'health-imports',
      '00000000-0000-4000-8000-000000000103/raw.fit', 2048,
      'application/vnd.garmin.fit'
    );
    raise exception 'expected raw data upload rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    perform private.create_screenshot_draft_job(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000203',
      (select id from public.ai_control_attestations
        where organization_id = '00000000-0000-4000-8000-000000000001' limit 1),
      'screen-hostile-purpose-mismatch', 'image/jpeg', 24000
    );
    raise exception 'expected screenshot consent-purpose rejection';
  exception when check_violation then null;
  end;

  begin
    perform private.create_screenshot_draft_job(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000202',
      (select id from public.ai_control_attestations
        where organization_id = '00000000-0000-4000-8000-000000000002'),
      'screen-hostile-organization', 'image/jpeg', 24000
    );
    raise exception 'expected cross-organization attestation rejection';
  exception when check_violation then null;
  end;
end;
$$;

select private.create_screenshot_draft_job(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000202',
  (select id from public.ai_control_attestations
    where organization_id = '00000000-0000-4000-8000-000000000001' limit 1),
  'screen-hostile-retention', 'image/jpeg', 24000
) as retention_job_id \gset

update public.screenshot_draft_jobs
set metadata_expires_at = created_at + interval '30 days'
where id = :'retention_job_id'::uuid;

do $$
begin
  if not exists (
    select 1 from public.screenshot_draft_jobs
    where idempotency_key = 'screen-hostile-retention'
      and status = 'processing'
      and metadata_expires_at = created_at + interval '7 days'
  ) then
    raise exception 'pending screenshot retention was not fixed at seven days';
  end if;
end;
$$;

select private.finish_screenshot_draft_job(
  :'retention_job_id'::uuid, 'failed', 'provider_timeout'
);

do $$
begin
  if not exists (
    select 1 from public.screenshot_draft_jobs
    where idempotency_key = 'screen-hostile-retention'
      and status = 'failed' and error_code = 'provider_timeout'
      and metadata_expires_at = created_at + interval '7 days'
  ) then
    raise exception 'failed screenshot retention exceeded seven days';
  end if;
end;
$$;

select private.accept_structured_import(
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000201',
  'fit', '2026-08-29T07:30:00+09:00', 'garmin', 'Asia/Seoul',
  array['estimated', 'device_reported', 'estimated'],
  '{"distanceM":5100,"durationS":1810}'::jsonb,
  '00000000-0000-4000-8000-000000000103', 'forerunner'
);

do $$
begin
  begin
    perform private.accept_structured_import(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000201',
      'fit', '2026-08-29T07:30:00+09:00', 'garmin', 'Asia/Seoul',
      array['device_reported', 'estimated'],
      '{"distanceM":5100,"durationS":1810}'::jsonb,
      '00000000-0000-4000-8000-000000000103', 'forerunner'
    );
    raise exception 'expected canonical duplicate import rejection';
  exception when unique_violation then null;
  end;
  if not exists (
    select 1 from public.accepted_structured_imports
    where observed_at = '2026-08-29T07:30:00+09:00'
      and quality_flags = array['device_reported', 'estimated']::text[]
  ) then
    raise exception 'quality flags were not deduplicated into canonical order';
  end if;
end;
$$;

insert into public.notification_records (
  id, recipient_profile_id, category, template_key, title, body,
  contains_sensitive_data, audience, preview_kind,
  urgency, timezone, scheduled_at, local_day, logical_event_key
) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000104',
  'reminder', 'assignment_update', 'Heart rate result', 'Heart rate 180',
  true, 'coach', 'raw',
  'nonurgent', 'Asia/Seoul', '2026-08-29T09:00:00+09:00', '2026-08-29',
  'hostile:metadata:001'
);

insert into public.notification_outbox (notification_id, channel, idempotency_key)
values (
  '00000000-0000-4000-8000-000000000401',
  'push', 'hostile:metadata:001:push'
);

do $$
begin
  begin
    insert into public.notification_records (
      recipient_profile_id, program_id, category, template_key, title, body,
      contains_sensitive_data, urgency, timezone, scheduled_at, local_day, logical_event_key
    ) values (
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000010',
      'reminder', 'program_reminder', 'Program reminder',
      'Open PLUS Run to view this update.', false,
      'nonurgent', 'UTC', '2026-08-29T17:00:00+09:00', '2026-08-29',
      'hostile:timezone:001'
    );
    raise exception 'expected explicit non-Seoul timezone rejection';
  exception when check_violation then null;
  end;
  begin
    insert into public.notification_records (
      recipient_profile_id, program_id, category, template_key, title, body,
      contains_sensitive_data, urgency, timezone, scheduled_at, local_day, logical_event_key
    ) values (
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000010',
      'reminder', 'program_reminder', 'Program reminder',
      'Open PLUS Run to view this update.', false,
      'nonurgent', 'Asia/Seoul', '2026-08-29T09:00:00+09:00', '2026-08-30',
      'hostile:local-day:001'
    );
    raise exception 'expected explicit mismatched local day rejection';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.notification_records
    where id = '00000000-0000-4000-8000-000000000401'
      and template_key = 'program_reminder'
      and title = 'Program reminder'
      and body = 'Open PLUS Run to view this update.'
      and contains_sensitive_data = false
      and audience = 'participant' and preview_kind = 'metadata_only'
      and content_sensitivity = 'metadata_only'
  ) then
    raise exception 'Task3 generic notification metadata was not enforced';
  end if;
  if exists (
    select 1 from public.notification_outbox
    where notification_id = '00000000-0000-4000-8000-000000000401'
  ) then
    raise exception 'push was persisted without explicit opt-in';
  end if;

  begin
    insert into public.notification_records (
      recipient_profile_id, program_id, category, template_key, title, body,
      contains_sensitive_data, urgency, timezone, scheduled_at, local_day, logical_event_key
    ) values (
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000010',
      'reminder', 'program_reminder', 'Program reminder',
      'Open PLUS Run to view this update.', false,
      'nonurgent', 'Asia/Seoul', '2026-08-28T21:00:00+09:00', '2026-08-28',
      'hostile:quiet:001'
    );
    raise exception 'expected quiet-hour rejection';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.notification_records (
  recipient_profile_id, program_id, category, template_key, title, body,
  contains_sensitive_data, urgency, timezone, scheduled_at, local_day, logical_event_key
) values
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000010',
    'reminder', 'program_reminder', 'Program reminder', 'Open PLUS Run to view this update.', false,
    'nonurgent', 'Asia/Seoul', '2026-08-30T09:00:00+09:00', '2026-08-30', 'hostile:cap:001'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000010',
    'reminder', 'program_reminder', 'Program reminder', 'Open PLUS Run to view this update.', false,
    'nonurgent', 'Asia/Seoul', '2026-08-30T10:00:00+09:00', '2026-08-30', 'hostile:cap:002'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000010',
    'reminder', 'program_reminder', 'Program reminder', 'Open PLUS Run to view this update.', false,
    'nonurgent', 'Asia/Seoul', '2026-08-30T11:00:00+09:00', '2026-08-30', 'hostile:cap:003');

do $$
begin
  begin
    insert into public.notification_records (
      recipient_profile_id, program_id, category, template_key, title, body,
      contains_sensitive_data, urgency, timezone, scheduled_at, local_day, logical_event_key
    ) values (
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000010',
      'reminder', 'program_reminder', 'Program reminder',
      'Open PLUS Run to view this update.', false,
      'nonurgent', 'Asia/Seoul', '2026-08-30T12:00:00+09:00', '2026-08-30',
      'hostile:cap:004'
    );
    raise exception 'expected logical event cap rejection';
  exception when check_violation then null;
  end;

  begin
    insert into public.audit_events (
      actor_profile_id, subject_profile_id, event_type, entity_type, details
    ) values (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      'hostile.audit_body', 'test', '{"body":"Heart rate 180"}'::jsonb
    );
    raise exception 'expected audit body rejection';
  exception when check_violation then null;
  end;

  begin
    insert into public.audit_events (
      actor_profile_id, subject_profile_id, event_type, entity_type, details
    ) values (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      'hostile.audit_numeric', 'test', '{"consent_grant_id":7}'::jsonb
    );
    raise exception 'expected numeric audit metadata rejection';
  exception when check_violation then null;
  end;

  begin
    update public.retention_rules set maximum_amount = 181
    where rule_key = 'content_free_audit';
    raise exception 'expected retention rule mutation rejection';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.audit_events (
  actor_profile_id, subject_profile_id, event_type, entity_type, details,
  occurred_at, expires_at
) values (
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
  'hostile.audit_safe', 'consent_grant',
  '{"consent_grant_id":"00000000-0000-4000-8000-000000000203","purpose":"generative_feedback_ai"}'::jsonb,
  '2026-08-03T00:00:00Z', '2027-08-03T00:00:00Z'
);

update public.programs
set identified_data_delete_after = now() + interval '1 year'
where id = '00000000-0000-4000-8000-000000000010';

do $$
begin
  if not exists (
    select 1 from public.audit_events
    where event_type = 'hostile.audit_safe'
      and private.audit_details_are_content_free(details)
      and expires_at = occurred_at + interval '180 days'
  ) then
    raise exception 'safe audit metadata or 180-day clipping failed';
  end if;
  if not exists (
    select 1 from public.programs
    where id = '00000000-0000-4000-8000-000000000010'
      and identified_data_delete_after
        = private.program_identified_retention_deadline(ends_on)
  ) then
    raise exception 'program retention deadline was client-mutable';
  end if;
end;
$$;

insert into public.feedback_items (
  id, program_id, participant_id, origin, classification, body, status,
  consent_grant_id, ai_control_attestation_id
) values (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000103',
  'ai', 'low_risk', 'A second deidentified training observation.', 'pending_approval',
  '00000000-0000-4000-8000-000000000203',
  (select id from public.ai_control_attestations
    where organization_id = '00000000-0000-4000-8000-000000000001' limit 1)
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', false);
do $$
begin
  begin
    perform public.review_feedback(
      '00000000-0000-4000-8000-000000000302', 'approved', 'Other coach attempt'
    );
    raise exception 'expected non-named coach review rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', false);
do $$
begin
  begin
    perform public.review_feedback(
      '00000000-0000-4000-8000-000000000302', 'approved', 'Admin attempt'
    );
    raise exception 'expected admin AI review rejection';
  exception when insufficient_privilege then null;
  end;
  if (select status from public.feedback_items
      where id = '00000000-0000-4000-8000-000000000302') <> 'pending_approval' then
    raise exception 'unauthorized AI feedback review changed state';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', false);
select public.request_account_deletion();

do $$
declare
  request_id uuid;
begin
  select id into request_id from public.account_deletion_requests
  where profile_id = '00000000-0000-4000-8000-000000000104';
  begin
    perform private.advance_account_deletion(request_id, 'auth_identity', now());
    raise exception 'expected out-of-order Auth deletion rejection';
  exception when check_violation then null;
  end;
end;
$$;

update public.consent_grants set
  status = 'withdrawn',
  withdrawn_at = now(),
  withdrawn_by_profile_id = '00000000-0000-4000-8000-000000000103',
  withdrawal_reason_code = 'participant_request'
where id = '00000000-0000-4000-8000-000000000202';

do $$
begin
  begin
    perform private.create_screenshot_draft_job(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000202',
      (select id from public.ai_control_attestations
        where organization_id = '00000000-0000-4000-8000-000000000001' limit 1),
      'screen-hostile-withdrawn-consent', 'image/jpeg', 24000
    );
    raise exception 'expected withdrawn screenshot consent rejection';
  exception when check_violation then null;
  end;
end;
$$;

create temporary table lifecycle_projection_audit_baseline as
select count(*)::bigint as audit_count
from public.audit_events
where event_type in (
  'sensitive.structured_metric_projection.participant_read',
  'sensitive.structured_metric_projection.named_coach_read'
);

set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', false);
do $$
begin
  begin
    perform metrics from public.accepted_structured_imports;
    raise exception 'expected non-named coach raw structured metric rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.read_named_coach_structured_metrics(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103'
    );
    raise exception 'expected non-named coach audited projection rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', false);
do $$
begin
  begin
    perform metrics from public.accepted_structured_imports;
    raise exception 'expected admin raw structured metric rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.read_named_coach_structured_metrics(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103'
    );
    raise exception 'expected admin audited projection rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', false);
do $$
begin
  begin
    perform metrics from public.accepted_structured_imports;
    raise exception 'expected deletion-requested participant raw structured metric rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.read_participant_structured_metrics(
      '00000000-0000-4000-8000-000000000010'
    );
    raise exception 'expected deletion-requested participant audited projection rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.accepted_structured_imports (
      program_id, participant_profile_id, consent_grant_id, format, observed_at,
      source_family, source_model, parser_name, parser_version, timezone, quality_flags,
      metrics, server_duplicate_hmac, accepted_by, delete_after
    ) values (
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000201',
      'fit', now(), 'garmin', null, 'client-spoof', '999', 'Asia/Seoul',
      array['device_reported'], '{"distanceM":5000}'::jsonb,
      repeat('a', 64), '00000000-0000-4000-8000-000000000103', now()
    );
    raise exception 'expected client provenance/HMAC insert rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.ai_control_attestations (
      organization_id, provider, provider_project_id, endpoint,
      zero_data_retention_control, purposes, data_classes,
      approval_reference_hash, approved_at, expires_at
    ) values (
      '00000000-0000-4000-8000-000000000001', 'openai',
      'client_project', '/v1/responses', 'approved_project_endpoint_zdr',
      array['screenshot_ai'],
      array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
      repeat('b', 64), now(), now() + interval '1 day'
    );
    raise exception 'expected client attestation insert rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.account_deletion_requests (
      profile_id, status, subject_tombstone_hmac, backup_vendor_tombstone_due_at
    ) values (
      '00000000-0000-4000-8000-000000000103',
      'requested', repeat('c', 64), now() + interval '30 days'
    );
    raise exception 'expected direct deletion request insert rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from public.audit_events
      where event_type in (
        'sensitive.structured_metric_projection.participant_read',
        'sensitive.structured_metric_projection.named_coach_read'
      )) <> (select audit_count from lifecycle_projection_audit_baseline) then
    raise exception 'denied audited projections appended audit rows';
  end if;
end;
$$;

create temporary table lifecycle_concurrency_results (
  actor text primary key,
  notification_id uuid not null
);

select public.dblink_connect(
  'lifecycle_lock',
  format(
    'host=%s port=%s dbname=%s user=%s application_name=lifecycle_lock_probe',
    inet_server_addr(), inet_server_port(), current_database(), current_user
  )
);
select public.dblink_connect(
  'lifecycle_retry',
  format(
    'host=%s port=%s dbname=%s user=%s application_name=lifecycle_retry_probe',
    inet_server_addr(), inet_server_port(), current_database(), current_user
  )
);
select public.dblink_exec('lifecycle_lock', 'begin');
select public.dblink_exec('lifecycle_lock', $remote$
  do $block$
  begin
    perform pg_advisory_xact_lock(hashtextextended(
      '00000000-0000-4000-8000-000000000104:2026-09-02', 0
    ));
  end;
  $block$;
$remote$);

select public.dblink_send_query('lifecycle_retry', $remote$
  select private.enqueue_notification_event(
    '00000000-0000-4000-8000-000000000104'::uuid,
    null::uuid, 'reminder', 'program_reminder', null::text, null::uuid,
    'hostile:concurrency:001', '2026-09-02T09:00:00+09:00'::timestamptz
  )
$remote$);

do $$
declare
  attempt integer;
begin
  for attempt in 1..100 loop
    exit when exists (
      select 1 from pg_stat_activity
      where application_name = 'lifecycle_retry_probe' and wait_event = 'advisory'
    );
    perform pg_sleep(0.02);
  end loop;
  if not exists (
    select 1 from pg_stat_activity
    where application_name = 'lifecycle_retry_probe' and wait_event = 'advisory'
  ) then
    raise exception 'concurrent retry never reached the advisory lock';
  end if;
end;
$$;

insert into lifecycle_concurrency_results (actor, notification_id)
select 'lock_holder', notification_id
from public.dblink('lifecycle_lock', $remote$
  select private.enqueue_notification_event(
    '00000000-0000-4000-8000-000000000104'::uuid,
    null::uuid, 'reminder', 'program_reminder', null::text, null::uuid,
    'hostile:concurrency:001', '2026-09-02T09:00:00+09:00'::timestamptz
  )
$remote$) as result(notification_id uuid);

select public.dblink_exec('lifecycle_lock', 'commit');

insert into lifecycle_concurrency_results (actor, notification_id)
select 'retry', notification_id
from public.dblink_get_result('lifecycle_retry') as result(notification_id uuid);

do $$
begin
  if (select count(*) from lifecycle_concurrency_results) <> 2
    or (select count(distinct notification_id) from lifecycle_concurrency_results) <> 1
    or (select count(*) from public.notification_records
        where recipient_profile_id = '00000000-0000-4000-8000-000000000104'
          and logical_event_key = 'hostile:concurrency:001') <> 1 then
    raise exception 'concurrent idempotent retry did not return one logical event';
  end if;
end;
$$;

select public.dblink_disconnect('lifecycle_lock');
select public.dblink_disconnect('lifecycle_retry');

select 'LIFECYCLE_HOSTILE_OK' as result;
