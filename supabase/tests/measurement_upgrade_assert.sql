\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from public.programs program
    join public.program_memberships membership on membership.program_id = program.id
    join public.program_sessions session on session.program_id = program.id
    join public.time_trial_decisions decision on decision.program_id = program.id
    where program.id = '00000000-0000-4000-8000-000000000004'
      and program.title = 'Legacy 3K Program'
      and membership.id = '00000000-0000-4000-8000-000000000005'
      and membership.role = 'admin'
      and session.id = '00000000-0000-4000-8000-000000000006'
      and session.title = 'Legacy Baseline'
      and decision.protocol = '3k'
  ) then
    raise exception 'legacy rows changed or disappeared during measurement upgrade';
  end if;

  if not exists (
    select 1 from public.measurement_protocol_templates
    where code = 'plus_run_complete_2026'
      and version = 1
      and official_baseline_on = '2026-08-27'
      and official_retest_on = '2026-10-15'
  ) then
    raise exception 'Plus Run measurement protocol template missing after upgrade';
  end if;
end;
$$;

select
  'MEASUREMENT_UPGRADE_SQL_PASS' as result,
  (select count(*) from public.programs) as legacy_program_count,
  (select count(*) from public.measurement_protocol_templates) as template_count;
