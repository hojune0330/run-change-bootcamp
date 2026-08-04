\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000001',
  '{"display_name":"Legacy Admin"}'::jsonb
);

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000002', 'Legacy Organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'admin', 'active', '2026-01-01 00:00:00+09'
);

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000002',
  'Legacy 3K Program', '2026-01-05', '2026-02-28', 'completed',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values (
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  'admin', 'active', '2026-01-01 00:00:00+09'
);

insert into public.program_sessions (
  id, program_id, session_number, scheduled_at, session_kind, title
) values (
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000004',
  1, '2026-01-05 09:00:00+09', 'time_trial', 'Legacy Baseline'
);

insert into public.time_trial_decisions (
  program_id, initial_session_number, protocol, decided_by, decided_at
) values (
  '00000000-0000-4000-8000-000000000004', 1, '3k',
  '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00+09'
);

select 'MEASUREMENT_UPGRADE_SEED_PASS' as result;
