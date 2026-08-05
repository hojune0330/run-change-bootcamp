-- Coach dashboard projection for the pilot frontend.
-- One security-definer RPC returns roster, summary, feedback queue and
-- time-trial state for a program, so the coach screen needs a single round trip.
-- Every non-owner health read stays consent-gated; this snapshot only exposes
-- activity-level aggregates plus staff-visible program data (matching the
-- existing direct-SELECT RLS surface for coaches).

create or replace function public.coach_dashboard_snapshot(
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
  participants_json jsonb;
  time_trial_json jsonb;
begin
  if not private.has_program_role(
    target_program, array['coach', 'admin']
  ) then
    raise exception 'coach dashboard projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, null,
    'dashboards.coach_snapshot.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  -- Active participants with staff-visible activity aggregates.
  participants_json := coalesce((
    select jsonb_agg(row_jsonb)
    from (
      select jsonb_build_object(
        'profile_id', member.profile_id,
        'display_name', profile.display_name,
        'email', invited.email,
        'membership_id', member.id,
        'joined_at', member.joined_at,
        'missing_homework_count', (
          select count(*)
          from public.assignments assignment
          where assignment.program_id = target_program
            and assignment.published_at is not null
            and not exists (
              select 1
              from public.homework_submissions submission
              where submission.assignment_id = assignment.id
                and submission.participant_id = member.profile_id
                and submission.status in ('submitted', 'reviewed')
            )
        ),
        'latest_metric_at', (
          select max(metric.observed_at)
          from public.metric_records metric
          where metric.program_id = target_program
            and metric.owner_profile_id = member.profile_id
            and metric.verification_status = 'accepted'
        ),
        'metric_count_14d', (
          select count(*)
          from public.metric_records metric
          where metric.program_id = target_program
            and metric.owner_profile_id = member.profile_id
            and metric.verification_status = 'accepted'
            and metric.observed_at >= now() - interval '14 days'
        ),
        'metric_count_prev_14d', (
          select count(*)
          from public.metric_records metric
          where metric.program_id = target_program
            and metric.owner_profile_id = member.profile_id
            and metric.verification_status = 'accepted'
            and metric.observed_at >= now() - interval '28 days'
            and metric.observed_at < now() - interval '14 days'
        ),
        'pending_feedback_count', (
          select count(*)
          from public.feedback_items feedback
          where feedback.program_id = target_program
            and feedback.participant_id = member.profile_id
            and feedback.status = 'pending_approval'
        ),
        'risk', coalesce((
          select flagged.classification
          from public.feedback_items flagged
          where flagged.program_id = target_program
            and flagged.participant_id = member.profile_id
            and flagged.status = 'pending_approval'
            and flagged.classification in ('pain', 'risk')
          order by case flagged.classification
            when 'risk' then 0 else 1 end
          limit 1
        ), 'none')
      ) row_jsonb
      from public.program_memberships member
      join public.profiles profile on profile.id = member.profile_id
      left join auth.users invited on invited.id = member.profile_id
      where member.program_id = target_program
        and member.role = 'participant'
        and member.status = 'active'
      order by profile.display_name, member.profile_id
    ) participant_rows
  ), '[]'::jsonb);

  time_trial_json := (
    select jsonb_build_object(
      'initial_session_number', decision.initial_session_number,
      'protocol', decision.protocol,
      'decided_at', decision.decided_at
    )
    from public.time_trial_decisions decision
    where decision.program_id = target_program
  );

  return (
    select jsonb_build_object(
      'program', (
        select jsonb_build_object(
          'title', program.title,
          'starts_on', program.starts_on,
          'ends_on', program.ends_on
        )
        from public.programs program
        where program.id = target_program
      ),
      'summary', (
        select jsonb_build_object(
          'total_participants', count(*),
          'missing_homework_count', coalesce(sum(participant.missing_homework_count), 0),
          'stale_data_count', count(*) filter (
            where participant.latest_metric_at is null
              or participant.latest_metric_at < now() - interval '7 days'
          ),
          'pain_risk_count', count(*) filter (
            where participant.risk in ('pain', 'risk')
          ),
          'pending_feedback_count', coalesce(sum(participant.pending_feedback_count), 0)
        )
        from jsonb_to_recordset(participants_json) as participant(
          missing_homework_count integer,
          latest_metric_at timestamptz,
          risk text,
          pending_feedback_count integer
        )
      ),
      'participants', participants_json,
      'feedback_queue', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'feedback_id', feedback.id,
            'participant_id', feedback.participant_id,
            'participant_name', profile.display_name,
            'classification', feedback.classification,
            'body', feedback.body,
            'created_at', feedback.created_at
          ) row_jsonb
          from public.feedback_items feedback
          join public.profiles profile on profile.id = feedback.participant_id
          where feedback.program_id = target_program
            and feedback.status = 'pending_approval'
          order by feedback.created_at asc, feedback.id
        ) queue_rows
      ), '[]'::jsonb),
      'time_trial', time_trial_json
    )
  );
end;
$$;

-- The demo NoticeDraft carries a pinned flag; the announcements table has no
-- column for it yet. Add it so pilot notices can persist the setting.
alter table public.announcements
  add column if not exists pinned boolean not null default false;

create or replace function public.coach_participant_detail_snapshot(
  target_program uuid,
  target_participant uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
  shared_metrics jsonb;
  consented_types text[];
begin
  if not private.has_program_role(
    target_program, array['coach', 'admin']
  ) then
    raise exception 'coach participant detail projection forbidden'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.program_memberships member
    where member.program_id = target_program
      and member.profile_id = target_participant
      and member.role = 'participant'
      and member.status = 'active'
  ) then
    raise exception 'target is not an active participant in the program'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, target_participant,
    'dashboards.coach_participant_detail.read', 'program', target_program,
    jsonb_build_object(
      'program_id', target_program,
      'participant_profile_id', target_participant
    )
  );

  -- Shared metrics: the latest value of each health metric with an active
  -- named consent to this coach, plus the latest activity metric per type
  -- (activity metrics are staff-readable without consent).
  shared_metrics := coalesce((
    select jsonb_agg(row_jsonb)
    from (
      select jsonb_build_object(
        'metric_type', metric.metric_type,
        'value', metric.numeric_value,
        'unit', metric.unit,
        'observed_at', metric.observed_at
      ) row_jsonb
      from (
        select distinct on (metric.metric_type)
          metric.metric_type, metric.numeric_value, metric.unit, metric.observed_at
        from public.metric_records metric
        where metric.program_id = target_program
          and metric.owner_profile_id = target_participant
          and metric.verification_status = 'accepted'
          and (
            metric.sensitivity = 'activity'
            or exists (
              select 1
              from public.metric_consents consent
              where consent.metric_record_id = metric.id
                and consent.owner_profile_id = target_participant
                and consent.grantee_profile_id = actor
                and consent.revoked_at is null
                and consent.expires_at > now()
            )
          )
        order by metric.metric_type, metric.observed_at desc
      ) metric
      order by metric.metric_type
    ) shared_rows
  ), '[]'::jsonb);

  select coalesce(array_agg(consented.metric_type), '{}')
    into consented_types
  from (
    select distinct metric.metric_type
    from public.metric_consents consent
    join public.metric_records metric on metric.id = consent.metric_record_id
    where consent.owner_profile_id = target_participant
      and consent.grantee_profile_id = actor
      and consent.revoked_at is null
      and consent.expires_at > now()
  ) consented;

  return (
    select jsonb_build_object(
      'profile', (
        select jsonb_build_object(
          'profile_id', profile.id,
          'display_name', profile.display_name,
          'email', invited.email
        )
        from public.profiles profile
        left join auth.users invited on invited.id = profile.id
        where profile.id = target_participant
      ),
      'shared_metrics', shared_metrics,
      -- Health metric types with no active consent are private; the frontend
      -- mirrors a prior revocation via the consent audit trail.
      'health_metric_types', '{heart_rate_bpm,weight_kg,body_fat_pct,pain_score,other}'::text[],
      'consented_metric_types', consented_types,
      'audit_events', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'event_type', audit.event_type,
            'entity_type', audit.entity_type,
            'entity_id', audit.entity_id,
            'occurred_at', audit.occurred_at,
            'details', audit.details
          ) row_jsonb
          from public.audit_events audit
          where audit.subject_profile_id = target_participant
            and audit.event_type in (
              'consent.granted', 'consent.revoked',
              'feedback.approved', 'feedback.rejected'
            )
          order by audit.occurred_at desc, audit.id desc
          limit 10
        ) audit_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.coach_participant_detail_snapshot(uuid, uuid)
  from public, anon;
grant execute on function public.coach_participant_detail_snapshot(uuid, uuid)
  to authenticated;

comment on function public.coach_dashboard_snapshot(uuid) is
  'Staff-only roster projection. Health values are never included: only accepted-metric timestamps and counts are exposed for freshness/trend badges.';
comment on function public.coach_participant_detail_snapshot(uuid, uuid) is
  'Participant detail projection. Health values are exposed only for metrics with an active named consent to the requesting coach; revoked/never-granted types are returned as identifiers only.';
