-- Admin settings projection for the pilot frontend.
-- A dedicated security-definer RPC returns the program configuration, the
-- time-trial plan, the account deletion queue and notification delivery
-- health so the /admin/settings screen needs a single round trip.
-- Admin-only: coaches see the coach projection instead.

create or replace function public.admin_settings_snapshot(
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
    raise exception 'admin settings projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_settings.read', 'program', target_program,
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
      ),
      'summary', (
        select jsonb_build_object(
          'deletion_request_count', (
            select count(*)
            from public.account_deletion_requests request
            join public.program_memberships member on member.profile_id = request.profile_id
            where member.program_id = target_program
              and request.status in ('requested', 'processing')
          ),
          'failed_notification_count', (
            select count(*)
            from public.notification_outbox outbox
            join public.notification_records record on record.id = outbox.notification_id
            where record.program_id = target_program
              and outbox.status in ('pending', 'failed')
          )
        )
      ),
      'deletion_requests', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'deletion_request_id', request.id,
            'profile_id', request.profile_id,
            'display_name', profile.display_name,
            'status', request.status,
            'requested_at', request.requested_at
          ) row_jsonb
          from public.account_deletion_requests request
          join public.program_memberships member on member.profile_id = request.profile_id
          join public.profiles profile on profile.id = request.profile_id
          where member.program_id = target_program
            and request.status in ('requested', 'processing')
          order by request.requested_at desc, request.id desc
        ) deletion_rows
      ), '[]'::jsonb),
      'failed_notifications', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'outbox_id', outbox.id,
            'notification_id', record.id,
            'channel', outbox.channel,
            'title', record.title,
            'status', outbox.status,
            'last_error_code', outbox.last_error_code,
            'attempt_count', outbox.attempt_count,
            'created_at', outbox.created_at
          ) row_jsonb
          from public.notification_outbox outbox
          join public.notification_records record on record.id = outbox.notification_id
          where record.program_id = target_program
            and outbox.status in ('pending', 'failed')
          order by outbox.created_at desc, outbox.id desc
          limit 20
        ) outbox_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_settings_snapshot(uuid) from public, anon;
grant execute on function public.admin_settings_snapshot(uuid) to authenticated;

comment on function public.admin_settings_snapshot(uuid) is
  'Admin-only settings projection for the pilot admin settings screen.';
