-- Admin program schedule projection for the pilot frontend.
-- A dedicated security-definer RPC returns the program header and the full
-- session schedule (session number, kind, title, scheduled time) so the
-- /admin/schedule screen needs a single round trip. Admin-only: coaches see
-- the coach projection instead.

create or replace function public.admin_schedule_snapshot(
  target_program uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  if not private.has_program_role(target_program, array['admin']) then
    raise exception 'admin schedule projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_schedule.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  return (
    select jsonb_build_object(
      'program', (
        select jsonb_build_object(
          'title', program.title,
          'starts_on', program.starts_on,
          'ends_on', program.ends_on,
          'status', program.status
        )
        from public.programs program
        where program.id = target_program
      ),
      'summary', (
        select jsonb_build_object(
          'total_sessions', count(*),
          'upcoming_count', count(*) filter (where session.scheduled_at > now()),
          'past_count', count(*) filter (
            where session.scheduled_at <= now()
          ),
          'time_trial', (
            select case
              when decision.program_id is null then null
              else jsonb_build_object(
                'initial_session_number', decision.initial_session_number,
                'protocol', decision.protocol,
                'decided_at', decision.decided_at
              )
            end
            from public.time_trial_decisions decision
            where decision.program_id = target_program
          )
        )
        from public.program_sessions session
        where session.program_id = target_program
      ),
      'sessions', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'session_id', session.id,
            'session_number', session.session_number,
            'session_kind', session.session_kind,
            'title', session.title,
            'scheduled_at', session.scheduled_at
          ) row_jsonb
          from public.program_sessions session
          where session.program_id = target_program
          order by session.session_number
        ) session_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_schedule_snapshot(uuid) from public, anon;
grant execute on function public.admin_schedule_snapshot(uuid) to authenticated;

comment on function public.admin_schedule_snapshot(uuid) is
  'Admin-only schedule projection for the pilot admin schedule screen.';
