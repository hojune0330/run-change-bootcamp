\set ON_ERROR_STOP on
\pset pager off

create or replace function pg_temp.assert_true(actual boolean, label text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from true then
    raise exception 'MANUAL QA FAILED: %', label;
  end if;
  raise notice 'MANUAL QA PASS: %', label;
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
  if observed is null or observed <> expected then
    raise exception 'MANUAL QA FAILED: % (expected %, observed %)', label, expected, observed;
  end if;
  raise notice 'MANUAL QA PASS: % (SQLSTATE %)', label, observed;
end;
$$;

create temporary table manual_privacy_state (
  key text primary key,
  id_value uuid,
  number_value bigint
);
grant select, insert, update on pg_temp.manual_privacy_state to authenticated, anon;

\echo MANUAL_STEP=seed_named_participant_and_program
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000008001', '{"display_name":"Manual participant"}'),
  ('00000000-0000-0000-0000-000000008011', '{"display_name":"Manual named coach"}'),
  ('00000000-0000-0000-0000-000000008021', '{"display_name":"Manual admin"}');
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000008100', 'Manual privacy QA organization');
insert into public.organization_memberships (
  organization_id, profile_id, role, status, starts_at
) values
  ('00000000-0000-0000-0000-000000008100', '00000000-0000-0000-0000-000000008001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008100', '00000000-0000-0000-0000-000000008011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008100', '00000000-0000-0000-0000-000000008021', 'admin', 'active', now() - interval '1 day');
insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008100',
  'Manual privacy QA program', '2000-01-01', '2099-12-31', 'active',
  '00000000-0000-0000-0000-000000008021'
);
insert into public.program_memberships (
  program_id, profile_id, role, status, joined_at
) values
  ('00000000-0000-0000-0000-000000008200', '00000000-0000-0000-0000-000000008001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008200', '00000000-0000-0000-0000-000000008011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008200', '00000000-0000-0000-0000-000000008021', 'admin', 'active', now() - interval '1 day');

\echo MANUAL_STEP=participant_affirmatively_names_coach
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008001', true);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, endpoint, data_classes,
  stated_purpose, recipient, recipient_profile_id, audience, control,
  granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000008300',
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008001',
  'named_coach_sensitive_metrics', 'plus_run_first_party',
  'audited_sensitive_metric_projection',
  array['activity_metrics', 'health_metrics', 'pain_metrics'],
  'named_coach_sensitive_metrics', 'named_coach',
  '00000000-0000-0000-0000-000000008011',
  'participant_and_named_coach', 'participant_revocable_named_grant',
  now() - interval '1 minute', now() + interval '30 days'
);
insert into public.named_coach_grants (
  id, consent_grant_id, program_id, participant_profile_id, coach_profile_id,
  granted_at, expires_at
) values (
  '00000000-0000-0000-0000-000000008310',
  '00000000-0000-0000-0000-000000008300',
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008001',
  '00000000-0000-0000-0000-000000008011',
  now() - interval '30 seconds', now() + interval '20 days'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.consent_grants (
    id, program_id, participant_profile_id, purpose, provider, provider_project_id,
    endpoint, data_classes, stated_purpose, recipient, audience, control,
    processor_disclosure, zero_data_retention_control, granted_at, expires_at
  ) values (
    '00000000-0000-0000-0000-000000008399',
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'screenshot_ai', 'openai', 'project-manual', 'responses_api_image_input',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  )$sql$,
  '23514', 'retired AI endpoint alias is rejected'
);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, provider_project_id,
  endpoint, data_classes, stated_purpose, recipient, audience, control,
  processor_disclosure, zero_data_retention_control, granted_at, expires_at
) values
  (
    '00000000-0000-0000-0000-000000008301',
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'screenshot_ai', 'openai', 'project-manual', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000008302',
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'generative_feedback_ai', 'openai', 'project-manual', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'generative_feedback_draft_creation', 'openai',
    'processor_and_named_coach_review', 'named_coach_review_required',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  );
commit;

\echo MANUAL_STEP=verify_exact_ai_endpoint_binding
select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(endpoint = '/v1/responses')
    from public.consent_grants
    where id in (
      '00000000-0000-0000-0000-000000008301',
      '00000000-0000-0000-0000-000000008302'
    ))
  and private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'screenshot_ai', 'openai', 'project-manual', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  )
  and private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'generative_feedback_ai', 'openai', 'project-manual', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'approved_project_endpoint_zdr'
  )
  and not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000008200',
    '00000000-0000-0000-0000-000000008001',
    'screenshot_ai', 'openai', 'project-manual', 'responses_api_image_input',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'both AI purposes use exact Responses endpoint and old alias cannot authorize'
);

\echo MANUAL_STEP=participant_creates_private_question
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008001', true);
insert into public.private_question_threads (
  id, program_id, participant_profile_id, question_body, content_origin
) values (
  '00000000-0000-0000-0000-000000008400',
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008001',
  'Private source: how should an easy run feel?', 'training'
);
commit;

\echo MANUAL_STEP=named_coach_answers_reviews_redaction
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008011', true);
insert into public.private_question_answers (
  id, thread_id, program_id, author_profile_id, answer_body
) values (
  '00000000-0000-0000-0000-000000008410',
  '00000000-0000-0000-0000-000000008400',
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008011',
  'Private source answer: keep it conversational.'
);
insert into public.faq_redaction_proposals (
  id, thread_id, program_id, proposed_by_profile_id, redacted_question, redacted_answer
) values (
  '00000000-0000-0000-0000-000000008500',
  '00000000-0000-0000-0000-000000008400',
  '00000000-0000-0000-0000-000000008200',
  '00000000-0000-0000-0000-000000008011',
  'How should an easy run feel?', 'Keep the effort conversational.'
);
update public.faq_redaction_proposals
set review_status = 'approved'
where id = '00000000-0000-0000-0000-000000008500';
commit;

\echo MANUAL_STEP=participant_opts_in_to_exact_reviewed_copy
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008001', true);
insert into public.faq_participant_opt_ins (
  id, proposal_id, thread_id, program_id, participant_profile_id, copy_sha256, opted_in_at
)
select
  '00000000-0000-0000-0000-000000008510', id, thread_id, program_id,
  '00000000-0000-0000-0000-000000008001', redacted_copy_sha256, now()
from public.faq_redaction_proposals
where id = '00000000-0000-0000-0000-000000008500';
commit;

\echo MANUAL_STEP=named_coach_publishes_separate_anonymous_copy
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008011', true);
insert into pg_temp.manual_privacy_state (key, id_value)
select 'faq_id', public.publish_anonymous_faq(
  '00000000-0000-0000-0000-000000008500',
  '00000000-0000-0000-0000-000000008510'
);
commit;

\echo MANUAL_STEP=anonymous_reads_only_safe_projection
begin;
set local role anon;
select pg_temp.assert_true(
  (select count(*) = 1
      and min(question_copy) = 'How should an easy run feel?'
      and min(answer_copy) = 'Keep the effort conversational.'
    from public.anonymous_faq_projection),
  'anonymous projection contains only the reviewed copy'
);
commit;

select pg_temp.assert_true(
  (select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'anonymous_faq_projection')
  = array['id', 'program_id', 'question_copy', 'answer_copy', 'audience', 'published_at'],
  'anonymous projection contains no private source identifiers'
);

insert into pg_temp.manual_privacy_state (key, number_value)
select 'metadata_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_metadata_read';

\echo MANUAL_STEP=named_coach_reads_content_free_metadata_projection
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008011', true);
select pg_temp.expect_sqlstate(
  $sql$select id from public.private_question_threads$sql$,
  '42501', 'named coach has no direct private-thread identifier SELECT'
);
select pg_temp.expect_sqlstate(
  $sql$select answer_body from public.private_question_answers$sql$,
  '42501', 'named coach has no direct private-answer body SELECT'
);
select pg_temp.assert_true(
  (select active_answer_count = 1
    from public.read_named_coach_private_question_metadata(
      '00000000-0000-0000-0000-000000008400'
    )),
  'named coach metadata projection returns one answer count without bodies'
);
commit;

insert into pg_temp.manual_privacy_state (key, number_value)
select 'metadata_audit_after', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_metadata_read';
select pg_temp.assert_true(
  (select number_value from pg_temp.manual_privacy_state where key = 'metadata_audit_after')
  - (select number_value from pg_temp.manual_privacy_state where key = 'metadata_audit_before') = 1,
  'one allowed metadata read appends exactly one value-free audit event'
);

insert into pg_temp.manual_privacy_state (key, number_value)
select 'read_audit_before', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_read';

\echo MANUAL_STEP=named_coach_reads_private_thread_through_audited_projection
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008011', true);
select pg_temp.assert_true(
  (select count(*) from public.read_named_coach_private_question(
    '00000000-0000-0000-0000-000000008400'
  )) = 2,
  'named coach projection returns the private question and answer'
);
commit;

insert into pg_temp.manual_privacy_state (key, number_value)
select 'read_audit_after', count(*)
from public.audit_events
where event_type = 'sensitive.private_question.named_coach_read';
select pg_temp.assert_true(
  (select number_value from pg_temp.manual_privacy_state where key = 'read_audit_after')
  - (select number_value from pg_temp.manual_privacy_state where key = 'read_audit_before') = 1,
  'one allowed private read appends exactly one audit event'
);

\echo MANUAL_STEP=participant_reverses_anonymous_publication
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008001', true);
select pg_temp.assert_true(
  public.unpublish_anonymous_faq(
    (select id_value from pg_temp.manual_privacy_state where key = 'faq_id')
  ),
  'participant can unpublish the anonymous copy'
);
commit;

begin;
set local role anon;
select pg_temp.assert_true(
  (select count(*) from public.anonymous_faq_projection) = 0,
  'unpublished copy is no longer visible anonymously'
);
commit;

select pg_temp.assert_true(
  (select question_body = 'Private source: how should an easy run feel?'
    from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000008400')
  and
  (select answer_body = 'Private source answer: keep it conversational.'
    from public.private_question_answers
    where id = '00000000-0000-0000-0000-000000008410')
  and
  (select publication_status = 'unpublished'
      and purge_after = unpublished_at + interval '30 days'
    from public.anonymous_faq_copies
    where id = (select id_value from pg_temp.manual_privacy_state where key = 'faq_id')),
  'reversal preserves private source and applies anonymous-copy retention deadline'
);

select
  'MANUAL_PRIVATE_QA_PASS' as result,
  (
    (select number_value from pg_temp.manual_privacy_state where key = 'read_audit_after')
    - (select number_value from pg_temp.manual_privacy_state where key = 'read_audit_before')
  ) as exact_read_audit_delta,
  (select count(*) from public.anonymous_faq_projection) as anonymous_rows_after_unpublish,
  (select count(*) from public.private_question_threads
    where id = '00000000-0000-0000-0000-000000008400') as private_source_rows;
