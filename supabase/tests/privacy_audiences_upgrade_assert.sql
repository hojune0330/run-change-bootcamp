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

select pg_temp.assert_true(
  (select numeric_value = 91 and sensitivity = 'health'
    from public.metric_records
    where id = '00000000-0000-0000-0000-000000009401')
  and
  (select response_text = 'Legacy private health response 91'
    from public.homework_submissions
    where id = '00000000-0000-0000-0000-000000009311')
  and
  (select body = 'Legacy private feedback body'
    from public.feedback_items
    where id = '00000000-0000-0000-0000-000000009601'),
  'upgrade preserves existing metric submission and feedback bodies'
);

select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(consent_grant_id is null and named_coach_grant_id is null)
    from public.metric_consents
    where id in (
      '00000000-0000-0000-0000-000000009411',
      '00000000-0000-0000-0000-000000009412'
    )),
  'legacy metric consent rows are preserved as nullable non-authorizing bridges'
);

select pg_temp.assert_true(
  (select body = 'Legacy low-information social row'
      and audience_preview = 'program_cohort'
      and publication_source = 'explicit_user'
      and content_origin = 'social'
      and content_sensitivity = 'nonsensitive'
      and moderation_state = 'visible'
      and delete_state = 'active'
    from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501'),
  'legacy feed row is preserved and receives privacy-safe derived defaults'
);

select pg_temp.assert_true(
  (select count(*) = 2
      and bool_and(content_origin = 'health')
      and bool_and(content_sensitivity = 'sensitive')
      and bool_and(publication_source = 'explicit_user')
      and bool_and(body = '[quarantined sensitive source]')
    from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    ))
  and
  (select count(*) = 2 and bool_and(content_origin = 'social')
      and bool_and(body = '[quarantined sensitive source]')
    from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )),
  'upgrade quarantines legacy submission-linked health duplicate bodies and preserves metadata rows'
);

select pg_temp.assert_true(
  (select title = 'Coach feedback available'
      and body = 'Open PLUS Run to view this update.'
      and template_key = 'feedback_available'
      and preview_kind = 'metadata_only'
      and content_sensitivity = 'metadata_only'
    from public.notification_records
    where id = '00000000-0000-0000-0000-000000009701'),
  'legacy notification is upgraded in place to generic metadata-only copy'
);

select pg_temp.assert_true(
  to_regclass('public.consent_grants') is not null
  and to_regclass('public.named_coach_grants') is not null
  and to_regclass('public.private_question_threads') is not null
  and to_regclass('public.private_question_answers') is not null
  and to_regclass('public.anonymous_faq_copies') is not null
  and to_regclass('public.feed_share_events') is not null,
  'privacy audience tables exist after upgrade'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.private_question_threads', 'SELECT')
  and not has_table_privilege('authenticated', 'public.private_question_answers', 'SELECT')
  and not has_table_privilege('anon', 'public.private_question_threads', 'SELECT')
  and not has_table_privilege('anon', 'public.private_question_answers', 'SELECT')
  and has_function_privilege(
    'authenticated', 'public.read_participant_private_question_metadata(uuid)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.read_named_coach_private_question_metadata(uuid)', 'EXECUTE'
  ),
  'upgrade revokes direct private-QA SELECT and exposes only narrow metadata projections'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009002', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1,
  'legacy peer retains normal cohort feed visibility after upgrade'
);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0
  and
  (select count(*) from public.feed_reactions
    where post_id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0,
  'legacy peer cannot see quarantined post comment or reaction rows'
);
commit;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009011', false);
select pg_temp.assert_true(
  not private.can_read_metric('00000000-0000-0000-0000-000000009401'),
  'legacy coach consent without canonical bridge cannot authorize a metric read'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009021', false);
select pg_temp.assert_true(
  not private.can_read_metric('00000000-0000-0000-0000-000000009401'),
  'legacy admin consent cannot substitute for named-coach canonical consent'
);
select set_config('request.jwt.claim.sub', '', false);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009011', true);
select pg_temp.expect_sqlstate(
  $sql$select numeric_value from public.metric_records$sql$,
  '42501', 'legacy coach loses direct metric-value SELECT after upgrade'
);
select pg_temp.expect_sqlstate(
  $sql$select count(*) from public.read_named_coach_sensitive_metrics(
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001'
  )$sql$,
  '42501', 'legacy coach row alone cannot enter named-coach projection'
);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0,
  'legacy coach sees normal feed metadata but no quarantined bodies'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_share_events (
    post_id, actor_profile_id, share_method, audience_preview
  ) values (
    '00000000-0000-0000-0000-000000009503',
    '00000000-0000-0000-0000-000000009011',
    'clipboard', 'program_cohort'
  )$sql$,
  '42501', 'staff cannot share a quarantined sensitive legacy post'
);
select public.moderate_feed_comment(
  '00000000-0000-0000-0000-000000009513', 'removed', 'legacy_sensitive_quarantine'
);
select public.moderate_feed_post(
  '00000000-0000-0000-0000-000000009503', 'removed', 'legacy_sensitive_quarantine'
);
commit;

select pg_temp.assert_true(
  (select moderation_state = 'removed' and delete_state = 'soft_deleted'
      and purge_after = deleted_at + interval '30 days'
    from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009503')
  and
  (select moderation_state = 'removed' and delete_state = 'soft_deleted'
      and purge_after = deleted_at + interval '30 days'
    from public.feed_comments
    where id = '00000000-0000-0000-0000-000000009513'),
  'body-free moderation RPCs remove quarantined post and comment with retention deadlines'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009021', true);
select pg_temp.expect_sqlstate(
  $sql$select numeric_value from public.metric_records$sql$,
  '42501', 'legacy admin loses direct metric-value SELECT after upgrade'
);
select pg_temp.expect_sqlstate(
  $sql$select response_text from public.homework_submissions$sql$,
  '42501', 'legacy admin loses direct homework-body SELECT after upgrade'
);
select pg_temp.expect_sqlstate(
  $sql$select body from public.feedback_items$sql$,
  '42501', 'legacy admin loses direct feedback-body SELECT after upgrade'
);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0,
  'legacy admin sees normal feed row but no quarantined post or comment bodies'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009001', true);
select pg_temp.expect_sqlstate(
  $sql$select numeric_value from public.metric_records$sql$,
  '42501', 'legacy participant also uses audited metric projection after upgrade'
);
select pg_temp.assert_true(
  (select count(*) from public.read_participant_sensitive_metrics(
    '00000000-0000-0000-0000-000000009200'
  )) = 1,
  'legacy participant can read preserved own metric through audited projection'
);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(body) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(body) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0
  and
  (select count(*) from public.feed_reactions
    where post_id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0,
  'legacy owner sees normal feed but no quarantined body comment or reaction observable'
);
with changed as (
  update public.feed_posts
  set body = 'Attempted legacy sensitive republication'
  where id = '00000000-0000-0000-0000-000000009502'
  returning id
)
select pg_temp.assert_true(count(*) = 0,
  'quarantined legacy post is outside owner direct-update visibility')
from changed;
with changed as (
  update public.feed_comments
  set body = 'Attempted sensitive comment rewrite'
  where id = '00000000-0000-0000-0000-000000009512'
  returning id
)
select pg_temp.assert_true(count(*) = 0,
  'comment beneath quarantined legacy post is outside owner direct-update visibility')
from changed;
select pg_temp.expect_sqlstate(
  $sql$insert into public.consent_grants (
    id, program_id, participant_profile_id, purpose, provider, provider_project_id,
    endpoint, data_classes, stated_purpose, recipient, audience, control,
    processor_disclosure, zero_data_retention_control, granted_at, expires_at
  ) values (
    '00000000-0000-0000-0000-000000009899',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'screenshot_ai', 'openai', 'project-upgrade', 'responses_api_image_input',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  )$sql$,
  '23514', 'upgrade path rejects the retired screenshot endpoint alias'
);
insert into public.consent_grants (
  id, program_id, participant_profile_id, purpose, provider, provider_project_id,
  endpoint, data_classes, stated_purpose, recipient, audience, control,
  processor_disclosure, zero_data_retention_control, granted_at, expires_at
) values
  (
    '00000000-0000-0000-0000-000000009801',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'screenshot_ai', 'openai', 'project-upgrade', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'screenshot_metric_draft_extraction', 'openai',
    'processor_for_participant_draft_only', 'per_request_participant_review',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000009802',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'generative_feedback_ai', 'openai', 'project-upgrade', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'generative_feedback_draft_creation', 'openai',
    'processor_and_named_coach_review', 'named_coach_review_required',
    'openai_subprocessor_disclosed', 'approved_project_endpoint_zdr',
    now() - interval '1 minute', now() + interval '30 days'
  );
select public.soft_delete_feed_comment(
  '00000000-0000-0000-0000-000000009512'
);
select public.soft_delete_feed_post(
  '00000000-0000-0000-0000-000000009502'
);
select pg_temp.expect_sqlstate(
  $sql$select public.soft_delete_feed_post(
    '00000000-0000-0000-0000-000000009502'
  )$sql$,
  '23514', 'owner cannot repeat or reverse quarantined post soft deletion'
);
select pg_temp.expect_sqlstate(
  $sql$select public.soft_delete_feed_comment(
    '00000000-0000-0000-0000-000000009512'
  )$sql$,
  '23514', 'owner cannot repeat or reverse quarantined comment soft deletion'
);
select pg_temp.expect_sqlstate(
  $sql$insert into public.feed_posts (
    id, program_id, author_profile_id, body, visibility, content_origin
  ) values (
    '00000000-0000-0000-0000-000000009599',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'New post without canonical social consent', 'cohort', 'social'
  )$sql$,
  '42501', 'new feed writes fail closed until canonical social consent exists'
);
update public.metric_consents
set revoked_at = now(), revocation_reason = 'participant_revoked_legacy_access'
where id = '00000000-0000-0000-0000-000000009411';
commit;

select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(endpoint = '/v1/responses')
      and bool_and(zero_data_retention_control = 'approved_project_endpoint_zdr')
    from public.consent_grants
    where id in (
      '00000000-0000-0000-0000-000000009801',
      '00000000-0000-0000-0000-000000009802'
    ))
  and private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'screenshot_ai', 'openai', 'project-upgrade', '/v1/responses',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  )
  and private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'generative_feedback_ai', 'openai', 'project-upgrade', '/v1/responses',
    array['approved_nonsensitive_training_context', 'feedback_draft'],
    'approved_project_endpoint_zdr'
  )
  and not private.has_active_ai_consent(
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    'screenshot_ai', 'openai', 'project-upgrade', 'responses_api_image_input',
    array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft'],
    'approved_project_endpoint_zdr'
  ),
  'both AI purposes bind exact Responses endpoint and retired alias cannot authorize'
);
select pg_temp.assert_true(
  (select delete_state = 'soft_deleted' and purge_after = deleted_at + interval '30 days'
    from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009502')
  and
  (select delete_state = 'soft_deleted' and purge_after = deleted_at + interval '30 days'
    from public.feed_comments
    where id = '00000000-0000-0000-0000-000000009512'),
  'legacy owner can soft-delete quarantined rows but cannot reverse retention lifecycle'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009002', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0,
  'peer still has no quarantined body visibility after owner and staff removal'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009011', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0,
  'coach moderation remains body-free after quarantined removal'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009021', true);
select pg_temp.assert_true(
  (select count(*) from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009501') = 1
  and
  (select count(*) from public.feed_posts
    where id in (
      '00000000-0000-0000-0000-000000009502',
      '00000000-0000-0000-0000-000000009503'
    )) = 0
  and
  (select count(*) from public.feed_comments
    where id in (
      '00000000-0000-0000-0000-000000009512',
      '00000000-0000-0000-0000-000000009513'
    )) = 0,
  'admin moderation remains body-free after quarantined removal'
);
commit;

set session_replication_role = replica;
update public.feed_comments
set deleted_at = statement_timestamp() - interval '31 days',
  purge_after = statement_timestamp() - interval '1 day'
where id = '00000000-0000-0000-0000-000000009513';
update public.feed_posts
set deleted_at = statement_timestamp() - interval '31 days',
  purge_after = statement_timestamp() - interval '1 day'
where id = '00000000-0000-0000-0000-000000009503';
set session_replication_role = origin;
update public.feed_comments
set delete_state = 'purged'
where id = '00000000-0000-0000-0000-000000009513';
update public.feed_posts
set delete_state = 'purged'
where id = '00000000-0000-0000-0000-000000009503';

select pg_temp.assert_true(
  (select body = '[purged]' and delete_state = 'purged'
      and purged_at >= purge_after and moderation_state = 'removed'
    from public.feed_posts
    where id = '00000000-0000-0000-0000-000000009503')
  and
  (select body = '[purged]' and delete_state = 'purged'
      and purged_at >= purge_after and moderation_state = 'removed'
    from public.feed_comments
    where id = '00000000-0000-0000-0000-000000009513'),
  'due scheduler purge replaces quarantined post and comment bodies with placeholders'
);

select pg_temp.assert_true(
  (select revoked_at is not null and consent_grant_id is null and named_coach_grant_id is null
    from public.metric_consents
    where id = '00000000-0000-0000-0000-000000009411'),
  'legacy consent remains participant-revocable without becoming authorizing'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_events
    where event_type = 'sensitive.metric_projection.participant_read'
      and entity_id = '00000000-0000-0000-0000-000000009200'),
  'legacy participant projection writes exactly one content-free audit event'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.audit_events
    where not private.audit_details_are_content_free(details)
      or details::text like '%91%'
      or details::text like '%Legacy private%'
  ),
  'upgrade audit history remains body- and value-free'
);

select 'PRIVACY_AUDIENCES_UPGRADE_PASS' as result;
