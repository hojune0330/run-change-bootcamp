\set ON_ERROR_STOP on

create or replace function pg_temp.assert_true(actual boolean, label text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
  raise notice 'ASSERTION PASS: %', label;
end;
$$;

select pg_temp.assert_true(
  not has_function_privilege(
    'anon', 'public.read_participant_structured_metrics(uuid)', 'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.read_named_coach_structured_metrics(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
    'anon', 'public.read_participant_measurement_details(uuid)', 'EXECUTE'
  )
    and not has_function_privilege(
      'anon', 'public.read_named_coach_measurement_details(uuid,uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon', 'public.read_suppressed_report_snapshot(uuid)', 'EXECUTE'
    ),
  'anonymous cannot execute sensitive or aggregate role projections'
);

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated', 'public.read_participant_sensitive_metrics(uuid)', 'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.read_named_coach_sensitive_metrics(uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated', 'public.read_participant_structured_metrics(uuid)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.read_named_coach_structured_metrics(uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
    'authenticated', 'public.read_participant_measurement_details(uuid)', 'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.read_named_coach_measurement_details(uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated', 'public.read_suppressed_report_snapshot(uuid)', 'EXECUTE'
    ),
  'authenticated receives all seven policy-gated projection entry points'
);

select pg_temp.assert_true(
  (
    select array_agg(
      namespace.nspname || '.' || procedure.proname
      || '(' || pg_get_function_identity_arguments(procedure.oid) || ')'
      order by namespace.nspname, procedure.proname,
        pg_get_function_identity_arguments(procedure.oid)
    )
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prokind = 'f'
      and has_schema_privilege(
        'plus_aggregate_exporter', namespace.oid, 'USAGE'
      )
      and has_function_privilege(
        'plus_aggregate_exporter', procedure.oid, 'EXECUTE'
      )
  ) = array[
    'public.read_suppressed_report_snapshot(target_snapshot uuid)'
  ],
  'aggregate exporter can execute exactly one projection function'
);

select pg_temp.assert_true(
  (
    select array_agg(
      procedure.proname || '(' || pg_get_function_identity_arguments(procedure.oid) || ')'
      order by procedure.proname, pg_get_function_identity_arguments(procedure.oid)
    )
    from pg_proc procedure
    where procedure.pronamespace = 'private'::regnamespace
      and procedure.prokind = 'f'
      and has_function_privilege(
        'plus_service_worker', procedure.oid, 'EXECUTE'
      )
  ) = array[
    'accept_structured_import(target_program uuid, target_participant uuid, target_consent uuid, target_format text, target_observed_at timestamp with time zone, target_source_family text, target_timezone text, target_quality_flags text[], target_metrics jsonb, target_accepted_by uuid, target_source_model text)',
    'advance_account_deletion(target_request uuid, target_step text, target_occurred_at timestamp with time zone)',
    'create_screenshot_draft_job(target_program uuid, target_participant uuid, target_consent uuid, target_attestation uuid, target_idempotency_key text, target_mime_type text, target_byte_length integer)',
    'enqueue_notification_event(target_recipient uuid, target_program uuid, target_category text, target_template text, target_entity_type text, target_entity_id uuid, target_event_key text, target_scheduled_at timestamp with time zone)',
    'finish_screenshot_draft_job(target_job uuid, target_status text, target_error_code text)',
    'rebuild_activity_insight(target_program uuid, target_participant uuid, target_week_start date, target_accepted_import_ids uuid[])',
    'record_account_deletion_failure(target_request uuid, target_error_code text)',
    'scan_deletion_job_alerts(target_now timestamp with time zone)'
  ],
  'service worker can execute exactly the lifecycle and activity insight allowlist'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
      and procedure.proconfig is distinct from array['search_path=""']::text[]
  ),
  'every application security-definer function has an empty fixed search path'
);

select pg_temp.assert_true(
  not has_function_privilege(
    'plus_service_worker',
    'public.read_suppressed_report_snapshot(uuid)', 'EXECUTE'
  )
    and not has_function_privilege(
      'plus_service_worker',
      'public.read_participant_structured_metrics(uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'plus_service_worker',
      'public.read_named_coach_structured_metrics(uuid,uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'plus_aggregate_exporter',
      'public.read_participant_sensitive_metrics(uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'plus_aggregate_exporter',
      'public.read_named_coach_sensitive_metrics(uuid,uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'plus_aggregate_exporter',
      'public.read_participant_structured_metrics(uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'plus_aggregate_exporter',
      'public.read_named_coach_structured_metrics(uuid,uuid)', 'EXECUTE'
    ),
  'custom service roles cannot cross projection boundaries'
);

select 'SECURITY_FUNCTION_BOUNDARY_PASS' as result;
