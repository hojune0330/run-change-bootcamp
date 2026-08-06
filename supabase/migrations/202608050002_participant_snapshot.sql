-- Participant pilot slice: one snapshot RPC per screen plus a consent toggle,
-- so every participant screen needs a single round trip with a full audit trail.
-- Writes stay on the narrow RLS-safe surface (homework_submissions,
-- feed_reactions, feed_comments, metric_records); consent toggling goes through
-- the existing metric_consents trigger audit (consent.granted / consent.revoked).

-- 1. Accept the manual sleep_hours row the participant "직접 입력" screen emits.
--    (The demo ManualMetricInput union includes sleep_hours; the DB did not.)
alter table public.metric_records
  drop constraint if exists metric_records_metric_type_check;
alter table public.metric_records
  add constraint metric_records_metric_type_check check (
    metric_type in (
      'distance_m', 'duration_s', 'pace_s_per_km', 'heart_rate_bpm',
      'weight_kg', 'body_fat_pct', 'pain_score', 'sleep_hours', 'other'
    )
  );
alter table public.metric_records
  drop constraint if exists metric_records_unit_check;
alter table public.metric_records
  add constraint metric_records_unit_check check (
    unit in ('m', 's', 's/km', 'bpm', 'kg', '%', 'score', 'h')
  );

-- 2. Today screen: profile, program, latest published assignment with the
--    caller's completion state, and the latest announcement (pinned first).
create or replace function public.participant_today_snapshot(
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
  date_label text;
begin
  if actor is null or not private.has_program_role(
    target_program, array['participant']
  ) then
    raise exception 'participant today projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_today.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  date_label := concat(
    to_char(now() at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"'),
    case extract(isodow from now())
      when 1 then ' 월요일'
      when 2 then ' 화요일'
      when 3 then ' 수요일'
      when 4 then ' 목요일'
      when 5 then ' 금요일'
      when 6 then ' 토요일'
      else ' 일요일'
    end
  );

  return (
    select jsonb_build_object(
      'date_label', date_label,
      'profile', (
        select jsonb_build_object(
          'profile_id', profile.id,
          'display_name', profile.display_name
        )
        from public.profiles profile
        where profile.id = actor
      ),
      'program', (
        select jsonb_build_object('title', program.title)
        from public.programs program
        where program.id = target_program
      ),
      'assignment', (
        select jsonb_build_object(
          'assignment_id', assignment.id,
          'title', assignment.title,
          'instructions', assignment.instructions,
          'assignment_kind', assignment.assignment_kind,
          'due_at', assignment.due_at,
          'completed', exists (
            select 1
            from public.homework_submissions submission
            where submission.assignment_id = assignment.id
              and submission.participant_id = actor
              and submission.status in ('submitted', 'reviewed')
          )
        )
        from public.assignments assignment
        where assignment.program_id = target_program
          and assignment.published_at is not null
        order by assignment.published_at desc, assignment.id
        limit 1
      ),
      'announcement', (
        select jsonb_build_object(
          'announcement_id', announcement.id,
          'title', announcement.title,
          'body', announcement.body,
          'published_at', announcement.published_at,
          'pinned', announcement.pinned
        )
        from public.announcements announcement
        where announcement.program_id = target_program
          and announcement.published_at is not null
        order by announcement.pinned desc, announcement.published_at desc, announcement.id
        limit 1
      )
    )
  );
end;
$$;

-- 3. Feed screen: cohort-visible posts with heart counts, the caller's own
--    reaction state, and non-deleted comments.
create or replace function public.participant_feed_snapshot(
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
    raise exception 'participant feed projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_feed.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  return (
    select jsonb_build_object(
      'posts', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'post_id', post.id,
            'author_profile_id', post.author_profile_id,
            'author_name', author.display_name,
            'body', post.body,
            'created_at', post.created_at,
            'heart_count', (
              select count(*)
              from public.feed_reactions reaction
              where reaction.post_id = post.id
            ),
            'is_hearted', exists (
              select 1
              from public.feed_reactions reaction
              where reaction.post_id = post.id
                and reaction.author_profile_id = actor
            ),
            'comments', coalesce((
              select jsonb_agg(comment_jsonb)
              from (
                select jsonb_build_object(
                  'comment_id', comment.id,
                  'author_name', comment_author.display_name,
                  'body', comment.body,
                  'created_at', comment.created_at
                ) comment_jsonb
                from public.feed_comments comment
                join public.profiles comment_author
                  on comment_author.id = comment.author_profile_id
                where comment.post_id = post.id
                  and comment.deleted_at is null
                order by comment.created_at asc, comment.id
              ) comment_rows
            ), '[]'::jsonb)
          ) row_jsonb
          from public.feed_posts post
          join public.profiles author on author.id = post.author_profile_id
          where post.program_id = target_program
            and post.visibility = 'cohort'
            and post.deleted_at is null
          order by post.created_at desc, post.id desc
        ) post_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- 4. "내 변화" screen: the caller's own latest accepted metric per type with
--    14-day trend counts, published feedback, resting-heart-rate consent state
--    and the consent audit trail.
create or replace function public.participant_change_snapshot(
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
    raise exception 'participant change projection forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_change.read', 'program', target_program,
    jsonb_build_object('program_id', target_program)
  );

  return (
    select jsonb_build_object(
      'profile', (
        select jsonb_build_object(
          'profile_id', profile.id,
          'display_name', profile.display_name
        )
        from public.profiles profile
        where profile.id = actor
      ),
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
            and submission.participant_id = actor
            and submission.status in ('submitted', 'reviewed')
        ) submission on true
        where assignment.program_id = target_program
          and assignment.published_at is not null
      ),
      'metrics', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select distinct on (metric.metric_type)
            jsonb_build_object(
              'metric_type', metric.metric_type,
              'value', metric.numeric_value,
              'unit', metric.unit,
              'observed_at', metric.observed_at,
              'count_14d', (
                select count(*)
                from public.metric_records window_metric
                where window_metric.program_id = target_program
                  and window_metric.owner_profile_id = actor
                  and window_metric.metric_type = metric.metric_type
                  and window_metric.verification_status = 'accepted'
                  and window_metric.observed_at >= now() - interval '14 days'
              )
            ) row_jsonb
          from public.metric_records metric
          where metric.program_id = target_program
            and metric.owner_profile_id = actor
            and metric.verification_status = 'accepted'
          order by metric.metric_type, metric.observed_at desc, metric.created_at desc
        ) metric_rows
      ), '[]'::jsonb),
      'feedback', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'feedback_id', feedback.id,
            'origin', feedback.origin,
            'classification', feedback.classification,
            'body', feedback.body,
            'published_at', feedback.published_at
          ) row_jsonb
          from public.feedback_items feedback
          where feedback.program_id = target_program
            and feedback.participant_id = actor
            and feedback.status = 'published'
          order by feedback.published_at desc, feedback.id
          limit 20
        ) feedback_rows
      ), '[]'::jsonb),
      'heart_rate_consented', exists (
        select 1
        from public.metric_consents consent
        join public.metric_records metric on metric.id = consent.metric_record_id
        where metric.program_id = target_program
          and metric.owner_profile_id = actor
          and metric.metric_type = 'heart_rate_bpm'
          and consent.revoked_at is null
          and consent.expires_at > now()
      ),
      'consent_history', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'audit_event_id', audit.id,
            'event_type', audit.event_type,
            'occurred_at', audit.occurred_at
          ) row_jsonb
          from public.audit_events audit
          where audit.subject_profile_id = actor
            and audit.event_type in ('consent.granted', 'consent.revoked')
          order by audit.occurred_at desc, audit.id desc
          limit 10
        ) audit_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- 5. Resting-heart-rate consent toggle. The participant shares their latest
--    accepted heart-rate record with every active coach in the program
--    (the existing trigger audits each grant/revocation).
create or replace function public.participant_set_metric_consent(
  target_program uuid,
  target_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_record uuid;
  target_organization uuid;
  audit_id bigint;
  audit_event text;
begin
  if actor is null or not private.has_program_role(
    target_program, array['participant']
  ) then
    raise exception 'participant consent toggle forbidden'
      using errcode = '42501';
  end if;

  select metric.id into target_record
  from public.metric_records metric
  where metric.program_id = target_program
    and metric.owner_profile_id = actor
    and metric.metric_type = 'heart_rate_bpm'
    and metric.verification_status = 'accepted'
  order by metric.observed_at desc nulls last, metric.created_at desc
  limit 1;

  if target_record is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  if target_enabled then
    insert into public.metric_consents (
      metric_record_id, owner_profile_id, grantee_profile_id, grantee_role,
      purpose, expires_at
    )
    select target_record, actor, member.profile_id, 'coach',
           '파일럿 심박수 코치 공유',
           now() + interval '180 days'
    from public.program_memberships member
    join public.organization_memberships organization_member
      on organization_member.organization_id = target_organization
      and organization_member.profile_id = member.profile_id
      and organization_member.role = 'coach'
      and organization_member.status = 'active'
      and organization_member.starts_at <= now()
      and (organization_member.ends_at is null or organization_member.ends_at > now())
    where member.program_id = target_program
      and member.role = 'coach'
      and member.status = 'active'
      and member.joined_at <= now()
      and (member.ended_at is null or member.ended_at > now())
    on conflict (metric_record_id, grantee_profile_id)
      where revoked_at is null
    do nothing;
  else
    update public.metric_consents consent
    set revoked_at = now(),
        revocation_reason = '파일럿 토글 해제'
    from public.metric_records metric
    where metric.id = consent.metric_record_id
      and metric.program_id = target_program
      and metric.owner_profile_id = actor
      and metric.metric_type = 'heart_rate_bpm'
      and consent.revoked_at is null;
  end if;

  select audit.id, audit.event_type
    into audit_id, audit_event
  from public.audit_events audit
  where audit.actor_profile_id = actor
    and audit.event_type = case when target_enabled then 'consent.granted' else 'consent.revoked' end
  order by audit.occurred_at desc, audit.id desc
  limit 1;

  return jsonb_build_object(
    'status', case when target_enabled then 'enabled' else 'disabled' end,
    'audit_event_id', audit_id,
    'audit_event_type', audit_event
  );
end;
$$;

revoke all on function public.participant_today_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_today_snapshot(uuid)
  to authenticated;

revoke all on function public.participant_feed_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_feed_snapshot(uuid)
  to authenticated;

revoke all on function public.participant_change_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_change_snapshot(uuid)
  to authenticated;

revoke all on function public.participant_set_metric_consent(uuid, boolean)
  from public, anon;
grant execute on function public.participant_set_metric_consent(uuid, boolean)
  to authenticated;

comment on function public.participant_today_snapshot(uuid) is
  'Participant-owned today projection. Only published assignments/announcements are visible; homework completion state is the caller own row.';
comment on function public.participant_feed_snapshot(uuid) is
  'Participant-owned feed projection limited to cohort-visible posts in the caller program.';
comment on function public.participant_change_snapshot(uuid) is
  'Participant-owned change projection. Health values are the caller own accepted records only; consent state and audit trail are scoped to the caller.';
comment on function public.participant_set_metric_consent(uuid, boolean) is
  'Participant-owned resting-heart-rate consent toggle. Grants/revokes consent for every active coach in the program; returns unavailable when the caller has no accepted heart-rate record.';
