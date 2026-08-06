-- Admin membership roster projection for the pilot frontend.
-- A dedicated security-definer RPC returns the program header, membership
-- statistics and the full roster (roles, membership status, joined date,
-- email, completion and heart-rate share) so the /admin/members screen needs
-- a single round trip. Admin-only: coaches see the coach projection instead.

create or replace function public.admin_members_snapshot(
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
    raise exception 'admin members projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.admin_members.read', 'program', target_program,
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
          'total_members', count(*),
          'active_participants', count(*) filter (
            where member.role = 'participant' and member.status = 'active'
          ),
          'active_coaches', count(*) filter (
            where member.role = 'coach' and member.status = 'active'
          ),
          'consented_count', (
            select count(distinct metric.owner_profile_id)
            from public.metric_records metric
            join public.metric_consents consent on consent.metric_record_id = metric.id
            where metric.program_id = target_program
              and metric.metric_type = 'heart_rate_bpm'
              and consent.revoked_at is null
              and consent.expires_at > now()
          )
        )
        from public.program_memberships member
        where member.program_id = target_program
      ),
      'members', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'membership_id', member.id,
            'profile_id', member.profile_id,
            'display_name', profile.display_name,
            'email', invited.email,
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
          left join auth.users invited on invited.id = member.profile_id
          where member.program_id = target_program
          order by member.role, profile.display_name, member.joined_at
        ) member_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_members_snapshot(uuid) from public, anon;
grant execute on function public.admin_members_snapshot(uuid) to authenticated;

comment on function public.admin_members_snapshot(uuid) is
  'Admin-only roster projection for the pilot admin members screen.';
