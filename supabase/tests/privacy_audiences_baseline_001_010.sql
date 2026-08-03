\set ON_ERROR_STOP on

begin;

create function pg_temp.privacy_baseline_assert(assertion boolean, message text)
returns void language plpgsql set search_path = '' as $$
begin
  if not coalesce(assertion, false) then
    raise exception 'privacy baseline assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.privacy_baseline_assert(
  to_regclass('public.consent_grants') is null,
  '001-010 unexpectedly contain the six-purpose consent contract'
);
select pg_temp.privacy_baseline_assert(
  to_regclass('public.private_question_threads') is null,
  '001-010 unexpectedly contain private Q&A'
);
select pg_temp.privacy_baseline_assert(
  has_table_privilege('authenticated', 'public.metric_records', 'select'),
  'legacy authenticated direct metric SELECT grant is missing'
);
select pg_temp.privacy_baseline_assert(
  has_table_privilege('authenticated', 'public.homework_submissions', 'select'),
  'legacy authenticated direct submission SELECT grant is missing'
);

insert into auth.users (id, raw_user_meta_data) values
  ('31000000-0000-4000-8000-000000000001', '{"display_name":"Baseline participant"}'::jsonb),
  ('31000000-0000-4000-8000-000000000002', '{"display_name":"Baseline admin"}'::jsonb);

insert into public.organizations (id, name)
values ('31000000-0000-4000-8000-000000000003', 'Privacy baseline organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000003',
    '31000000-0000-4000-8000-000000000001', 'participant', 'active', '2000-01-01 00:00:00+00'),
  ('31000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000003',
    '31000000-0000-4000-8000-000000000002', 'admin', 'active', '2000-01-01 00:00:00+00');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '31000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000003',
  'Privacy baseline program', '2000-01-01', '2099-12-31', 'active',
  '31000000-0000-4000-8000-000000000002'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('31000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000006',
    '31000000-0000-4000-8000-000000000001', 'participant', 'active', '2000-01-01 00:00:00+00'),
  ('31000000-0000-4000-8000-000000000008', '31000000-0000-4000-8000-000000000006',
    '31000000-0000-4000-8000-000000000002', 'admin', 'active', '2000-01-01 00:00:00+00');

insert into public.metric_records (
  id, program_id, owner_profile_id, source, metric_type, numeric_value, unit,
  sensitivity, verification_status
) values (
  '31000000-0000-4000-8000-000000000009', '31000000-0000-4000-8000-000000000006',
  '31000000-0000-4000-8000-000000000001', 'manual', 'heart_rate_bpm', 87, 'bpm',
  'health', 'accepted'
);

insert into public.metric_consents (
  id, metric_record_id, owner_profile_id, grantee_profile_id, grantee_role,
  purpose, granted_at, expires_at
) values (
  '31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000009',
  '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
  'admin', 'legacy broad individual metric access', now(), '2099-01-01 00:00:00+00'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select pg_temp.privacy_baseline_assert(
  (select numeric_value = 87
   from public.metric_records
   where id = '31000000-0000-4000-8000-000000000009'),
  'legacy admin could not directly SELECT the synthetic health value'
);
reset role;

select pg_temp.privacy_baseline_assert(
  (select count(*) from public.audit_events
   where entity_id = '31000000-0000-4000-8000-000000000009'
     and event_type like 'sensitive.%read') = 0,
  'legacy direct metric SELECT unexpectedly emitted a sensitive-read audit event'
);

select
  'PRIVACY_BASELINE_001_010_PASS' as result,
  to_regclass('public.consent_grants') is null as six_purpose_consent_missing,
  to_regclass('public.private_question_threads') is null as private_qa_missing,
  has_table_privilege('authenticated', 'public.metric_records', 'select') as direct_metric_select_granted,
  87::numeric as synthetic_health_value_exposed_to_legacy_admin,
  0::bigint as sensitive_read_audit_delta;

rollback;
