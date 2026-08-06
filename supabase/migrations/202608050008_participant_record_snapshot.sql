-- Participant "기록" screen pilot slice: the screen mounts a write form the
-- participant fills in locally; the snapshot only carries the server-side
-- facts the form needs (today's date for the manual entry default and the
-- upload formats the demo file-import button accepts). Writes themselves stay
-- on the narrow RLS-safe surface (metric_records, data_uploads) until the
-- pilot file-import path is built.
create or replace function public.participant_record_snapshot(
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
  if actor is null or not private.has_program_role(
    target_program, array['participant']
  ) then
    raise exception 'participant record projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_record.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  return jsonb_build_object(
    'recorded_on', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD'),
    'supported_extensions', jsonb_build_array(
      'csv', 'fit', 'gpx', 'tcx', 'xml', 'json'
    )
  );
end;
$$;

revoke all on function public.participant_record_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_record_snapshot(uuid)
  to authenticated;

comment on function public.participant_record_snapshot(uuid) is
  'Participant-owned record projection exposing the server-side today date (Asia/Seoul) and the demo upload formats accepted by the file-import button.';
