-- Admin overview projection for the pilot frontend.
-- One security-definer RPC returns program state, KPI numbers, member
-- roster and recent staff activity so the admin screen needs a single
-- round trip. Admin-only: coaches see the coach projection instead.

create or replace function public.admin_overview_snapshot(
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
    raise exception 'admin overview projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_overview.read', 'program', target_program,
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
          'total_participants', count(*) filter (where member.role = 'participant'),
          'consented_count', (
            select count(distinct metric.owner_profile_id)
            from public.metric_records metric
            join public.metric_consents consent on consent.metric_record_id = metric.id
            where metric.program_id = target_program
              and metric.metric_type = 'heart_rate_bpm'
              and consent.revoked_at is null
              and consent.expires_at > now()
          ),
          'assignments_count', (
            select count(*)
            from public.assignments assignment
            where assignment.program_id = target_program
              and assignment.published_at is not null
          ),
          'pending_feedback_count', (
            select count(*)
            from public.feedback_items feedback
            where feedback.program_id = target_program
              and feedback.status = 'pending_approval'
          ),
          'pain_risk_count', (
            select count(*)
            from public.feedback_items feedback
            where feedback.program_id = target_program
              and feedback.status = 'published'
              and feedback.classification in ('pain', 'risk')
          )
        )
        from public.program_memberships member
        where member.program_id = target_program
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
      'members', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'profile_id', member.profile_id,
            'display_name', profile.display_name,
            'role', member.role,
            'status', member.status,
            'joined_at', member.joined_at,
            'completion_percent', (
              select case
                when count(*) = 0 then 0
                else round(100.0 * count(*) filter (where submission.id is not null) / count(*))::int
              end
              from public.assignments assignment
              left join lateral (
                select 1
                from public.homework_submissions submission
                where submission.assignment_id = assignment.id
                  and submission.participant_id = member.profile_id
                  and submission.status in ('submitted', 'reviewed')
              ) submission on true
              where assignment.program_id = target_program
                and assignment.published_at is not null
            ),
            'heart_rate_shared', exists (
              select 1
              from public.metric_records metric
              join public.metric_consents consent on consent.metric_record_id = metric.id
              where metric.program_id = target_program
                and metric.owner_profile_id = member.profile_id
                and metric.metric_type = 'heart_rate_bpm'
                and consent.revoked_at is null
                and consent.expires_at > now()
            )
          ) row_jsonb
          from public.program_memberships member
          join public.profiles profile on profile.id = member.profile_id
          where member.program_id = target_program
          order by member.role, profile.display_name, member.joined_at
        ) member_rows
      ), '[]'::jsonb),
      'activity', coalesce((
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
          limit 30
        ) activity_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_overview_snapshot(uuid) from public, anon;
grant execute on function public.admin_overview_snapshot(uuid) to authenticated;

comment on function public.admin_overview_snapshot(uuid) is
  'Admin-only projection for the pilot admin overview screen.';
