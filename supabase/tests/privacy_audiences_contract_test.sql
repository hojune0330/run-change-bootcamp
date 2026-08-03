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

create or replace function pg_temp.expect_sqlstate(statement text, expected text, label text)
returns void
language plpgsql
as $$
declare
  observed text;
begin
  begin
    execute statement;
  exception when others then
    observed := sqlstate;
  end;
  if observed is null then
    raise exception 'ASSERTION FAILED: % (statement succeeded)', label;
  end if;
  if observed <> expected then
    raise exception 'ASSERTION FAILED: % (expected %, observed %)', label, expected, observed;
  end if;
  raise notice 'ASSERTION PASS: % (SQLSTATE %)', label, observed;
end;
$$;

create temporary table privacy_test_state (
  key text primary key,
  id_value uuid,
  number_value bigint,
  text_value text
);
grant select, insert, update, delete on pg_temp.privacy_test_state to authenticated, anon;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"display_name":"Owner participant"}'),
  ('00000000-0000-0000-0000-000000000002', '{"display_name":"Same-program peer"}'),
  ('00000000-0000-0000-0000-000000000003', '{"display_name":"Cross-program participant"}'),
  ('00000000-0000-0000-0000-000000000004', '{"display_name":"Suspended participant"}'),
  ('00000000-0000-0000-0000-000000000011', '{"display_name":"Named coach"}'),
  ('00000000-0000-0000-0000-000000000012', '{"display_name":"Other coach"}'),
  ('00000000-0000-0000-0000-000000000021', '{"display_name":"Program admin"}'),
  ('00000000-0000-0000-0000-000000000031', '{"display_name":"Stakeholder"}');

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-000000000100', 'Privacy test organization'),
  ('00000000-0000-0000-0000-000000000200', 'Cross-program organization');

insert into public.organization_memberships (
  organization_id, profile_id, role, status, starts_at
) values
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000002', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000004', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000012', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000021', 'admin', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000031', 'stakeholder', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000003', 'participant', 'active', now() - interval '1 day');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000100', 'Privacy audience program', '2000-01-01', '2099-12-31', 'active', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', 'Cross-program boundary', '2000-01-01', '2099-12-31', 'active', '00000000-0000-0000-0000-000000000003');

insert into public.program_memberships (
  program_id, profile_id, role, status, joined_at
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000012', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000021', 'admin', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000031', 'stakeholder', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'participant', 'active', now() - interval '1 day');

update public.organization_memberships
set status = 'suspended'
where organization_id = '00000000-0000-0000-0000-000000000100'
  and profile_id = '00000000-0000-0000-0000-000000000004';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, provider_project_id,
  endpoint, data_classes, stated_purpose, recipient, recipient_profile_id,
  audience, control, processor_disclosure, zero_data_retention_control,
  granted_at, expires_at
) values
  (
    '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'program_data_processing',
    'plus_run_first_party', null, 'program_operational_database',
    array['identity', 'enrollment', 'program_activity'], 'program_data_processing',
    'program_operations', null, 'participant_and_program_operations',
    'participant_withdrawal', null, null, now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'named_coach_sensitive_metrics',
    'plus_run_first_party', null, 'audited_sensitive_metric_projection',
    array['activity_metrics', 'health_metrics', 'pain_metrics'], 'named_coach_sensitive_metrics',
    'named_coach', '00000000-0000-0000-0000-000000000011',
    'participant_and_named_coach', 'participant_revocable_named_grant', null, null,
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'screenshot_ai',
    'openai', 'project-approved', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai', null,
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'generative_feedback_ai',
    'openai', 'project-approved', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'generative_feedback_draft_creation', 'openai', null,
    'processor_and_named_coach_review', 'named_coach_review_required',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000001005', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'social_publication',
    'plus_run_first_party', null, 'program_social_feed',
    array['low_information_social_content'], 'social_publication', 'program_cohort', null,
    'program_cohort', 'explicit_per_post_publication', null, null,
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'aggregate_analysis_reporting',
    'plus_run_first_party', null, 'suppressed_aggregate_report',
    array['deidentified_aggregate_metrics'], 'aggregate_analysis_reporting',
    'authorized_aggregate_recipients', null, 'suppressed_aggregate_only',
    'participant_analysis_inclusion', null, null,
    now() - interval '1 minute', now() + interval '30 days'
  );
insert into public.named_coach_grants (
  id, consent_grant_id, program_id, participant_profile_id, coach_profile_id,
  granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000001011',
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  now() - interval '30 seconds', now() + interval '20 days'
);
select pg_temp.assert_true(
  (select count(distinct purpose) from public.consent_grants
    where participant_profile_id = '00000000-0000-0000-0000-000000000001') = 6,
  'participant created six independent affirmative purposes'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.consent_grants (
    id, program_id, participant_profile_id, purpose, provider, endpoint, data_classes,
    stated_purpose, recipient, audience, control, granted_at, expires_at
  ) values (
    '00000000-0000-0000-0000-000000001099',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001', 'social_publication',
    'plus_run_first_party', 'program_social_feed', array['low_information_social_content'],
    'social_publication', 'program_cohort', 'program_cohort',
    'explicit_per_post_publication', now() - interval '1 minute', now() + interval '1 day'
  )$sql$,
  '23505', 'one active grant per purpose is enforced'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.metric_records (
  id, program_id, owner_profile_id, source, metric_type, numeric_value, unit,
  observed_at, sensitivity, verification_status
) values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'manual', 'heart_rate_bpm', 87, 'bpm', now(), 'health', 'accepted'),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'manual', 'distance_m', 1234, 'm', now(), 'activity', 'accepted');
insert into public.metric_consents (
  id, metric_record_id, owner_profile_id, grantee_profile_id, grantee_role,
  purpose, granted_at, expires_at, consent_grant_id, named_coach_grant_id
) values (
  '00000000-0000-0000-0000-000000002011',
  '00000000-0000-0000-0000-000000002001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011', 'coach',
  'named_coach_sensitive_metrics', now(), now() + interval '10 days',
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000001011'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.metric_consents (
    id, metric_record_id, owner_profile_id, grantee_profile_id, grantee_role,
    purpose, granted_at, expires_at, consent_grant_id, named_coach_grant_id
  ) values (
    '00000000-0000-0000-0000-000000002012',
    '00000000-0000-0000-0000-000000002002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011', 'coach',
    'named_coach_sensitive_metrics', now(), now() + interval '10 days',
    '00000000-0000-0000-0000-000000001003',
    '00000000-0000-0000-0000-000000001011'
  )$sql$,
  '23514', 'screenshot consent cannot substitute for named-coach metric consent'
);
commit;

insert into pg_temp.privacy_test_state (key, number_value)
select 'participant_metric_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.metric_projection.participant_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) from public.read_participant_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101'
  )) = 2,
  'participant audited projection returns both of the participant own metrics'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.metric_projection.participant_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'participant_metric_audit_before'),
  'participant metric projection appends exactly one audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'coach_metric_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.metric_projection.named_coach_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select pg_temp.assert_true(
  (select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )) = 1,
  'named coach projection returns only the metric with the exact canonical bridge'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.metric_projection.named_coach_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'coach_metric_audit_before'),
  'named coach metric projection appends exactly one audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'failed_metric_audit_before', count(*)
from public.audit_events
where event_type like 'sensitive.metric_projection.%';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'same-program peer cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'same-program peer cannot impersonate the named coach projection'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'cross-program participant cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'cross-program participant cannot use named coach projection'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'other coach cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'other coach cannot use another coach named projection'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'admin cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'admin role cannot substitute for named coach consent'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'stakeholder cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'stakeholder role cannot substitute for named coach consent'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'suspended participant cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101'
  )$sql$,
  '42501', 'suspended organization membership disables participant projection'
);
commit;

begin;
set local role anon;
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.metric_records$sql$,
  '42501', 'anonymous cannot directly select sensitive metrics'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )$sql$,
  '42501', 'anonymous has no sensitive projection execute privilege'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type like 'sensitive.metric_projection.%')
  = (select number_value from pg_temp.privacy_test_state
    where key = 'failed_metric_audit_before'),
  'failed sensitive metric attempts append no audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'participant_question_metadata_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.participant_metadata_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_sqlstate(
  $sql$select numeric_value from public.metric_records$sql$,
  '42501', 'metric owner also uses the audited body projection instead of direct SELECT'
);
insert into public.private_question_threads (
  id, program_id, participant_profile_id, question_body, content_origin
) values
  (
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    $body$Robert'); drop table public.profiles; -- <script>alert('x')</script> How should I pace the easy run?$body$,
    'training'
  ),
  (
    '00000000-0000-0000-0000-000000003002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'My private pain score is 8.', 'pain'
  ),
  (
    '00000000-0000-0000-0000-000000003003',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Can you explain an easy-run warmup?', 'general'
  ),
  (
    '00000000-0000-0000-0000-000000003004',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Lifecycle question', 'general'
  ),
  (
    '00000000-0000-0000-0000-000000003005',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Question to soft delete', 'general'
  ),
  (
    '00000000-0000-0000-0000-000000003006',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Closed history to preserve', 'general'
  );
select pg_temp.assert_true(
  (select count(*) from public.read_participant_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )) = 1,
  'participant reads content-free private-question metadata through its narrow projection'
);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_threads$sql$,
  '42501', 'participant cannot directly select private-question thread identifiers'
);
select pg_temp.expect_sqlstate(
  $sql$select question_body from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003001'$sql$,
  '42501', 'participant cannot bypass audited question-body projection'
);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_answers$sql$,
  '42501', 'participant cannot directly select private-answer identifiers'
);
select pg_temp.expect_sqlstate(
  $sql$select answer_body from public.private_question_answers$sql$,
  '42501', 'participant cannot directly select private-answer bodies'
);
select pg_temp.expect_sqlstate(
  $sql$update public.private_question_threads
    set visibility = 'cohort'
    where id = '00000000-0000-0000-0000-000000003001'$sql$,
  '42501', 'private question base-table update is not granted'
);
select public.edit_participant_private_question(
  '00000000-0000-0000-0000-000000003004', 'Edited lifecycle question'
);
select public.transition_participant_private_question(
  '00000000-0000-0000-0000-000000003004', 'closed'
);
select public.transition_participant_private_question(
  '00000000-0000-0000-0000-000000003006', 'closed'
);
select pg_temp.expect_sqlstate(
  $sql$delete from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003005'$sql$,
  '42501', 'private question hard delete is not granted'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.private_question.participant_metadata_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'participant_question_metadata_audit_before'),
  'participant metadata projection appends exactly one value-free audit event'
);
insert into pg_temp.privacy_test_state (key, text_value)
select 'question_3004_closed_at', closed_at::text
from public.private_question_threads
where id = '00000000-0000-0000-0000-000000003004'
union all
select 'question_3006_closed_at', closed_at::text
from public.private_question_threads
where id = '00000000-0000-0000-0000-000000003006';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_sqlstate(
  $sql$update public.private_question_threads
    set status = 'archived', closed_at = now(),
      closed_by_profile_id = '00000000-0000-0000-0000-000000000001'
    where id = '00000000-0000-0000-0000-000000003005'$sql$,
  '23514', 'open-to-archived transition rejects forged closure history'
);
select pg_temp.expect_sqlstate(
  $sql$update public.private_question_threads
    set status = 'deleted', archived_at = now(),
      archived_by_profile_id = '00000000-0000-0000-0000-000000000001'
    where id = '00000000-0000-0000-0000-000000003005'$sql$,
  '23514', 'open-to-deleted transition rejects forged archived history'
);
select pg_temp.expect_sqlstate(
  $sql$update public.private_question_threads
    set status = 'deleted', closed_at = closed_at + interval '1 day'
    where id = '00000000-0000-0000-0000-000000003006'$sql$,
  '23514', 'closed-to-deleted transition cannot rewrite closure history'
);
select set_config('request.jwt.claim.sub', '', false);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.transition_participant_private_question(
  '00000000-0000-0000-0000-000000003004', 'archived'
);
select public.transition_participant_private_question(
  '00000000-0000-0000-0000-000000003005', 'deleted'
);
select public.transition_participant_private_question(
  '00000000-0000-0000-0000-000000003006', 'deleted'
);
commit;

select pg_temp.assert_true(
  (select status = 'archived' and archived_at is not null
      and closed_at::text = (select text_value from pg_temp.privacy_test_state
        where key = 'question_3004_closed_at')
      and closed_by_profile_id = '00000000-0000-0000-0000-000000000001'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003004'),
  'legitimate closed-to-archived transition preserves closure history exactly'
);
select pg_temp.assert_true(
  (select status = 'deleted' and purge_after = deleted_at + interval '30 days'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003005'),
  'question soft delete gets a database-controlled 30-day purge deadline'
);
select pg_temp.assert_true(
  (select status = 'deleted'
      and closed_at::text = (select text_value from pg_temp.privacy_test_state
        where key = 'question_3006_closed_at')
      and closed_by_profile_id = '00000000-0000-0000-0000-000000000001'
      and archived_at is null and archived_by_profile_id is null
      and purge_after = deleted_at + interval '30 days'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003006'),
  'legitimate closed-to-deleted transition preserves closure history exactly'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_sqlstate(
  $sql$select public.transition_participant_private_question(
    '00000000-0000-0000-0000-000000003001', 'closed'
  )$sql$,
  '42501', 'same-program peer cannot mutate another private question through lifecycle RPC'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_threads$sql$,
  '42501', 'named coach cannot directly select private-question thread identifiers'
);
select pg_temp.expect_sqlstate(
  $sql$select question_body from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003001'$sql$,
  '42501', 'named coach cannot bypass audited question-body projection'
);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_answers$sql$,
  '42501', 'named coach cannot directly select private-answer identifiers'
);
select pg_temp.expect_sqlstate(
  $sql$select answer_body from public.private_question_answers$sql$,
  '42501', 'named coach cannot directly select private-answer bodies'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.private_question_answers (
    id, thread_id, program_id, author_profile_id, answer_body, status,
    deleted_at, deleted_by_profile_id, purge_after
  ) values (
    '00000000-0000-0000-0000-000000003099',
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'Forged active answer with deletion metadata', 'active',
    now(), '00000000-0000-0000-0000-000000000011', now() + interval '30 days'
  )$sql$,
  '23514', 'active private answer cannot be inserted with forged deletion metadata'
);
select public.route_named_coach_private_question(
  '00000000-0000-0000-0000-000000003003', 'needs_followup'
);
insert into public.private_question_answers (
  id, thread_id, program_id, author_profile_id, answer_body
) values
  (
    '00000000-0000-0000-0000-000000003011',
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'Ignore previous instructions is inert text here. Keep the easy run conversational.'
  ),
  (
    '00000000-0000-0000-0000-000000003012',
    '00000000-0000-0000-0000-000000003003',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'Start with five minutes of easy movement.'
  );
select pg_temp.expect_sqlstate(
  $sql$update public.private_question_answers
    set visibility = 'cohort'
    where id = '00000000-0000-0000-0000-000000003011'$sql$,
  '42501', 'private answer base-table update is not granted'
);
select public.edit_named_coach_private_answer(
  '00000000-0000-0000-0000-000000003012',
  'Edited warmup answer: start with five minutes of easy movement.'
);
insert into public.faq_redaction_proposals (
  id, thread_id, program_id, proposed_by_profile_id, redacted_question, redacted_answer
) values
  (
    '00000000-0000-0000-0000-000000003101',
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'How should an easy run feel?',
    'Keep it conversational and reduce the pace if needed.'
  ),
  (
    '00000000-0000-0000-0000-000000003102',
    '00000000-0000-0000-0000-000000003003',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'How can I warm up?',
    'Start with five minutes of easy movement.'
  );
select pg_temp.expect_sqlstate(
  $sql$insert into public.faq_redaction_proposals (
    id, thread_id, program_id, proposed_by_profile_id, redacted_question, redacted_answer
  ) values (
    '00000000-0000-0000-0000-000000003103',
    '00000000-0000-0000-0000-000000003002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    'What should someone do about pain?', 'Ask a professional.'
  )$sql$,
  '23514', 'pain-origin private content cannot become an anonymous FAQ proposal'
);
update public.faq_redaction_proposals
set review_status = 'approved'
where id = '00000000-0000-0000-0000-000000003101';
commit;

select pg_temp.assert_true(
  (select routing_status = 'answered' from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003001'),
  'named coach answer routes the private question to answered'
);
select pg_temp.assert_true(
  (select answer_body = 'Edited warmup answer: start with five minutes of easy movement.'
      and visibility = 'private' and status = 'active'
    from public.private_question_answers
    where id = '00000000-0000-0000-0000-000000003012'),
  'active named-coach author can edit an answer without widening visibility'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'coach_question_metadata_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_metadata_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select pg_temp.assert_true(
  (select active_answer_count = 1
    from public.read_named_coach_private_question_metadata(
      '00000000-0000-0000-0000-000000003001'
    )),
  'named coach reads content-free private-question metadata through its narrow projection'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.private_question.named_coach_metadata_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'coach_question_metadata_audit_before'),
  'named-coach metadata projection appends exactly one value-free audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'participant_question_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.participant_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) from public.read_participant_private_question(
    '00000000-0000-0000-0000-000000003001'
  )) = 2,
  'participant private-question projection returns question and active answer'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.private_question.participant_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'participant_question_audit_before'),
  'participant private-question projection appends exactly one audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'coach_question_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select pg_temp.assert_true(
  (select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000003001'
  )) = 2,
  'named coach private-question projection returns question and active answer'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.private_question.named_coach_read')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'coach_question_audit_before'),
  'named coach private-question projection appends exactly one audit event'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'failed_question_audit_before', count(*)
from public.audit_events
where event_type like 'sensitive.private_question.%';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_sqlstate(
  $sql$select public.edit_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012', 'Participant rewrite attempt'
  )$sql$,
  '42501', 'participant question owner cannot edit a named-coach answer'
);
select pg_temp.expect_sqlstate(
  $sql$select public.delete_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012'
  )$sql$,
  '42501', 'participant question owner cannot delete a named-coach answer'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'same-program peer cannot read another participant private question'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'same-program peer cannot read another participant metadata projection'
);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_threads$sql$,
  '42501', 'same-program peer has no direct private-question identifier privilege'
);
select pg_temp.expect_sqlstate(
  $sql$select question_body from public.private_question_threads$sql$,
  '42501', 'same-program peer has no direct private-question body privilege'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'other coach cannot read another named coach private question'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'other coach cannot read named-coach private-question metadata'
);
select pg_temp.expect_sqlstate(
  $sql$select public.edit_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012', 'Other coach rewrite attempt'
  )$sql$,
  '42501', 'other coach cannot edit the named author answer'
);
select pg_temp.expect_sqlstate(
  $sql$select public.delete_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012'
  )$sql$,
  '42501', 'other coach cannot delete the named author answer'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'admin is not an implicit private-question audience'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'admin is not an implicit private-question metadata audience'
);
select pg_temp.expect_sqlstate(
  $sql$select public.edit_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012', 'Admin rewrite attempt'
  )$sql$,
  '42501', 'admin cannot edit a named-coach answer'
);
select pg_temp.expect_sqlstate(
  $sql$select public.delete_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012'
  )$sql$,
  '42501', 'admin cannot delete a named-coach answer'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'stakeholder is not a private-question audience'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'stakeholder is not a private-question metadata audience'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'cross-program participant cannot read private-question metadata'
);
select pg_temp.expect_sqlstate(
  $sql$select public.edit_named_coach_private_answer(
    '00000000-0000-0000-0000-000000003012', 'Cross-program rewrite attempt'
  )$sql$,
  '42501', 'cross-program participant cannot edit a private answer'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'suspended participant cannot read another private question'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'suspended participant cannot read private-question metadata'
);
commit;

begin;
set local role anon;
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'anonymous has no private-question projection execute privilege'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_participant_private_question_metadata(
    '00000000-0000-0000-0000-000000003001'
  )$sql$,
  '42501', 'anonymous has no private-question metadata projection execute privilege'
);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_threads$sql$,
  '42501', 'anonymous has no private-question identifier privilege'
);
select pg_temp.expect_sqlstate(
  $sql$select question_body from public.private_question_threads$sql$,
  '42501', 'anonymous has no private-question body privilege'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type like 'sensitive.private_question.%')
  = (select number_value from pg_temp.privacy_test_state
    where key = 'failed_question_audit_before'),
  'failed private-question attempts append no audit event'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_sqlstate(
  $sql$insert into public.faq_participant_opt_ins (
    id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
  ) select
    '00000000-0000-0000-0000-000000003202', id, thread_id, program_id,
    '00000000-0000-0000-0000-000000000001', redacted_copy_sha256, now()
  from public.faq_redaction_proposals
  where id = '00000000-0000-0000-0000-000000003102'$sql$,
  '23514', 'participant cannot opt in to an unreviewed FAQ redaction'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.faq_participant_opt_ins (
    id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
  ) values (
    '00000000-0000-0000-0000-000000003203',
    '00000000-0000-0000-0000-000000003101',
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    repeat('0', 64), now()
  )$sql$,
  '23514', 'participant opt-in must bind the exact reviewed redacted bytes'
);
insert into public.faq_participant_opt_ins (
  id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
)
select
  '00000000-0000-0000-0000-000000003201', id, thread_id, program_id,
  '00000000-0000-0000-0000-000000000001', redacted_copy_sha256, now()
from public.faq_redaction_proposals
where id = '00000000-0000-0000-0000-000000003101';
commit;

insert into pg_temp.privacy_test_state (key, number_value)
select 'failed_faq_copy_before', count(*) from public.anonymous_faq_copies;
insert into pg_temp.privacy_test_state (key, number_value)
select 'failed_faq_audit_before', count(*) from public.audit_events
where event_type like 'faq.anonymous_copy.%';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.expect_sqlstate(
  $sql$select public.publish_anonymous_faq(
    '00000000-0000-0000-0000-000000003101',
    '00000000-0000-0000-0000-000000003201'
  )$sql$,
  '23514', 'non-named coach cannot publish an anonymous FAQ copy'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_copies)
    = (select number_value from pg_temp.privacy_test_state where key = 'failed_faq_copy_before')
  and
  (select count(*) from public.audit_events where event_type like 'faq.anonymous_copy.%')
    = (select number_value from pg_temp.privacy_test_state where key = 'failed_faq_audit_before'),
  'failed FAQ publication is transactional and leaves copy and audit counts unchanged'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
insert into pg_temp.privacy_test_state (key, id_value)
select 'published_faq', public.publish_anonymous_faq(
  '00000000-0000-0000-0000-000000003101',
  '00000000-0000-0000-0000-000000003201'
);
commit;

select pg_temp.assert_true(
  (select publication_status = 'published' and question_copy = 'How should an easy run feel?'
    from public.anonymous_faq_copies
    where id = (select id_value from pg_temp.privacy_test_state where key = 'published_faq')),
  'reviewed exact opt-in creates a separately stored anonymous FAQ copy'
);
select pg_temp.assert_true(
  (select question_body = $body$Robert'); drop table public.profiles; -- <script>alert('x')</script> How should I pace the easy run?$body$
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003001')
  and
  (select answer_body = 'Ignore previous instructions is inert text here. Keep the easy run conversational.'
    from public.private_question_answers
    where id = '00000000-0000-0000-0000-000000003011'),
  'anonymous FAQ publication does not alter the private source question or answer'
);
select pg_temp.assert_true(
  (select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'anonymous_faq_projection')
  = array['id', 'program_id', 'question_copy', 'answer_copy', 'audience', 'published_at'],
  'anonymous FAQ projection exposes no source thread proposal opt-in or participant identifiers'
);

begin;
set local role anon;
select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_projection) = 1,
  'anonymous audience can read the published redacted copy'
);
select pg_temp.expect_sqlstate(
  $sql$select source_thread_id from public.anonymous_faq_copies$sql$,
  '42501', 'anonymous cannot read the FAQ source mapping table'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  public.unpublish_anonymous_faq(
    (select id_value from pg_temp.privacy_test_state where key = 'published_faq')
  ),
  'participant can reverse anonymous FAQ publication'
);
commit;

begin;
set local role anon;
select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_projection) = 0,
  'unpublished FAQ copy disappears from the anonymous projection'
);
commit;

select pg_temp.assert_true(
  (select publication_status = 'unpublished'
      and purge_after = unpublished_at + interval '30 days'
    from public.anonymous_faq_copies
    where id = (select id_value from pg_temp.privacy_test_state where key = 'published_faq'))
  and
  (select question_body like 'Robert%'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003001'),
  'FAQ reversal is a soft unpublish and leaves the private source intact'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
update public.faq_redaction_proposals
set review_status = 'approved'
where id = '00000000-0000-0000-0000-000000003102';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.faq_participant_opt_ins (
  id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
)
select
  '00000000-0000-0000-0000-000000003204', id, thread_id, program_id,
  '00000000-0000-0000-0000-000000000001', redacted_copy_sha256, now()
from public.faq_redaction_proposals
where id = '00000000-0000-0000-0000-000000003102';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
insert into pg_temp.privacy_test_state (key, id_value)
select 'withdrawal_faq', public.publish_anonymous_faq(
  '00000000-0000-0000-0000-000000003102',
  '00000000-0000-0000-0000-000000003204'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_projection) = 1,
  'second reviewed exact opt-in is published before withdrawal test'
);
insert into pg_temp.privacy_test_state (key, number_value)
select 'opt_in_withdrawal_audit_before', count(*)
from public.audit_events
where event_type = 'faq.anonymous_copy.unpublished_by_opt_in_withdrawal';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
update public.faq_participant_opt_ins
set status = 'withdrawn', withdrawal_reason_code = 'participant_withdrew_opt_in'
where id = '00000000-0000-0000-0000-000000003204';
commit;

select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_projection) = 0
  and
  (select publication_status = 'unpublished'
      and purge_after = unpublished_at + interval '30 days'
    from public.anonymous_faq_copies
    where id = (select id_value from pg_temp.privacy_test_state where key = 'withdrawal_faq'))
  and
  (select status = 'withdrawn' and withdrawn_at is not null
    from public.faq_participant_opt_ins
    where id = '00000000-0000-0000-0000-000000003204'),
  'withdrawing FAQ opt-in atomically removes the anonymous projection and sets retention'
);
select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'faq.anonymous_copy.unpublished_by_opt_in_withdrawal')
  = (select number_value + 1 from pg_temp.privacy_test_state
    where key = 'opt_in_withdrawal_audit_before')
  and
  (select question_body = 'Can you explain an easy-run warmup?'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003003')
  and
  (select answer_body = 'Edited warmup answer: start with five minutes of easy movement.'
    from public.private_question_answers
    where id = '00000000-0000-0000-0000-000000003012'),
  'opt-in withdrawal audits once and preserves the private source question and answer'
);

insert into pg_temp.privacy_test_state (key, number_value)
select 'deleted_question_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.participant_read';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) from public.read_participant_private_question(
    '00000000-0000-0000-0000-000000003005'
  )) = 0,
  'deleted private question returns no body rows'
);
commit;

select pg_temp.assert_true(
  (select count(*) from public.audit_events
    where event_type = 'sensitive.private_question.participant_read')
  = (select number_value from pg_temp.privacy_test_state
    where key = 'deleted_question_audit_before'),
  'deleted private question returns before audit and creates no false read event'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select public.delete_named_coach_private_answer(
  '00000000-0000-0000-0000-000000003012'
);
commit;

select pg_temp.assert_true(
  (select status = 'deleted' and purge_after = deleted_at + interval '30 days'
    from public.private_question_answers
    where id = '00000000-0000-0000-0000-000000003012')
  and
  (select routing_status = 'unanswered'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000003003'),
  'named-coach answer soft delete gets retention deadline and refreshes routing'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_sqlstate(
  $sql$insert into public.consent_grants (
    id, program_id, participant_profile_id, purpose, provider, provider_project_id,
    endpoint, data_classes, stated_purpose, recipient, audience, control,
    processor_disclosure, zero_data_retention_control, granted_at, expires_at
  ) values (
    '00000000-0000-0000-0000-000000001098',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002', 'screenshot_ai', 'openai', null,
    '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '1 day'
  )$sql$,
  '23514', 'AI consent without an exact provider project fails closed'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.consent_grants (
    id, program_id, participant_profile_id, purpose, provider, provider_project_id,
    endpoint, data_classes, stated_purpose, recipient, audience, control,
    processor_disclosure, zero_data_retention_control, granted_at, expires_at
  ) values (
    '00000000-0000-0000-0000-000000001097',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002', 'screenshot_ai', 'openai', 'project-alias',
    'responses_api_image_input',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '1 day'
  )$sql$,
  '23514', 'retired screenshot endpoint alias fails exact Responses endpoint check'
);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, provider_project_id,
  endpoint, data_classes, stated_purpose, recipient, audience, control,
  processor_disclosure, zero_data_retention_control, granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000001101',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000002', 'screenshot_ai', 'openai', 'project-short',
  '/v1/responses',
  array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
  'screenshot_metric_draft_extraction', 'openai',
  'processor_for_participant_draft_only', 'per_request_participant_review',
  'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
  clock_timestamp() - interval '1 minute', clock_timestamp() + interval '1 second'
);
commit;

select pg_temp.assert_true(
  private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'screenshot_ai', 'openai', 'project-approved', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'exact screenshot AI provider project endpoint classes and ZDR authorize'
);
select pg_temp.assert_true(
  private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'generative_feedback_ai', 'openai', 'project-approved', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'approved_project_endpoint_zdr'
  ),
  'generative feedback is independently authorized by its exact AI grant'
);
select pg_temp.assert_true(
  not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'screenshot_ai', 'openai', 'wrong-project', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'wrong AI project cannot substitute for the approved project'
);
select pg_temp.assert_true(
  not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'aggregate_analysis_reporting', 'openai', 'project-approved', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'a non-AI purpose cannot substitute for screenshot AI consent'
);
select pg_sleep(1.2);
select pg_temp.assert_true(
  not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002',
    'screenshot_ai', 'openai', 'project-short', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'expired AI consent fails closed'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
update public.consent_grants
set status = 'withdrawn', withdrawn_at = now(),
  withdrawn_by_profile_id = '00000000-0000-0000-0000-000000000002',
  withdrawal_reason_code = 'participant_withdrawal'
where id = '00000000-0000-0000-0000-000000001101';
commit;

select pg_temp.assert_true(
  not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002',
    'screenshot_ai', 'openai', 'project-short', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'withdrawn AI consent fails closed'
);

insert into public.assignments (
  id, program_id, title, instructions, assignment_kind, published_at, created_by
) values
  ('00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-000000000101', 'Health check', 'Private health response', 'health', now(), '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000002102', '00000000-0000-0000-0000-000000000101', 'Reflection', 'Private reflection response', 'reflection', now(), '00000000-0000-0000-0000-000000000011');
insert into public.homework_submissions (
  id, assignment_id, program_id, participant_id, response_text, status, submitted_at
) values
  ('00000000-0000-0000-0000-000000002111', '00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Heart rate 199, private', 'submitted', now()),
  ('00000000-0000-0000-0000-000000002112', '00000000-0000-0000-0000-000000002102', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Private reflection', 'submitted', now());

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_posts (
    id, program_id, author_profile_id, body, visibility, content_origin
  ) values (
    '00000000-0000-0000-0000-000000004099',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002',
    'Peer post without explicit social consent', 'cohort', 'social'
  )$sql$,
  '42501', 'participant feed publication requires its own active social consent'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_posts (
    id, program_id, author_profile_id, body, visibility, content_origin
  ) values (
    '00000000-0000-0000-0000-000000004091',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Pain score 8', 'cohort', 'pain'
  )$sql$,
  '23514', 'explicit pain-origin body cannot be stored in feed'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_posts (
    id, program_id, author_profile_id, submission_id, body, visibility, content_origin
  ) values (
    '00000000-0000-0000-0000-000000004092',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000002111',
    'Linked health share', 'cohort', 'social'
  )$sql$,
  '23514', 'linked health submission is derived and rejected from feed'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_posts (
    id, program_id, author_profile_id, submission_id, body, visibility, content_origin
  ) values (
    '00000000-0000-0000-0000-000000004093',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000002112',
    'Linked reflection share', 'cohort', 'social'
  )$sql$,
  '23514', 'linked reflection submission is derived and rejected from feed'
);
insert into public.feed_posts (
  id, program_id, author_profile_id, body, visibility, content_origin
) values
  (
    '00000000-0000-0000-0000-000000004001',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    $body$Nice run'); select pg_sleep(9); -- <img src=x onerror=alert(1)>$body$,
    'cohort', 'social'
  ),
  (
    '00000000-0000-0000-0000-000000004002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Second low-information social post', 'cohort', 'social'
  );
insert into public.feed_comments (
  id, post_id, author_profile_id, body, content_origin
) values
  (
    '00000000-0000-0000-0000-000000004011',
    '00000000-0000-0000-0000-000000004001',
    '00000000-0000-0000-0000-000000000001',
    'Thanks; this remains inert stored text.', 'social'
  ),
  (
    '00000000-0000-0000-0000-000000004012',
    '00000000-0000-0000-0000-000000004002',
    '00000000-0000-0000-0000-000000000001',
    'Comment for moderation', 'social'
  );
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_comments (
    id, post_id, author_profile_id, body, content_origin
  ) values (
    '00000000-0000-0000-0000-000000004094',
    '00000000-0000-0000-0000-000000004001',
    '00000000-0000-0000-0000-000000000001',
    'Private pain comment', 'pain'
  )$sql$,
  '23514', 'sensitive feed comment origin is rejected'
);
insert into public.feed_reactions (post_id, author_profile_id, reaction)
values (
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000000001', 'heart'
);
insert into public.feed_share_events (
  post_id, actor_profile_id, share_method, audience_preview
) values (
  '00000000-0000-0000-0000-000000004001',
  '00000000-0000-0000-0000-000000000001', 'clipboard', 'program_cohort'
);
update public.feed_posts
set body = 'Edited low-information social update'
where id = '00000000-0000-0000-0000-000000004001';
update public.feed_comments
set body = 'Edited low-information comment'
where id = '00000000-0000-0000-0000-000000004011';
select pg_temp.assert_true(
  (select edited_at is not null and content_sensitivity = 'nonsensitive'
    from public.feed_posts where id = '00000000-0000-0000-0000-000000004001')
  and
  (select edited_at is not null and content_sensitivity = 'nonsensitive'
    from public.feed_comments where id = '00000000-0000-0000-0000-000000004011'),
  'feed author edits retain database-derived nonsensitive classification'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
with changed as (
  update public.feed_posts
  set body = 'Peer rewrite attempt'
  where id = '00000000-0000-0000-0000-000000004001'
  returning id
)
select pg_temp.assert_true(count(*) = 0, 'peer cannot edit another participant feed post')
from changed;
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_reactions (post_id, author_profile_id, reaction)
    values (
      '00000000-0000-0000-0000-000000004001',
      '00000000-0000-0000-0000-000000000002', 'heart'
    )$sql$,
  '42501', 'participant feed interaction also requires active social consent'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000004001',
      '00000000-0000-0000-0000-000000004002'
    )) = 0,
  'cross-program participant sees no feed rows'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000004001',
      '00000000-0000-0000-0000-000000004002'
    )) = 0,
  'stakeholder is not a social feed audience'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
update public.feed_comments
set moderation_state = 'hidden', moderation_reason_code = 'privacy_review'
where id = '00000000-0000-0000-0000-000000004012';
select pg_temp.expect_sqlstate(
  $sql$update public.feed_comments
    set delete_state = 'purged', purged_at = now()
    where id = '00000000-0000-0000-0000-000000004012'$sql$,
  '42501', 'staff cannot forge a purged comment while retaining its original body'
);
update public.feed_posts
set moderation_state = 'hidden', moderation_reason_code = 'privacy_review'
where id = '00000000-0000-0000-0000-000000004002';
select pg_temp.expect_sqlstate(
  $sql$update public.feed_posts
    set delete_state = 'purged', purged_at = now()
    where id = '00000000-0000-0000-0000-000000004002'$sql$,
  '42501', 'staff cannot forge a purged post while retaining its original body'
);
select pg_temp.assert_true(
  (select moderated_by_profile_id = '00000000-0000-0000-0000-000000000011'
      and moderated_at is not null
      and body = 'Second low-information social post'
    from public.feed_posts where id = '00000000-0000-0000-0000-000000004002'),
  'named staff moderation records actor time state and reason without rewriting body'
);
select pg_temp.assert_true(
  (select delete_state = 'active' and body = 'Second low-information social post'
    from public.feed_posts where id = '00000000-0000-0000-0000-000000004002')
  and
  (select delete_state = 'active' and body = 'Comment for moderation'
    from public.feed_comments where id = '00000000-0000-0000-0000-000000004012'),
  'failed staff purge forgery leaves post and comment lifecycle and bodies unchanged'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
update public.feed_comments
set delete_state = 'soft_deleted'
where id = '00000000-0000-0000-0000-000000004011';
update public.feed_posts
set delete_state = 'soft_deleted'
where id = '00000000-0000-0000-0000-000000004001';
select pg_temp.expect_sqlstate(
  $sql$update public.feed_posts
    set delete_state = 'purged'
    where id = '00000000-0000-0000-0000-000000004001'$sql$,
  '23514', 'feed author cannot purge before the 30-day deadline'
);
commit;

select pg_temp.assert_true(
  (select delete_state = 'soft_deleted' and purge_after = deleted_at + interval '30 days'
    from public.feed_posts where id = '00000000-0000-0000-0000-000000004001')
  and
  (select delete_state = 'soft_deleted' and purge_after = deleted_at + interval '30 days'
    from public.feed_comments where id = '00000000-0000-0000-0000-000000004011'),
  'feed post and comment soft deletes receive fixed 30-day purge deadlines'
);

set session_replication_role = replica;
update public.feed_comments
set deleted_at = current_timestamp - interval '31 days',
  purge_after = current_timestamp - interval '1 day'
where id = '00000000-0000-0000-0000-000000004011';
update public.feed_posts
set deleted_at = current_timestamp - interval '31 days',
  purge_after = current_timestamp - interval '1 day'
where id = '00000000-0000-0000-0000-000000004001';
set session_replication_role = origin;

update public.feed_comments
set delete_state = 'purged'
where id = '00000000-0000-0000-0000-000000004011';
update public.feed_posts
set delete_state = 'purged'
where id = '00000000-0000-0000-0000-000000004001';

select pg_temp.assert_true(
  (select delete_state = 'purged' and body = '[purged]'
      and purged_at >= purge_after
    from public.feed_posts where id = '00000000-0000-0000-0000-000000004001')
  and
  (select delete_state = 'purged' and body = '[purged]'
      and purged_at >= purge_after
    from public.feed_comments where id = '00000000-0000-0000-0000-000000004011'),
  'due database-job purge replaces post and comment bodies with fixed placeholders'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select pg_temp.assert_true(
  (select body = '[purged]' from public.feed_posts
    where id = '00000000-0000-0000-0000-000000004001')
  and
  (select body = '[purged]' from public.feed_comments
    where id = '00000000-0000-0000-0000-000000004011'),
  'staff RLS can observe only placeholders after legitimate purge'
);
commit;

select pg_temp.assert_true(
  (select reaction = 'heart' from public.feed_reactions
    where post_id = '00000000-0000-0000-0000-000000004001'
      and author_profile_id = '00000000-0000-0000-0000-000000000001'),
  'feed reactions retain the heart-only contract'
);
select pg_temp.assert_true(
  (select count(*) = 0 from information_schema.columns
    where table_schema = 'public' and table_name = 'feed_share_events'
      and column_name in ('body', 'content', 'payload', 'text')),
  'feed share events store metadata only and duplicate no approved body'
);

insert into public.notification_records (
  id, recipient_profile_id, program_id, category, title, body,
  contains_sensitive_data, entity_type, entity_id
) values (
  '00000000-0000-0000-0000-000000004101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'feedback', 'Heart rate 199 and pain score 8',
  'Secret private feedback body: Robert pace 04:30', false,
  'private_question_thread', '00000000-0000-0000-0000-000000003001'
);

select pg_temp.assert_true(
  (select title = 'Coach feedback available'
      and body = 'Open PLUS Run to view this update.'
      and template_key = 'feedback_available'
      and audience = 'participant'
      and preview_kind = 'metadata_only'
      and content_sensitivity = 'metadata_only'
      and contains_sensitive_data = false
    from public.notification_records
    where id = '00000000-0000-0000-0000-000000004101'),
  'notification trigger replaces caller text with generic metadata-only copy'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
insert into public.faq_redaction_proposals (
  id, thread_id, program_id, proposed_by_profile_id, redacted_question, redacted_answer
) values (
  '00000000-0000-0000-0000-000000003104',
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000011',
  'How should a conversational run feel?',
  'Keep the effort easy enough to speak in sentences.'
);
update public.faq_redaction_proposals
set review_status = 'approved'
where id = '00000000-0000-0000-0000-000000003104';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.faq_participant_opt_ins (
  id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
)
select
  '00000000-0000-0000-0000-000000003205', id, thread_id, program_id,
  '00000000-0000-0000-0000-000000000001', redacted_copy_sha256, now()
from public.faq_redaction_proposals
where id = '00000000-0000-0000-0000-000000003104';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
insert into pg_temp.privacy_test_state (key, id_value)
select 'rotated_coach_faq', public.publish_anonymous_faq(
  '00000000-0000-0000-0000-000000003104',
  '00000000-0000-0000-0000-000000003205'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
update public.named_coach_grants
set status = 'withdrawn', withdrawn_at = now(),
  withdrawn_by_profile_id = '00000000-0000-0000-0000-000000000001',
  withdrawal_reason_code = 'participant_replaced_grant'
where id = '00000000-0000-0000-0000-000000001011';
update public.consent_grants
set status = 'withdrawn', withdrawn_at = now(),
  withdrawn_by_profile_id = '00000000-0000-0000-0000-000000000001',
  withdrawal_reason_code = 'participant_replaced_grant'
where id = '00000000-0000-0000-0000-000000001002';
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, endpoint, data_classes,
  stated_purpose, recipient, recipient_profile_id, audience, control,
  granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000001012',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'named_coach_sensitive_metrics', 'plus_run_first_party',
  'audited_sensitive_metric_projection',
  array['activity_metrics', 'health_metrics', 'pain_metrics'],
  'named_coach_sensitive_metrics', 'named_coach',
  '00000000-0000-0000-0000-000000000012',
  'participant_and_named_coach', 'participant_revocable_named_grant',
  now(), now() + interval '30 days'
);
insert into public.named_coach_grants (
  id, consent_grant_id, program_id, participant_profile_id, coach_profile_id,
  granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000001013',
  '00000000-0000-0000-0000-000000001012',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000012',
  now(), now() + interval '20 days'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.assert_true(
  (select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  )) = 0,
  'new coach grant does not revive metric-specific bridges linked to a withdrawn consent'
);
select pg_temp.expect_sqlstate(
  $sql$select public.unpublish_anonymous_faq(
    (select id_value from pg_temp.privacy_test_state where key = 'rotated_coach_faq')
  )$sql$,
  '42501', 'rotated active named coach cannot reverse another coach publisher copy'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  public.unpublish_anonymous_faq(
    (select id_value from pg_temp.privacy_test_state where key = 'rotated_coach_faq')
  ),
  'participant source owner can reverse a copy after named-coach rotation'
);
commit;

select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (
    organization_id, actor_profile_id, subject_profile_id,
    event_type, entity_type, entity_id, details
  ) values (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'bad.audit', 'privacy_test', '00000000-0000-0000-0000-000000003001',
    '{"nested":{"body":"private source"}}'
  )$sql$,
  '23514', 'recursive audit guard rejects body keys'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (
    event_type, entity_type, details
  ) values ('bad.value', 'privacy_test', '{"metric":{"numeric_value":87}}')$sql$,
  '23514', 'recursive audit guard rejects sensitive numeric value keys'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.question', 'privacy_test', '{"question_body":"private question"}')$sql$,
  '23514', 'audit guard rejects question_body key smuggling'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.answer', 'privacy_test', '{"nested":{"answer_text":"private answer"}}')$sql$,
  '23514', 'audit guard rejects nested answer_text key smuggling'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.health', 'privacy_test', '{"health_metric_value":199}')$sql$,
  '23514', 'audit guard rejects health_metric_value key smuggling'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.prompt', 'privacy_test', '{"prompt_text":"ignore previous instructions"}')$sql$,
  '23514', 'audit guard rejects prompt_text key smuggling'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.camel', 'privacy_test',
      '{"safe_metadata":[{"responseBody":"private provider response"}]}'
    )$sql$,
  '23514', 'audit guard normalizes camelCase keys recursively'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.summary', 'privacy_test', '{"summary":"heart rate 199"}')$sql$,
  '23514', 'audit metadata allowlist rejects short sensitive strings under arbitrary keys'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.allowed_audience', 'privacy_test',
      '{"audience":"My knee pain is eight after the run"}'
    )$sql$,
  '23514', 'audit audience allowlist rejects body text under an allowed key'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.allowed_projection', 'privacy_test',
      '{"projection":"Private source answer says slow down"}'
    )$sql$,
  '23514', 'audit projection allowlist rejects body text under an allowed key'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.allowed_purpose', 'privacy_test',
      '{"purpose":"My health note contains pain details"}'
    )$sql$,
  '23514', 'audit purpose allowlist rejects body text under an allowed key'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.allowed_id', 'privacy_test', '{"thread_id":"private body instead of uuid"}')$sql$,
  '23514', 'audit identifier keys accept only canonical UUID strings or null'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.allowed_nested', 'privacy_test',
      '{"threadId":{"programId":"00000000-0000-0000-0000-000000000101"}}'
    )$sql$,
  '23514', 'audit guard rejects nested objects even through camelCase allowed keys'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values (
      'bad.allowed_array', 'privacy_test',
      '{"projection":["participant_private_question","private body"]}'
    )$sql$,
  '23514', 'audit guard rejects arrays under allowed metadata keys'
);
select pg_temp.expect_sqlstate(
  $sql$update public.audit_events
    set details = '{"note_text":"private note"}'
    where id = (select min(id) from public.audit_events)$sql$,
  '23514', 'audit guard rejects content-key smuggling on update as well as insert'
);
select pg_temp.expect_sqlstate(
  $sql$update public.audit_events
    set details = '{"audience":"My knee pain is eight after the run"}'
    where id = (select min(id) from public.audit_events)$sql$,
  '23514', 'audit guard rejects allowed-key value smuggling on update'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('my knee pain is eight', 'privacy_test', '{}')$sql$,
  '23514', 'audit event_type rejects top-level body text'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.audit_events (event_type, entity_type, details)
    values ('bad.entity', 'private knee pain note', '{}')$sql$,
  '23514', 'audit entity_type rejects top-level body text'
);
select pg_temp.expect_sqlstate(
  $sql$update public.audit_events
    set event_type = 'my private health note'
    where id = (select min(id) from public.audit_events)$sql$,
  '23514', 'audit top-level metadata slug guard also applies on update'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.audit_events
    where not private.audit_details_are_content_free(details)
      or details::text like '%Heart rate 199%'
      or details::text like '%Robert%'
      or details::text like '%04:30%'
  ),
  'persisted audits contain identifiers and event metadata but no bodies or values'
);
select pg_temp.assert_true(
  to_regclass('public.profiles') is not null
  and (select count(*) from public.profiles) = 8,
  'hostile SQL HTML and prompt-like strings remain inert stored data'
);

select pg_temp.assert_true(
  (select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_grants')
  @> array[
    'id', 'program_id', 'participant_profile_id', 'purpose', 'granted_at',
    'expires_at', 'withdrawn_at', 'provider', 'provider_project_id', 'endpoint',
    'data_classes', 'zero_data_retention_control'
  ],
  'canonical consent_grants exposes the frozen Task 4 column contract'
);
select pg_temp.assert_true(
  (select data_type = 'uuid' from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_grants' and column_name = 'participant_profile_id')
  and
  (select data_type = 'text' and is_nullable = 'NO' from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_grants' and column_name = 'provider')
  and
  (select data_type = 'ARRAY' and udt_name = '_text' and is_nullable = 'NO'
    from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_grants' and column_name = 'data_classes'),
  'frozen Task 4 consent column types and nullability are exact'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.metric_records', 'SELECT')
  and not has_table_privilege('authenticated', 'public.homework_submissions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.feedback_items', 'SELECT')
  and not has_table_privilege('authenticated', 'public.private_question_threads', 'SELECT')
  and not has_table_privilege('authenticated', 'public.private_question_answers', 'SELECT')
  and not has_table_privilege('anon', 'public.private_question_threads', 'SELECT')
  and not has_table_privilege('anon', 'public.private_question_answers', 'SELECT')
  and not has_table_privilege('authenticated', 'public.private_question_threads', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.private_question_answers', 'UPDATE')
  and not has_column_privilege(
    'authenticated', 'public.private_question_threads', 'question_body', 'SELECT'
  )
  and not has_column_privilege(
    'authenticated', 'public.private_question_answers', 'answer_body', 'SELECT'
  ),
  'browser roles have no direct private-QA table SELECT or UPDATE bypass'
);
select pg_temp.assert_true(
  has_function_privilege(
    'authenticated', 'public.read_participant_private_question_metadata(uuid)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.read_named_coach_private_question_metadata(uuid)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.edit_named_coach_private_answer(uuid,text)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.delete_named_coach_private_answer(uuid)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.read_participant_private_question_metadata(uuid)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.read_named_coach_private_question_metadata(uuid)', 'EXECUTE'
  ),
  'authenticated uses narrow metadata and answer lifecycle RPCs while anon cannot execute them'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'private.has_active_ai_consent(uuid,uuid,text,text,text,text,text[],text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.has_active_ai_consent(uuid,uuid,text,text,text,text,text[],text)',
    'EXECUTE'
  ),
  'private exact AI-consent helper is not callable by browser roles'
);
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('ai_requests', 'feed_share_events')
      and column_name in ('prompt', 'response', 'payload', 'body', 'content')
  ),
  'AI request and share-event operational tables exclude prompt response payload and body columns'
);

select pg_temp.expect_sqlstate(
  $statement$
    insert into storage.objects (id, bucket_id, name, owner) values (
      '00000000-0000-0000-0000-000000004201', 'screenshots',
      '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000004201/private.png',
      '00000000-0000-0000-0000-000000000001'
    )
  $statement$,
  '42501',
  'raw screenshot Storage writes remain disabled after lifecycle automation'
);
select pg_temp.expect_sqlstate(
  $statement$
    insert into storage.objects (id, bucket_id, name, owner) values (
      '00000000-0000-0000-0000-000000004202', 'health-imports',
      '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000004202/private.fit',
      '00000000-0000-0000-0000-000000000001'
    )
  $statement$,
  '42501',
  'raw health-import Storage writes remain disabled after lifecycle automation'
);

select pg_temp.assert_true(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('screenshots_owner_select', 'health_imports_owner_select')
  ),
  'raw screenshot and health-import SELECT policies are removed'
);
select pg_temp.assert_true(
  (select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.consent_grants'::regclass,
      'public.named_coach_grants'::regclass,
      'public.private_question_threads'::regclass,
      'public.private_question_answers'::regclass,
      'public.faq_redaction_proposals'::regclass,
      'public.faq_participant_opt_ins'::regclass,
      'public.anonymous_faq_copies'::regclass,
      'public.feed_share_events'::regclass
    )),
  'all new privacy tables have row-level security enabled'
);

select 'PRIVACY_AUDIENCES_CONTRACT_PASS' as result;
