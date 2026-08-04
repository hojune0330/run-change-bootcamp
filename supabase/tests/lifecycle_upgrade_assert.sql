\set ON_ERROR_STOP on

select private.set_lifecycle_hmac_key(
  'account_deletion_tombstones',
  'upgrade-account-deletion-test-key-000000000000000000000000000000'
);

select private.advance_account_deletion(
  '10000000-0000-4000-8000-000000000401',
  'storage_live', '2026-08-01T01:00:00Z'
);
select private.advance_account_deletion(
  '10000000-0000-4000-8000-000000000401',
  'database_live', '2026-08-01T02:00:00Z'
);
select private.advance_account_deletion(
  '10000000-0000-4000-8000-000000000401',
  'auth_identity', '2026-08-01T02:05:00Z'
);
select private.advance_account_deletion(
  '10000000-0000-4000-8000-000000000401',
  'backup_vendor_tombstone', '2026-08-01T03:00:00Z'
);

do $$
begin
  if not exists (
    select 1 from public.notification_records
    where id = '10000000-0000-4000-8000-000000000201'
      and title = 'Program reminder'
      and body = 'Open PLUS Run to view this update.'
      and template_key = 'program_reminder'
      and audience = 'participant'
      and preview_kind = 'metadata_only'
      and content_sensitivity = 'metadata_only'
      and logical_event_key = 'legacy:10000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'legacy notification was not scrubbed and backfilled';
  end if;
  if not exists (
    select 1 from public.audit_events
    where event_type = 'legacy.health_body'
      and details = '{}'::jsonb
      and expires_at = occurred_at + interval '180 days'
  ) then
    raise exception 'legacy audit body was not scrubbed';
  end if;
  if not exists (
    select 1 from public.audit_events
    where event_type = 'legacy.safe_metadata'
      and details = jsonb_build_object(
        'consent_grant_id', '10000000-0000-4000-8000-000000000501',
        'purpose', 'program_data_processing'
      )
      and expires_at = occurred_at + interval '180 days'
  ) then
    raise exception 'legacy safe audit metadata was not preserved';
  end if;
  if not exists (
    select 1 from public.data_uploads where id = '10000000-0000-4000-8000-000000000301'
  ) or not exists (
    select 1 from storage.objects where id = '10000000-0000-4000-8000-000000000302'
  ) then
    raise exception 'legacy raw records were not preserved for ordered cleanup';
  end if;
  if has_table_privilege('authenticated', 'public.data_uploads', 'INSERT') then
    raise exception 'authenticated raw upload insert privilege remains';
  end if;
  if exists (
    select 1 from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in ('screenshots_owner_insert', 'health_imports_owner_insert')
  ) then
    raise exception 'legacy Storage insert policy remains';
  end if;
  if not exists (
    select 1 from public.account_deletion_requests
    where id = '10000000-0000-4000-8000-000000000401'
      and status = 'completed'
      and phase = 'backup_vendor_tombstone'
      and subject_tombstone_hmac ~ '^[0-9a-f]{64}$'
      and backup_vendor_tombstone_due_at = requested_at + interval '30 days'
  ) or not exists (
    select 1 from public.account_deletion_tombstones
    where request_id = '10000000-0000-4000-8000-000000000401'
      and subject_tombstone_hmac ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'legacy deletion request could not complete with a trusted tombstone';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_deletion_requests_profile_id_fkey'
      and confdeltype = 'n'
  ) then
    raise exception 'deletion request does not survive profile deletion';
  end if;
  if (select count(*) from pg_constraint
      where conrelid in (
        'public.accepted_structured_imports'::regclass,
        'public.screenshot_draft_jobs'::regclass,
        'public.feedback_items'::regclass,
        'public.feedback_review_events'::regclass
      ) and confrelid = 'public.consent_grants'::regclass) < 4 then
    raise exception 'static consent foreign keys are incomplete';
  end if;
  if not exists (
    select 1 from public.programs
    where id = '10000000-0000-4000-8000-000000000010'
      and identified_data_delete_after
        = private.program_identified_retention_deadline(ends_on)
  ) then
    raise exception 'legacy program retention deadline was not backfilled';
  end if;
end;
$$;

do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner) values (
      'screenshots',
      '10000000-0000-4000-8000-000000000102/10000000-0000-4000-8000-000000000010/new.jpg',
      '10000000-0000-4000-8000-000000000102'
    );
    raise exception 'expected post-upgrade Storage write rejection';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.data_uploads (
      program_id, owner_profile_id, upload_kind, bucket_id,
      object_path, byte_size, detected_mime_type
    ) values (
      '10000000-0000-4000-8000-000000000010',
      '10000000-0000-4000-8000-000000000102',
      'screenshot', 'screenshots',
      '10000000-0000-4000-8000-000000000102/new.jpg', 1000, 'image/jpeg'
    );
    raise exception 'expected post-upgrade data upload rejection';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select 'LIFECYCLE_UPGRADE_OK' as result;
