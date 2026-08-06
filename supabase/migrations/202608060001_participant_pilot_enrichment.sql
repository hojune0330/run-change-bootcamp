-- Participant pilot enrichment (Phase 9):
--   * today snapshot: assignment backlog + active-day streak (KST)
--   * change snapshot: previous accepted value per metric type (delta basis),
--     so "내 변화" can show week-over-week movement
--   * import_activity_draft: persist a client-parsed activity file as
--     (data_uploads + draft metric_records) so "파일 가져오기" is no longer
--     a boundary stub; every row stays verification_status = 'draft' until
--     the participant reviews it.
--   * save_activity_draft: accept the draft rows for one upload.
-- Every function keeps the participant gate (42501), the audit call and
-- authenticated-only grants, matching the existing snapshot pattern.

-- 1. Today screen: add streak_days (consecutive KST days with any accepted
--    record or homework submission) and backlog (published assignments except
--    the latest, newest first) so a missed assignment stays visible.
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
  streak_days int := 0;
  today_kst date;
  loop_day date;
  activity_days date[] := '{}';
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

  -- Active days: any accepted record or submitted homework (KST calendar day).
  select array_agg(distinct day)
  into activity_days
  from (
    select (coalesce(record.observed_at, record.created_at) at time zone 'Asia/Seoul')::date as day
    from public.metric_records record
    where record.program_id = target_program
      and record.owner_profile_id = actor
      and record.verification_status = 'accepted'
    union all
    select (submission.submitted_at at time zone 'Asia/Seoul')::date as day
    from public.homework_submissions submission
    where submission.program_id = target_program
      and submission.participant_id = actor
      and submission.submitted_at is not null
      and submission.status in ('submitted', 'reviewed')
  ) activity;

  today_kst := (now() at time zone 'Asia/Seoul')::date;
  -- A streak is alive if the participant recorded today, or yesterday (they
  -- can still record today without breaking it).
  if activity_days @> array[today_kst] then
    loop_day := today_kst;
  else
    loop_day := today_kst - 1;
  end if;
  while activity_days @> array[loop_day] loop
    streak_days := streak_days + 1;
    loop_day := loop_day - 1;
  end loop;

  return (
    select jsonb_build_object(
      'date_label', date_label,
      'streak_days', streak_days,
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
      'backlog', coalesce((
        select jsonb_agg(row_jsonb)
        from (
          select jsonb_build_object(
            'assignment_id', assignment.id,
            'title', assignment.title,
            'assignment_kind', assignment.assignment_kind,
            'due_at', assignment.due_at,
            'completed', exists (
              select 1
              from public.homework_submissions submission
              where submission.assignment_id = assignment.id
                and submission.participant_id = actor
                and submission.status in ('submitted', 'reviewed')
            )
          ) row_jsonb
          from public.assignments assignment
          where assignment.program_id = target_program
            and assignment.published_at is not null
            and assignment.id <> (
              select latest.id
              from public.assignments latest
              where latest.program_id = target_program
                and latest.published_at is not null
              order by latest.published_at desc, latest.id
              limit 1
            )
          order by assignment.published_at desc, assignment.id
          limit 20
        ) backlog_rows
      ), '[]'::jsonb),
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

-- 2. "내 변화" screen: include the previous accepted value per metric type so
--    the client can render a week-over-week delta (previous_metric is the
--    latest accepted record strictly older than the current one).
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
              'previous_value', previous_metric.numeric_value,
              'previous_observed_at', previous_metric.observed_at,
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
          left join lateral (
            select previous.numeric_value, previous.observed_at
            from public.metric_records previous
            where previous.program_id = target_program
              and previous.owner_profile_id = actor
              and previous.metric_type = metric.metric_type
              and previous.verification_status = 'accepted'
              and previous.observed_at < metric.observed_at
            order by previous.observed_at desc, previous.created_at desc, previous.id desc
            limit 1
          ) previous_metric on metric.observed_at is not null
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

-- 3. File import: persist a client-parsed activity file. The client already
--    parsed the text (csv/gpx/tcx/xml/json) with the audited domain parsers;
--    this RPC stores the upload row and one draft metric record per row
--    (verification_status = 'draft'), scoped to the caller, and returns the
--    upload reference so the client can review then accept (save_activity_draft).
create or replace function public.import_activity_draft(
  target_program uuid,
  file_name text,
  upload_kind text,
  file_size bigint,
  draft_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
  target_upload uuid;
  inserted_count int := 0;
  row_item jsonb;
  row_metric_type text;
  row_unit text;
  row_value numeric;
  row_observed_at timestamptz;
  row_sensitivity text;
  default_upload_mime text;
begin
  if actor is null or not private.has_program_role(
    target_program, array['participant']
  ) then
    raise exception 'participant import forbidden'
      using errcode = '42501';
  end if;
  if upload_kind not in ('screenshot', 'fit', 'tcx', 'gpx', 'csv', 'xml', 'json') then
    raise exception 'unknown upload kind'
      using errcode = '22023';
  end if;
  if file_size < 1 or file_size > 15728640 then
    raise exception 'file size out of range'
      using errcode = '22023';
  end if;
  if jsonb_typeof(draft_records) <> 'array' then
    raise exception 'draft_records must be an array'
      using errcode = '22023';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  default_upload_mime := case upload_kind
    when 'csv' then 'text/csv'
    when 'fit' then 'application/octet-stream'
    when 'gpx' then 'application/gpx+xml'
    when 'tcx' then 'application/vnd.garmin.tcx+xml'
    when 'xml' then 'application/xml'
    when 'json' then 'application/json'
    else 'application/octet-stream'
  end;

  insert into public.data_uploads (
    program_id, owner_profile_id, upload_kind, bucket_id, object_path,
    byte_size, detected_mime_type, status
  )
  values (
    target_program, actor, upload_kind, 'health-imports',
    upload_kind || '/' || gen_random_uuid()::text || '/' ||
      replace(replace(file_name, '/', '_'), chr(92), '_'),
    file_size, default_upload_mime, 'uploaded'
  )
  returning id into target_upload;

  for row_item in select * from jsonb_array_elements(draft_records) loop
    row_metric_type := row_item ->> 'metric_type';
    row_unit := row_item ->> 'unit';
    row_value := (row_item ->> 'numeric_value')::numeric;
    row_observed_at := (row_item ->> 'observed_at')::timestamptz;

    if row_metric_type is null
      or row_metric_type not in (
        'distance_m', 'duration_s', 'pace_s_per_km', 'heart_rate_bpm',
        'weight_kg', 'body_fat_pct', 'pain_score', 'sleep_hours', 'other'
      ) then
      raise exception 'invalid draft metric type'
        using errcode = '22023';
    end if;
    if row_unit is null
      or row_unit not in ('m', 's', 's/km', 'bpm', 'kg', '%', 'score', 'h') then
      raise exception 'invalid draft unit'
        using errcode = '22023';
    end if;
    if row_value is null or row_value < 0 then
      raise exception 'invalid draft value'
        using errcode = '22023';
    end if;

    row_sensitivity := case
      when row_metric_type in ('heart_rate_bpm', 'sleep_hours') then 'health'
      else 'activity'
    end;

    insert into public.metric_records (
      program_id, owner_profile_id, upload_id, source, metric_type,
      numeric_value, unit, observed_at, sensitivity, verification_status
    )
    values (
      target_program, actor, target_upload, 'import', row_metric_type,
      row_value, row_unit, row_observed_at, row_sensitivity, 'draft'
    );
    inserted_count := inserted_count + 1;
  end loop;

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_record.import', 'program', target_program,
    jsonb_build_object(
      'program_id', target_program,
      'upload_id', target_upload,
      'upload_kind', upload_kind,
      'draft_count', inserted_count
    )
  );

  return jsonb_build_object(
    'upload_id', target_upload,
    'draft_count', inserted_count
  );
end;
$$;

-- 4. Draft accept: mark every draft record for one upload as accepted and the
--    upload as processed. Only the upload owner in the target program can do
--    this, and only while rows are still drafts.
create or replace function public.save_activity_draft(
  target_program uuid,
  target_upload_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
  accepted_count int := 0;
begin
  if actor is null or not private.has_program_role(
    target_program, array['participant']
  ) then
    raise exception 'participant draft accept forbidden'
      using errcode = '42501';
  end if;

  select program.organization_id into target_organization
  from public.programs program
  where program.id = target_program;

  update public.metric_records record
  set verification_status = 'accepted',
      updated_at = now()
  where record.program_id = target_program
    and record.owner_profile_id = actor
    and record.upload_id = target_upload_id
    and record.verification_status = 'draft';

  get diagnostics accepted_count = row_count;

  if accepted_count = 0 then
    raise exception 'no pending draft rows for upload'
      using errcode = '22023';
  end if;

  update public.data_uploads upload
  set status = 'processed'
  where upload.id = target_upload_id
    and upload.program_id = target_program
    and upload.owner_profile_id = actor
    and upload.status = 'uploaded';

  perform private.record_audit(
    target_organization, actor, actor,
    'dashboards.participant_record.draft_accept', 'program', target_program,
    jsonb_build_object(
      'program_id', target_program,
      'upload_id', target_upload_id,
      'accepted_count', accepted_count
    )
  );

  return jsonb_build_object(
    'status', 'accepted',
    'accepted_count', accepted_count
  );
end;
$$;

revoke all on function public.participant_today_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_today_snapshot(uuid)
  to authenticated;

revoke all on function public.participant_change_snapshot(uuid)
  from public, anon;
grant execute on function public.participant_change_snapshot(uuid)
  to authenticated;

revoke all on function public.import_activity_draft(uuid, text, text, bigint, jsonb)
  from public, anon;
grant execute on function public.import_activity_draft(uuid, text, text, bigint, jsonb)
  to authenticated;

revoke all on function public.save_activity_draft(uuid, uuid)
  from public, anon;
grant execute on function public.save_activity_draft(uuid, uuid)
  to authenticated;

comment on function public.participant_today_snapshot(uuid) is
  'Participant-owned today projection. Includes streak_days (consecutive KST days with accepted records or homework) and a backlog of past published assignments so a missed day stays visible.';
comment on function public.participant_change_snapshot(uuid) is
  'Participant-owned change projection. Each metric carries the previous accepted value so the client can show week-over-week deltas.';
comment on function public.import_activity_draft(uuid, text, text, bigint, jsonb) is
  'Participant-owned file import. Stores a health-imports upload plus draft metric rows (verification_status=draft) parsed by the audited client parsers; returns the upload reference for review.';
comment on function public.save_activity_draft(uuid, uuid) is
  'Participant-owned draft accept. Marks all draft rows of one upload as accepted and the upload as processed; errors when no pending drafts remain.';
