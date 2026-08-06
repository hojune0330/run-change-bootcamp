-- Admin aggregate report projection for the pilot frontend.
-- One security-definer RPC returns the program header plus released/latest
-- measurement report snapshots with their suppression-aware aggregate cells,
-- so the /admin/reports screen needs a single round trip.
-- Admin-only: the stakeholder/aggregate-exporter read path stays on the
-- existing public.read_suppressed_report_snapshot(uuid) RPC.

create or replace function public.admin_report_snapshot(
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
    raise exception 'admin report projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_report.read', 'program', target_program,
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
          'report_count', count(*),
          'released_count', count(*) filter (where snapshot.status = 'released')
        )
        from public.measurement_report_snapshots snapshot
        where snapshot.program_id = target_program
      ),
      'snapshots', coalesce((
        select jsonb_agg(snapshot_jsonb)
        from (
          select jsonb_build_object(
            'snapshot_id', snapshot.id,
            'calculation_version', snapshot.calculation_version,
            'status', snapshot.status,
            'generated_at', snapshot.generated_at,
            'frozen_at', snapshot.frozen_at,
            'released_at', snapshot.released_at,
            'cells', coalesce((
              select jsonb_agg(cell_jsonb)
              from (
                select jsonb_build_object(
                  'row_key', cell.row_key,
                  'column_key', cell.column_key,
                  'participant_count', case
                    when cell.suppressed or cell.participant_count < 5 then null
                    else cell.participant_count
                  end,
                  'numeric_value', case
                    when cell.suppressed or cell.participant_count < 5 then null
                    else cell.numeric_value
                  end,
                  'suppressed', cell.suppressed or cell.participant_count < 5,
                  'suppression_reason', case
                    when cell.suppressed or cell.participant_count < 5
                      then coalesce(cell.suppression_reason, 'primary')
                    else null
                  end
                ) cell_jsonb
                from public.report_aggregate_cells cell
                where cell.snapshot_id = snapshot.id
                order by cell.row_key, cell.column_key
              ) cell_rows
            ), '[]'::jsonb)
          ) snapshot_jsonb
          from public.measurement_report_snapshots snapshot
          where snapshot.program_id = target_program
          order by snapshot.generated_at desc, snapshot.id desc
        ) snapshot_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_report_snapshot(uuid) from public, anon;
grant execute on function public.admin_report_snapshot(uuid) to authenticated;

comment on function public.admin_report_snapshot(uuid) is
  'Admin-only aggregate report projection for the pilot admin reports screen. Small cells (participant_count < 5) are suppressed before projection; the frontend never sees individual health rows.';
