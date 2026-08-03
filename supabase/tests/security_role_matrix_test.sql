\set ON_ERROR_STOP on
\pset pager off

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

create or replace function pg_temp.expect_denied_or_zero(
  statement text,
  label text
)
returns void
language plpgsql
as $$
declare
  affected bigint := 0;
  observed text;
begin
  begin
    execute statement;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    observed := sqlstate;
  end;
  if observed is null and affected <> 0 then
    raise exception 'ASSERTION FAILED: % (statement affected % rows)', label, affected;
  end if;
  raise notice 'ASSERTION PASS: % (%)', label,
    case when observed is null then 'zero rows' else 'SQLSTATE ' || observed end;
end;
$$;

create or replace function pg_temp.state_checksum()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  relation_hash text;
  payload text := '';
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('auth', 'public', 'storage')
      and relation.relkind in ('r', 'p')
    order by namespace.nspname, relation.relname
  loop
    execute pg_catalog.format(
      'select pg_catalog.md5(coalesce(pg_catalog.string_agg('
      || 'pg_catalog.to_jsonb(source_row)::text, E''\n'' order by '
      || 'pg_catalog.to_jsonb(source_row)::text), '''')) from %I.%I source_row',
      target.schema_name,
      target.table_name
    ) into relation_hash;
    payload := payload || target.schema_name || '.' || target.table_name
      || ':' || relation_hash || E'\n';
  end loop;
  return pg_catalog.md5(payload);
end;
$$;

create or replace function pg_temp.row_exists(
  target_schema text,
  target_table text,
  target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  found boolean;
begin
  execute pg_catalog.format(
    'select exists (select 1 from %I.%I where id = $1)',
    target_schema,
    target_table
  ) into found using target_id;
  return found;
end;
$$;

create or replace function pg_temp.assert_single_audit_after(
  marker bigint,
  expected_event text,
  expected_actor uuid,
  expected_subject uuid,
  expected_entity uuid,
  expected_details jsonb,
  label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  valid boolean;
begin
  select count(*) = 1
      and bool_and(event.event_type = expected_event)
      and bool_and(event.actor_profile_id is not distinct from expected_actor)
      and bool_and(event.subject_profile_id is not distinct from expected_subject)
      and bool_and(event.entity_id is not distinct from expected_entity)
      and bool_and(event.details = expected_details)
    into valid
  from public.audit_events event
  where event.id > marker;
  if valid is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
  raise notice 'ASSERTION PASS: %', label;
end;
$$;

create temporary table security_test_state (
  key text primary key,
  number_value bigint,
  text_value text
);

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.tenant_configs
    where organization_id = '00000000-0000-0000-0000-000000000100'),
  'participant reads only their organization tenant configuration'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.program_sessions
    where program_id = '00000000-0000-0000-0000-000000000101'
      and session_number = 1),
  'participant reads their scheduled program session'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.assignments
    where id = '00000000-0000-0000-0000-000000000711'),
  'participant reads a published assignment'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.announcements
    where id = '00000000-0000-0000-0000-000000000721'),
  'participant reads a published announcement'
);
insert into public.homework_submissions (
  id, assignment_id, program_id, participant_id,
  response_text, status, submitted_at
) values (
  '00000000-0000-0000-0000-000000008101',
  '00000000-0000-0000-0000-000000000711',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Completed as planned.', 'submitted', '2026-09-01T12:00:00+09:00'
);
insert into public.feed_posts (
  id, program_id, author_profile_id, body, visibility
) values (
  '00000000-0000-0000-0000-000000008102',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Easy run completed.', 'cohort'
);
insert into public.private_question_threads (
  id, program_id, participant_profile_id, question_body, content_origin
) values (
  '00000000-0000-0000-0000-000000008103',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Can I move the easy run by one day?', 'training'
);
insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, recorded_at
) values (
  '00000000-0000-0000-0000-000000008105',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000801',
  '2026-08-28', '06:00:00', 'Asia/Seoul', 62, 'manual', 'manual',
  'pending_review', '2026-08-28T06:00:00+09:00'
);
select pg_temp.assert_true(
  pg_temp.row_exists('public', 'homework_submissions', '00000000-0000-0000-0000-000000008101')
    and pg_temp.row_exists('public', 'feed_posts', '00000000-0000-0000-0000-000000008102')
    and pg_temp.row_exists('public', 'private_question_threads', '00000000-0000-0000-0000-000000008103')
    and pg_temp.row_exists('public', 'resting_heart_rate_readings', '00000000-0000-0000-0000-000000008105'),
  'participant allow paths mutate social Q&A training and measurement rows'
);
rollback;

insert into security_test_state (key, number_value)
select 'participant_metric_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.read_participant_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101'
  )),
  'participant reads their sensitive metric through the audited projection'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'participant_metric_audit'),
  'sensitive.metric_projection.participant_read',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'projection', 'participant_sensitive_metrics',
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid
  ),
  'participant metric RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, number_value)
select 'participant_structured_audit', coalesce(max(id), 0)
from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
select pg_temp.assert_true(
  (select count(*) = 7
      and count(distinct structured_import_id) = 1
      and count(*) filter (
        where metric_kind = 'distance_m' and numeric_value = 5000 and unit = 'm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'duration_s' and numeric_value = 1800 and unit = 's'
      ) = 1
      and count(*) filter (
        where metric_kind = 'pace_s_per_km' and numeric_value = 360 and unit = 's/km'
      ) = 1
      and count(*) filter (
        where metric_kind = 'average_heart_rate_bpm'
          and numeric_value = 150 and unit = 'bpm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'max_heart_rate_bpm'
          and numeric_value = 180 and unit = 'bpm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'steps' and numeric_value = 6200 and unit = 'count'
      ) = 1
      and count(*) filter (
        where metric_kind = 'elevation_gain_m'
          and numeric_value = 45 and unit = 'm'
      ) = 1
      and bool_and(
        source_family = 'garmin' and source_model = 'forerunner'
          and parser_name = 'plus_run_fit_adapter' and parser_version = '1'
          and quality_flags = array['device_reported']::text[]
      )
    from public.read_participant_structured_metrics(
      '00000000-0000-0000-0000-000000000101'
    )),
  'participant reads every accepted import value only through the typed projection'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state
    where key = 'participant_structured_audit'),
  'sensitive.structured_metric_projection.participant_read',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'projection', 'participant_sensitive_metrics',
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid
  ),
  'participant structured RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, number_value)
select 'participant_measurement_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
select pg_temp.assert_true(
  (select count(*) = 2
    and count(*) filter (where record_kind = 'three_kilometer_seconds') = 1
    and count(*) filter (where record_kind = 'resting_heart_rate_bpm') = 1
    from public.read_participant_measurement_details(
      '00000000-0000-0000-0000-000000000101'
    )),
  'participant measurement projection returns only their attempt and RHR details'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'participant_measurement_audit'),
  'sensitive.measurement_projection.participant_read',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object('program_id', '00000000-0000-0000-0000-000000000101'::uuid),
  'participant measurement RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, text_value)
values ('participant_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select numeric_value from public.metric_records$sql$,
  'participant cannot bypass the audited metric projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'participant cannot bypass the typed audited structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_structured_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'participant cannot invoke the named-coach structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select elapsed_seconds from public.assessment_attempts$sql$,
  'participant cannot bypass the audited assessment projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.data_uploads$sql$,
  'participant cannot directly read legacy upload metadata'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.tenant_configs set brand_key = 'run_change'
    where organization_id = '00000000-0000-0000-0000-000000000100'$sql$,
  'participant cannot mutate tenant configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from storage.objects
    where name = '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000101/existing.jpg'$sql$,
  'participant cannot read a guessed own raw Storage path'
);
select pg_temp.expect_denied_or_zero(
  $sql$insert into storage.objects (bucket_id, name, owner) values (
    'screenshots',
    '00000000-0000-0000-0000-000000000011/00000000-0000-0000-0000-000000000101/guessed.jpg',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'participant cannot write a guessed other-user raw Storage path'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'participant_forbidden'
  ),
  'participant forbidden reads and writes leave production state unchanged'
);

insert into security_test_state (key, number_value)
select 'peer_structured_audit', coalesce(max(id), 0)
from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )),
  'same-program peer receives zero target-participant structured values'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state
    where key = 'peer_structured_audit'),
  'sensitive.structured_metric_projection.participant_read',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'projection', 'participant_sensitive_metrics',
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid
  ),
  'same-program peer zero-result projection appends one value-free audit event'
);

insert into security_test_state (key, text_value)
values ('peer_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'same-program peer cannot directly read target-participant import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_structured_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'same-program peer cannot use the named-coach structured projection'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'peer_forbidden'
  ),
  'same-program peer forbidden reads leave production state unchanged'
);

insert into security_test_state (key, text_value)
values ('cross_program_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.tenant_configs
    where organization_id = '00000000-0000-0000-0000-000000000200'),
  'cross-program participant reads their own organization configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select organization_id from public.tenant_configs
    where organization_id = '00000000-0000-0000-0000-000000000100'$sql$,
  'cross-program participant sees no target organization configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.program_sessions
    where program_id = '00000000-0000-0000-0000-000000000101'$sql$,
  'cross-program participant sees no target sessions'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.programs set title = 'forbidden cross-program write'
    where id = '00000000-0000-0000-0000-000000000101'$sql$,
  'cross-program participant cannot mutate the target program'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_measurement_details(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'cross-program participant cannot use the target measurement projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'cross-program participant cannot directly read target import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'cross-program participant cannot use the target structured projection'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'cross_program_forbidden'
  ),
  'cross-program forbidden operations leave production state unchanged'
);

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.program_sessions
    where program_id = '00000000-0000-0000-0000-000000000101'),
  'named coach reads program operations'
);
insert into public.private_question_answers (
  id, thread_id, program_id, author_profile_id, answer_body
) values (
  '00000000-0000-0000-0000-000000008301',
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000011',
  'Keep the next easy run conversational.'
);
insert into public.resting_heart_rate_readings (
  id, program_id, protocol_version_id, enrollment_id, local_date, local_time,
  timezone, bpm, source_family, device_family, status, recorded_at
) values (
  '00000000-0000-0000-0000-000000008302',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000801',
  '2026-08-29', '06:00:00', 'Asia/Seoul', 60, 'manual', 'manual',
  'pending_review', '2026-08-29T06:00:00+09:00'
);
select pg_temp.assert_true(
  pg_temp.row_exists('public', 'private_question_answers', '00000000-0000-0000-0000-000000008301')
    and pg_temp.row_exists('public', 'resting_heart_rate_readings', '00000000-0000-0000-0000-000000008302'),
  'named coach allow paths answer private Q&A and record participant measurement'
);
rollback;

insert into security_test_state (key, number_value)
select 'coach_metric_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )),
  'named coach reads the single consent-bridged metric'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'coach_metric_audit'),
  'sensitive.metric_projection.named_coach_read',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'projection', 'named_coach_sensitive_metrics',
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid,
    'participant_profile_id', '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'named-coach metric RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, number_value)
select 'coach_structured_audit', coalesce(max(id), 0)
from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true
);
select pg_temp.assert_true(
  (select count(*) = 7
      and count(distinct structured_import_id) = 1
      and count(*) filter (
        where metric_kind = 'distance_m' and numeric_value = 5000 and unit = 'm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'duration_s' and numeric_value = 1800 and unit = 's'
      ) = 1
      and count(*) filter (
        where metric_kind = 'pace_s_per_km' and numeric_value = 360 and unit = 's/km'
      ) = 1
      and count(*) filter (
        where metric_kind = 'average_heart_rate_bpm'
          and numeric_value = 150 and unit = 'bpm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'max_heart_rate_bpm'
          and numeric_value = 180 and unit = 'bpm'
      ) = 1
      and count(*) filter (
        where metric_kind = 'steps' and numeric_value = 6200 and unit = 'count'
      ) = 1
      and count(*) filter (
        where metric_kind = 'elevation_gain_m'
          and numeric_value = 45 and unit = 'm'
      ) = 1
      and bool_and(
        source_family = 'garmin' and source_model = 'forerunner'
          and parser_name = 'plus_run_fit_adapter' and parser_version = '1'
          and quality_flags = array['device_reported']::text[]
      )
    from public.read_named_coach_structured_metrics(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000001'
    )),
  'named coach reads every accepted import value only through the typed projection'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state
    where key = 'coach_structured_audit'),
  'sensitive.structured_metric_projection.named_coach_read',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'projection', 'named_coach_sensitive_metrics',
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid,
    'participant_profile_id', '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'named-coach structured RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, number_value)
select 'coach_measurement_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.read_named_coach_measurement_details(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )),
  'named coach reads participant attempt and RHR through exact consent'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'coach_measurement_audit'),
  'sensitive.measurement_projection.named_coach_read',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  jsonb_build_object(
    'program_id', '00000000-0000-0000-0000-000000000101'::uuid,
    'participant_profile_id', '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'named-coach measurement RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, text_value)
values ('named_coach_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select numeric_value from public.metric_records$sql$,
  'named coach cannot bypass the audited metric projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'named coach cannot bypass the typed audited structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'named coach cannot invoke the participant structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select question_body from public.private_question_threads$sql$,
  'named coach cannot bypass the audited private-Q&A projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select bpm from public.resting_heart_rate_readings$sql$,
  'named coach cannot directly read participant RHR'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'named_coach_forbidden'
  ),
  'named coach forbidden reads leave production state unchanged'
);

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.program_sessions
    where program_id = '00000000-0000-0000-0000-000000000101'),
  'other coach retains program operational reads'
);
insert into public.announcements (
  id, program_id, title, body, created_by
) values (
  '00000000-0000-0000-0000-000000008401',
  '00000000-0000-0000-0000-000000000101',
  'Draft operational notice', 'Draft staff-only schedule.',
  '00000000-0000-0000-0000-000000000012'
);
select pg_temp.assert_true(
  pg_temp.row_exists('public', 'announcements', '00000000-0000-0000-0000-000000008401'),
  'other coach retains an ordinary staff write path'
);
rollback;

insert into security_test_state (key, text_value)
values ('other_coach_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'other coach cannot use the named-coach metric projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'other coach cannot directly read participant import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_structured_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'other coach cannot use the named-coach structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_measurement_details(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'other coach cannot use the named-coach measurement projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$insert into public.private_question_answers (
    thread_id, program_id, author_profile_id, answer_body
  ) values (
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000012', 'forbidden answer'
  )$sql$,
  'other coach cannot answer a named-coach private question'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'other_coach_forbidden'
  ),
  'other coach forbidden reads and writes leave production state unchanged'
);

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.measurement_report_snapshots
    where id = '00000000-0000-0000-0000-000000005011')
  and (select count(*) = 2 from public.report_aggregate_cells
    where snapshot_id = '00000000-0000-0000-0000-000000005011'),
  'admin can read governed aggregate snapshot base rows'
);
update public.tenant_configs
set brand_key = 'run_change', program_config_key = 'run_change_nine_week'
where organization_id = '00000000-0000-0000-0000-000000000100';
select pg_temp.assert_true(
  (select brand_key = 'run_change' and program_config_key = 'run_change_nine_week'
    from public.tenant_configs
    where organization_id = '00000000-0000-0000-0000-000000000100'),
  'admin retains tenant configuration write access'
);
rollback;

insert into security_test_state (key, text_value)
values ('admin_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select numeric_value from public.metric_records$sql$,
  'admin cannot directly read individual metric values'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'admin cannot directly read participant import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_structured_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'admin cannot invoke a participant structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select elapsed_seconds from public.assessment_attempts$sql$,
  'admin cannot directly read individual assessment values'
);
select pg_temp.expect_denied_or_zero(
  $sql$select bpm from public.resting_heart_rate_readings$sql$,
  'admin cannot directly read individual RHR values'
);
select pg_temp.expect_denied_or_zero(
  $sql$select question_body from public.private_question_threads$sql$,
  'admin cannot directly read private question bodies'
);
select pg_temp.expect_denied_or_zero(
  $sql$select answer_body from public.private_question_answers$sql$,
  'admin cannot directly read private answer bodies'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.data_uploads$sql$,
  'admin sees no individual upload metadata'
);
select pg_temp.expect_denied_or_zero(
  $sql$insert into public.assessment_attempts (
    program_id, protocol_version_id, assessment_session_id, enrollment_id,
    attempt_kind, status, elapsed_seconds, recorded_at
  ) values (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000901',
    '00000000-0000-0000-0000-000000000911',
    '00000000-0000-0000-0000-000000000801',
    'original', 'pending_review', 999, now()
  )$sql$,
  'admin cannot write individual assessment values'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'admin_forbidden'
  ),
  'admin forbidden individual reads and writes leave production state unchanged'
);

insert into security_test_state (key, number_value)
select 'stakeholder_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true
);
select pg_temp.assert_true(
  (select count(*) = 2
    and count(*) filter (
      where column_key = 'small_group' and participant_count is null
        and numeric_value is null and suppressed
    ) = 1
    and count(*) filter (
      where column_key = 'all_participants' and participant_count = 20
        and numeric_value = 42 and not suppressed
    ) = 1
    from public.read_suppressed_report_snapshot(
      '00000000-0000-0000-0000-000000005011'
    )),
  'stakeholder receives only the suppression-enforcing snapshot projection'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'stakeholder_audit'),
  'aggregate.report_projection.authorized_read',
  '00000000-0000-0000-0000-000000000031', null,
  '00000000-0000-0000-0000-000000005011',
  jsonb_build_object('program_id', '00000000-0000-0000-0000-000000000101'::uuid),
  'stakeholder aggregate RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, text_value)
values ('stakeholder_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.programs$sql$,
  'stakeholder sees no operational program base rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.program_sessions$sql$,
  'stakeholder sees no operational session rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.measurement_report_snapshots$sql$,
  'stakeholder cannot bypass the aggregate snapshot projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.report_aggregate_cells$sql$,
  'stakeholder cannot read aggregate cells directly'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'stakeholder cannot directly read participant import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_named_coach_structured_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  'stakeholder cannot invoke a participant structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.programs set title = 'forbidden stakeholder write'
    where id = '00000000-0000-0000-0000-000000000101'$sql$,
  'stakeholder cannot mutate operational programs'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'stakeholder_forbidden'
  ),
  'stakeholder forbidden reads and writes leave production state unchanged'
);

insert into security_test_state (key, number_value)
select 'exporter_audit', coalesce(max(id), 0) from public.audit_events;
begin;
set local role plus_aggregate_exporter;
select pg_temp.assert_true(
  (select count(*) = 2
    and count(*) filter (
      where column_key = 'small_group' and participant_count is null
        and numeric_value is null and suppressed
    ) = 1
    from public.read_suppressed_report_snapshot(
      '00000000-0000-0000-0000-000000005011'
    )),
  'aggregate exporter receives the same suppression-enforcing projection'
);
commit;
select pg_temp.assert_single_audit_after(
  (select number_value from security_test_state where key = 'exporter_audit'),
  'aggregate.report_projection.authorized_read', null, null,
  '00000000-0000-0000-0000-000000005011',
  jsonb_build_object('program_id', '00000000-0000-0000-0000-000000000101'::uuid),
  'aggregate exporter RPC appends exactly one value-free audit event'
);

insert into security_test_state (key, text_value)
values ('exporter_forbidden', pg_temp.state_checksum());
begin;
set local role plus_aggregate_exporter;
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.measurement_report_snapshots$sql$,
  'aggregate exporter has no report snapshot table grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.report_aggregate_cells$sql$,
  'aggregate exporter has no aggregate cell table grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'aggregate exporter has no structured import table grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'aggregate exporter cannot invoke structured participant RPCs'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_measurement_details(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'aggregate exporter cannot invoke participant-sensitive RPCs'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.programs set title = 'forbidden exporter write'$sql$,
  'aggregate exporter has no operational write grant'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'exporter_forbidden'
  ),
  'aggregate exporter forbidden operations leave production state unchanged'
);

insert into security_test_state (key, text_value)
values ('suspended_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select organization_id from public.tenant_configs$sql$,
  'suspended participant sees no tenant configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.programs$sql$,
  'suspended participant sees no program rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.program_sessions$sql$,
  'suspended participant sees no session rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'suspended participant cannot use the metric projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'suspended participant cannot directly read structured import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'suspended participant cannot use the structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_measurement_details(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'suspended participant cannot use the measurement projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.announcements set title = 'forbidden suspended write'
    where id = '00000000-0000-0000-0000-000000000721'$sql$,
  'suspended participant cannot mutate operational rows'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'suspended_forbidden'
  ),
  'suspended actor operations leave production state unchanged'
);

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'program_memberships'
    and column_name = 'auth_activated_at'
) as has_auth_activation_column \gset
\if :has_auth_activation_column
insert into security_test_state (key, text_value)
values ('preaccepted_forbidden', pg_temp.state_checksum());
begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true
);
select pg_temp.expect_denied_or_zero(
  $sql$select organization_id from public.tenant_configs$sql$,
  'precreated unaccepted identity sees no tenant configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.programs$sql$,
  'precreated unaccepted identity sees no program rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.assignments$sql$,
  'precreated unaccepted identity sees no assignment rows'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'precreated unaccepted identity cannot read structured import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'precreated unaccepted identity cannot use the structured projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$update public.announcements set title = 'forbidden preaccept write'
    where id = '00000000-0000-0000-0000-000000000721'$sql$,
  'precreated unaccepted identity cannot mutate operational rows'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'preaccepted_forbidden'
  ),
  'precreated unaccepted identity leaves production state unchanged'
);
select 'SECURITY_PREACCEPTED_ACTOR_PASS' as result;
\endif

begin;
set local role plus_service_worker;
select pg_temp.assert_true(
  private.scan_deletion_job_alerts('2026-08-04T00:00:00Z') = 0,
  'service worker executes an allowlisted lifecycle function'
);
commit;

insert into security_test_state (key, text_value)
values ('service_worker_forbidden', pg_temp.state_checksum());
begin;
set local role plus_service_worker;
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.account_deletion_requests$sql$,
  'service worker has no lifecycle table read grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.programs$sql$,
  'service worker has no operational table read grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'service worker has no structured import table read grant'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'service worker cannot invoke a structured participant RPC'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_suppressed_report_snapshot(
    '00000000-0000-0000-0000-000000005011'
  )$sql$,
  'service worker cannot invoke the aggregate exporter RPC'
);
select pg_temp.expect_denied_or_zero(
  $sql$insert into public.programs (
    organization_id, title, starts_on, ends_on, created_by
  ) values (
    '00000000-0000-0000-0000-000000000100', 'forbidden worker program',
    '2026-01-01', '2026-12-31', '00000000-0000-0000-0000-000000000021'
  )$sql$,
  'service worker has no operational table write grant'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'service_worker_forbidden'
  ),
  'service worker forbidden operations leave production state unchanged'
);

insert into security_test_state (key, text_value)
values ('anonymous_forbidden', pg_temp.state_checksum());
begin;
set local role anon;
select pg_temp.expect_denied_or_zero(
  $sql$select organization_id from public.tenant_configs$sql$,
  'anonymous cannot read tenant configuration'
);
select pg_temp.expect_denied_or_zero(
  $sql$select id from public.programs$sql$,
  'anonymous cannot read operational programs'
);
select pg_temp.expect_denied_or_zero(
  $sql$select numeric_value from public.metric_records$sql$,
  'anonymous cannot read sensitive metrics'
);
select pg_temp.expect_denied_or_zero(
  $sql$select metrics from public.accepted_structured_imports$sql$,
  'anonymous cannot read structured import JSON'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_participant_structured_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  'anonymous cannot invoke a structured participant RPC'
);
select pg_temp.expect_denied_or_zero(
  $sql$select * from public.read_suppressed_report_snapshot(
    '00000000-0000-0000-0000-000000005011'
  )$sql$,
  'anonymous cannot invoke the aggregate projection'
);
select pg_temp.expect_denied_or_zero(
  $sql$insert into storage.objects (bucket_id, name) values (
    'screenshots', 'anonymous/guessed.jpg'
  )$sql$,
  'anonymous cannot write a guessed Storage path'
);
commit;
select pg_temp.assert_true(
  pg_temp.state_checksum() = (
    select text_value from security_test_state where key = 'anonymous_forbidden'
  ),
  'anonymous forbidden operations leave production state unchanged'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.audit_events event
    where event.details::text ~* '(numeric_value|elapsed_seconds|bpm|question_body|answer_body|prompt|payload)'
  ),
  'all persisted role-matrix audits remain value-free'
);

select 'SECURITY_ROLE_MATRIX_PASS' as result;
