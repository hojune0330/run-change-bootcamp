-- Admin activity-log projection for the pilot frontend.
-- One security-definer RPC returns the full staff activity stream
-- (feedback approvals/rejections) with the actor role resolved from the
-- active membership, so the admin activity-log screen needs a single
-- round trip. Admin-only: coaches see the coach projection instead.
-- Consent events are participant-side and publish/time-trial writes do not
-- yet emit audit events, so this slice stays limited to feedback events.

create or replace function public.admin_activity_snapshot(
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
    raise exception 'admin activity projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_activity.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  return coalesce((
    select jsonb_agg(row_jsonb)
    from (
      select jsonb_build_object(
        'audit_event_id', audit.id,
        'event_type', audit.event_type,
        'actor_role', coalesce(
          (
            select member.role
            from public.program_memberships member
            where member.program_id = target_program
              and member.profile_id = audit.actor_profile_id
              and member.status = 'active'
            limit 1
          ),
          'admin'
        ),
        'summary', coalesce(nullif(audit.details ->> 'summary', ''), audit.event_type),
        'occurred_at', audit.occurred_at
      ) row_jsonb
      from public.audit_events audit
      where audit.organization_id = target_organization
        and audit.event_type in ('feedback.approved', 'feedback.rejected')
      order by audit.occurred_at desc, audit.id desc
      limit 100
    ) activity_rows
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_activity_snapshot(uuid) from public, anon;
grant execute on function public.admin_activity_snapshot(uuid) to authenticated;

comment on function public.admin_activity_snapshot(uuid) is
  'Admin-only staff activity stream for the pilot admin activity-log screen.';
