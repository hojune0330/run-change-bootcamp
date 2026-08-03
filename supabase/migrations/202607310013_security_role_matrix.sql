do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'plus_aggregate_exporter') then
    create role plus_aggregate_exporter nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'plus_service_worker') then
    create role plus_service_worker nologin noinherit nobypassrls;
  end if;
end;
$$;

create or replace function private.current_actor_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles profile
      join public.organization_memberships membership
        on membership.profile_id = profile.id
      where profile.id = (select auth.uid())
        and profile.lifecycle_status = 'active'
        and membership.status = 'active'
        and membership.starts_at <= now()
        and (membership.ends_at is null or membership.ends_at > now())
    );
$$;

create or replace function private.current_actor_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_actor_is_active()
    and exists (
      select 1
      from public.organization_memberships membership
      where membership.profile_id = (select auth.uid())
        and membership.role = any(allowed_roles)
        and membership.status = 'active'
        and membership.starts_at <= now()
        and (membership.ends_at is null or membership.ends_at > now())
    );
$$;

create or replace function private.has_org_role(
  target_organization uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_actor_is_active()
    and exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = target_organization
        and membership.profile_id = (select auth.uid())
        and membership.role = any(allowed_roles)
        and membership.status = 'active'
        and membership.starts_at <= now()
        and (membership.ends_at is null or membership.ends_at > now())
    );
$$;

create or replace function private.has_program_role(
  target_program uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(allowed_roles) allowed(role)
    where private.is_active_program_member(
      (select auth.uid()), target_program, allowed.role
    )
  );
$$;

create or replace function private.enrollment_profile(target_enrollment uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select enrollment.profile_id
  from public.program_enrollments enrollment
  where enrollment.id = target_enrollment;
$$;

create or replace function private.can_access_sensitive_enrollment(
  target_program uuid,
  target_enrollment uuid,
  target_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.program_enrollments enrollment
    where enrollment.id = target_enrollment
      and enrollment.program_id = target_program
      and (
        (
          enrollment.profile_id = target_actor
          and private.is_active_program_member(
            target_actor, target_program, 'participant'
          )
        )
        or private.is_active_named_coach(
          target_program, enrollment.profile_id, target_actor
        )
      )
  );
$$;

create or replace function private.can_access_sensitive_attempt(
  target_attempt uuid,
  target_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_sensitive_enrollment(
    attempt.program_id, attempt.enrollment_id, target_actor
  )
  from public.assessment_attempts attempt
  where attempt.id = target_attempt;
$$;

create or replace function private.report_snapshot_program(target_snapshot uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot.program_id
  from public.measurement_report_snapshots snapshot
  where snapshot.id = target_snapshot;
$$;

create or replace function private.project_structured_metrics(target_metrics jsonb)
returns table (
  metric_order smallint,
  metric_kind text,
  numeric_value numeric,
  unit text,
  sensitivity text
)
language sql
immutable
set search_path = ''
as $$
  select mapping.metric_order, mapping.metric_kind,
    (target_metrics ->> mapping.json_key)::numeric,
    mapping.unit, mapping.sensitivity
  from (
    values
      (1::smallint, 'distanceM', 'distance_m', 'm', 'activity'),
      (2::smallint, 'durationS', 'duration_s', 's', 'activity'),
      (3::smallint, 'paceSecondsPerKm', 'pace_s_per_km', 's/km', 'activity'),
      (4::smallint, 'averageHeartRateBpm', 'average_heart_rate_bpm', 'bpm', 'health'),
      (5::smallint, 'maxHeartRateBpm', 'max_heart_rate_bpm', 'bpm', 'health'),
      (6::smallint, 'steps', 'steps', 'count', 'activity'),
      (7::smallint, 'elevationGainM', 'elevation_gain_m', 'm', 'activity')
  ) mapping(metric_order, json_key, metric_kind, unit, sensitivity)
  where target_metrics ? mapping.json_key
  order by mapping.metric_order;
$$;

create or replace function public.read_participant_structured_metrics(
  target_program uuid
)
returns table (
  structured_import_id uuid,
  metric_kind text,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  source_family text,
  source_model text,
  parser_name text,
  parser_version text,
  quality_flags text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  if not private.is_active_program_member(
    actor, target_program, 'participant'
  ) then
    raise exception 'participant structured-metric projection forbidden'
      using errcode = '42501';
  end if;
  select program.organization_id into target_organization
  from public.programs program where program.id = target_program;
  perform private.record_audit(
    target_organization, actor, actor,
    'sensitive.structured_metric_projection.participant_read',
    'structured_metric_projection', target_program,
    jsonb_build_object(
      'projection', 'participant_sensitive_metrics',
      'program_id', target_program
    )
  );
  return query
  select imported.id, typed_metric.metric_kind,
    typed_metric.numeric_value, typed_metric.unit, imported.observed_at,
    imported.source_family, imported.source_model, imported.parser_name,
    imported.parser_version, imported.quality_flags
  from public.accepted_structured_imports imported
  cross join lateral private.project_structured_metrics(
    imported.metrics
  ) typed_metric
  where imported.program_id = target_program
    and imported.participant_profile_id = actor
  order by imported.observed_at desc, imported.id,
    typed_metric.metric_order;
end;
$$;

create or replace function public.read_named_coach_structured_metrics(
  target_program uuid,
  target_participant uuid
)
returns table (
  structured_import_id uuid,
  metric_kind text,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  source_family text,
  source_model text,
  parser_name text,
  parser_version text,
  quality_flags text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  if not private.is_active_named_coach(
    target_program, target_participant, actor
  ) then
    raise exception 'named-coach structured-metric projection forbidden'
      using errcode = '42501';
  end if;
  select program.organization_id into target_organization
  from public.programs program where program.id = target_program;
  perform private.record_audit(
    target_organization, actor, target_participant,
    'sensitive.structured_metric_projection.named_coach_read',
    'structured_metric_projection', target_program,
    jsonb_build_object(
      'projection', 'named_coach_sensitive_metrics',
      'program_id', target_program,
      'participant_profile_id', target_participant
    )
  );
  return query
  select imported.id, typed_metric.metric_kind,
    typed_metric.numeric_value, typed_metric.unit, imported.observed_at,
    imported.source_family, imported.source_model, imported.parser_name,
    imported.parser_version, imported.quality_flags
  from public.accepted_structured_imports imported
  cross join lateral private.project_structured_metrics(
    imported.metrics
  ) typed_metric
  where imported.program_id = target_program
    and imported.participant_profile_id = target_participant
  order by imported.observed_at desc, imported.id,
    typed_metric.metric_order;
end;
$$;

create or replace function public.read_participant_measurement_details(
  target_program uuid
)
returns table (
  record_kind text,
  record_id uuid,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  review_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_enrollment uuid;
  target_organization uuid;
begin
  if not private.is_active_program_member(actor, target_program, 'participant') then
    raise exception 'participant measurement projection forbidden'
      using errcode = '42501';
  end if;
  select enrollment.id into target_enrollment
  from public.program_enrollments enrollment
  where enrollment.program_id = target_program
    and enrollment.profile_id = actor;
  select program.organization_id into target_organization
  from public.programs program where program.id = target_program;
  perform private.record_audit(
    target_organization, actor, actor,
    'sensitive.measurement_projection.participant_read',
    'measurement_projection', target_program,
    jsonb_build_object('program_id', target_program)
  );
  return query
  select result.record_kind, result.record_id, result.numeric_value,
    result.unit, result.observed_at, result.review_status
  from (
    select 'three_kilometer_seconds'::text as record_kind,
      attempt.id as record_id, attempt.elapsed_seconds as numeric_value,
      'seconds'::text as unit, attempt.recorded_at as observed_at,
      attempt.status as review_status
    from public.assessment_attempts attempt
    where attempt.program_id = target_program
      and attempt.enrollment_id = target_enrollment
    union all
    select 'resting_heart_rate_bpm'::text, reading.id,
      reading.bpm, 'bpm'::text, reading.recorded_at, reading.status
    from public.resting_heart_rate_readings reading
    where reading.program_id = target_program
      and reading.enrollment_id = target_enrollment
  ) result
  order by result.observed_at desc, result.record_id;
end;
$$;

create or replace function public.read_named_coach_measurement_details(
  target_program uuid,
  target_participant uuid
)
returns table (
  record_kind text,
  record_id uuid,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  review_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_enrollment uuid;
  target_organization uuid;
begin
  if not private.is_active_named_coach(
    target_program, target_participant, actor
  ) then
    raise exception 'named-coach measurement projection forbidden'
      using errcode = '42501';
  end if;
  select enrollment.id into target_enrollment
  from public.program_enrollments enrollment
  where enrollment.program_id = target_program
    and enrollment.profile_id = target_participant;
  select program.organization_id into target_organization
  from public.programs program where program.id = target_program;
  perform private.record_audit(
    target_organization, actor, target_participant,
    'sensitive.measurement_projection.named_coach_read',
    'measurement_projection', target_program,
    jsonb_build_object(
      'program_id', target_program,
      'participant_profile_id', target_participant
    )
  );
  return query
  select result.record_kind, result.record_id, result.numeric_value,
    result.unit, result.observed_at, result.review_status
  from (
    select 'three_kilometer_seconds'::text as record_kind,
      attempt.id as record_id, attempt.elapsed_seconds as numeric_value,
      'seconds'::text as unit, attempt.recorded_at as observed_at,
      attempt.status as review_status
    from public.assessment_attempts attempt
    where attempt.program_id = target_program
      and attempt.enrollment_id = target_enrollment
    union all
    select 'resting_heart_rate_bpm'::text, reading.id,
      reading.bpm, 'bpm'::text, reading.recorded_at, reading.status
    from public.resting_heart_rate_readings reading
    where reading.program_id = target_program
      and reading.enrollment_id = target_enrollment
  ) result
  order by result.observed_at desc, result.record_id;
end;
$$;

create or replace function public.read_suppressed_report_snapshot(
  target_snapshot uuid
)
returns table (
  snapshot_id uuid,
  calculation_version text,
  generated_at timestamptz,
  row_key text,
  column_key text,
  participant_count integer,
  numeric_value numeric,
  suppressed boolean,
  suppression_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_program uuid;
  target_organization uuid;
  database_role text := current_setting('role', true);
begin
  select snapshot.program_id, program.organization_id
    into target_program, target_organization
  from public.measurement_report_snapshots snapshot
  join public.programs program on program.id = snapshot.program_id
  where snapshot.id = target_snapshot and snapshot.status = 'released';
  if target_program is null then
    raise exception 'released report snapshot not found' using errcode = '42501';
  end if;
  if database_role <> 'plus_aggregate_exporter'
    and not private.is_active_program_member(
      actor, target_program, 'stakeholder'
    ) then
    raise exception 'suppressed report projection forbidden' using errcode = '42501';
  end if;
  perform private.record_audit(
    target_organization, actor, null,
    'aggregate.report_projection.authorized_read',
    'report_snapshot', target_snapshot,
    jsonb_build_object('program_id', target_program)
  );
  return query
  select snapshot.id, snapshot.calculation_version, snapshot.generated_at,
    cell.row_key, cell.column_key,
    case when cell.suppressed or cell.participant_count < 5
      then null else cell.participant_count end,
    case when cell.suppressed or cell.participant_count < 5
      then null else cell.numeric_value end,
    cell.suppressed or cell.participant_count < 5,
    case when cell.suppressed or cell.participant_count < 5
      then coalesce(cell.suppression_reason, 'primary') else null end
  from public.measurement_report_snapshots snapshot
  join public.report_aggregate_cells cell on cell.snapshot_id = snapshot.id
  where snapshot.id = target_snapshot and snapshot.status = 'released'
  order by cell.row_key, cell.column_key;
end;
$$;

revoke all on function private.current_actor_is_active()
  from public, anon, authenticated;
revoke all on function private.current_actor_has_role(text[])
  from public, anon, authenticated;
revoke all on function private.enrollment_profile(uuid)
  from public, anon, authenticated;
revoke all on function private.can_access_sensitive_enrollment(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_access_sensitive_attempt(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.report_snapshot_program(uuid)
  from public, anon, authenticated;
revoke all on function private.project_structured_metrics(jsonb)
  from public, anon, authenticated;
grant execute on function private.current_actor_is_active(),
  private.current_actor_has_role(text[]),
  private.enrollment_profile(uuid),
  private.can_access_sensitive_enrollment(uuid, uuid, uuid),
  private.can_access_sensitive_attempt(uuid, uuid),
  private.report_snapshot_program(uuid)
to authenticated;

revoke all on function public.read_participant_measurement_details(uuid)
  from public, anon, authenticated, plus_aggregate_exporter, plus_service_worker;
revoke all on function public.read_named_coach_measurement_details(uuid, uuid)
  from public, anon, authenticated, plus_aggregate_exporter, plus_service_worker;
revoke all on function public.read_participant_structured_metrics(uuid)
  from public, anon, authenticated, plus_aggregate_exporter, plus_service_worker;
revoke all on function public.read_named_coach_structured_metrics(uuid, uuid)
  from public, anon, authenticated, plus_aggregate_exporter, plus_service_worker;
revoke all on function public.read_suppressed_report_snapshot(uuid)
  from public, anon, authenticated, plus_aggregate_exporter, plus_service_worker;
grant execute on function public.read_participant_measurement_details(uuid),
  public.read_named_coach_measurement_details(uuid, uuid),
  public.read_participant_structured_metrics(uuid),
  public.read_named_coach_structured_metrics(uuid, uuid)
to authenticated;
grant execute on function public.read_suppressed_report_snapshot(uuid)
to authenticated, plus_aggregate_exporter;

grant select, insert, update, delete on public.tenant_configs,
  public.program_invitations, public.program_enrollments,
  public.assessment_protocol_versions, public.assessment_sessions,
  public.training_prescriptions, public.program_attrition_events,
  public.governance_release_statuses, public.measurement_report_snapshots,
  public.report_aggregate_cells
to authenticated;
grant select on public.measurement_protocol_templates to authenticated;
grant insert, update, delete on public.assessment_attempts,
  public.assessment_attempt_conditions, public.session_adherence_evidence,
  public.resting_heart_rate_readings
to authenticated;
revoke select on public.assessment_attempts,
  public.assessment_attempt_conditions, public.session_adherence_evidence,
  public.resting_heart_rate_readings
from public, anon, authenticated;
revoke select on public.accepted_structured_imports
from public, anon, authenticated;
drop policy if exists accepted_structured_imports_select_scoped
  on public.accepted_structured_imports;

drop policy if exists profiles_select_directory on public.profiles;
create policy profiles_select_directory on public.profiles
for select to authenticated using (
  lifecycle_status = 'active'
  and private.current_actor_has_role(array['participant', 'coach', 'admin'])
  and (
    id = (select auth.uid())
    or exists (
      select 1
      from public.program_memberships viewer
      join public.program_memberships listed
        on listed.program_id = viewer.program_id
      where viewer.profile_id = (select auth.uid())
        and viewer.role in ('participant', 'coach', 'admin')
        and viewer.status = 'active'
        and listed.profile_id = profiles.id
        and listed.status = 'active'
    )
  )
);

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
for select to authenticated using (
  private.has_org_role(id, array['participant', 'coach', 'admin'])
);

drop policy if exists organization_memberships_select_scoped
  on public.organization_memberships;
create policy organization_memberships_select_scoped
on public.organization_memberships for select to authenticated using (
  (
    profile_id = (select auth.uid())
    and private.has_org_role(
      organization_id, array['participant', 'coach', 'admin']
    )
  )
  or private.has_org_role(organization_id, array['coach', 'admin'])
);

drop policy if exists programs_select_member on public.programs;
create policy programs_select_member on public.programs
for select to authenticated using (
  private.has_program_role(id, array['participant', 'coach', 'admin'])
  or private.has_org_role(organization_id, array['admin'])
);

drop policy if exists program_memberships_select_scoped
  on public.program_memberships;
create policy program_memberships_select_scoped
on public.program_memberships for select to authenticated using (
  (
    profile_id = (select auth.uid())
    and private.has_program_role(
      program_id, array['participant', 'coach', 'admin']
    )
  )
  or private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);

drop policy if exists sessions_select_member on public.program_sessions;
create policy sessions_select_member on public.program_sessions
for select to authenticated using (
  private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);

drop policy if exists time_trials_select_member on public.time_trial_decisions;
create policy time_trials_select_member on public.time_trial_decisions
for select to authenticated using (
  private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);

drop policy if exists assignments_select_member on public.assignments;
create policy assignments_select_member on public.assignments
for select to authenticated using (
  (
    published_at is not null
    and private.has_program_role(
      program_id, array['participant', 'coach', 'admin']
    )
  )
  or private.has_program_role(program_id, array['coach', 'admin'])
);

drop policy if exists announcements_select_member on public.announcements;
create policy announcements_select_member on public.announcements
for select to authenticated using (
  (
    published_at is not null
    and private.has_program_role(
      program_id, array['participant', 'coach', 'admin']
    )
  )
  or private.has_program_role(program_id, array['coach', 'admin'])
);

drop policy if exists retention_rules_read on public.retention_rules;
create policy retention_rules_read on public.retention_rules
for select to authenticated using (
  private.current_actor_has_role(array['participant', 'coach', 'admin'])
);

drop policy if exists screenshot_draft_jobs_select_scoped
  on public.screenshot_draft_jobs;
create policy screenshot_draft_jobs_select_scoped
on public.screenshot_draft_jobs for select to authenticated using (
  (
    participant_profile_id = (select auth.uid())
    and private.is_active_program_member(
      (select auth.uid()), program_id, 'participant'
    )
  )
  or private.is_active_named_coach(
    program_id, participant_profile_id, (select auth.uid())
  )
);

create policy tenant_configs_read_active_member
on public.tenant_configs for select to authenticated using (
  private.has_org_role(
    organization_id, array['participant', 'coach', 'admin']
  )
);
create policy tenant_configs_write_admin
on public.tenant_configs for all to authenticated using (
  private.has_org_role(organization_id, array['admin'])
) with check (
  private.has_org_role(organization_id, array['admin'])
);

create policy measurement_protocol_templates_read_active_member
on public.measurement_protocol_templates for select to authenticated using (
  private.current_actor_has_role(array['participant', 'coach', 'admin'])
);

create policy program_invitations_admin
on public.program_invitations for all to authenticated using (
  private.has_program_role(program_id, array['admin'])
) with check (
  private.has_program_role(program_id, array['admin'])
);

create policy program_enrollments_read_scoped
on public.program_enrollments for select to authenticated using (
  (
    profile_id = (select auth.uid())
    and private.is_active_program_member(
      (select auth.uid()), program_id, 'participant'
    )
  )
  or private.has_program_role(program_id, array['coach', 'admin'])
);
create policy program_enrollments_write_admin
on public.program_enrollments for all to authenticated using (
  private.has_program_role(program_id, array['admin'])
) with check (
  private.has_program_role(program_id, array['admin'])
);

create policy assessment_protocol_versions_read_member
on public.assessment_protocol_versions for select to authenticated using (
  private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);
create policy assessment_protocol_versions_write_staff
on public.assessment_protocol_versions for all to authenticated using (
  private.has_program_role(program_id, array['coach', 'admin'])
) with check (
  created_by = (select auth.uid())
  and private.has_program_role(program_id, array['coach', 'admin'])
);

create policy assessment_sessions_read_member
on public.assessment_sessions for select to authenticated using (
  private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);
create policy assessment_sessions_write_staff
on public.assessment_sessions for all to authenticated using (
  private.has_program_role(program_id, array['coach', 'admin'])
) with check (
  private.has_program_role(program_id, array['coach', 'admin'])
);

create policy assessment_attempts_insert_sensitive_party
on public.assessment_attempts for insert to authenticated with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy assessment_attempts_update_sensitive_party
on public.assessment_attempts for update to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
) with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy assessment_attempts_delete_sensitive_party
on public.assessment_attempts for delete to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);

create policy assessment_attempt_conditions_insert_sensitive_party
on public.assessment_attempt_conditions for insert to authenticated with check (
  private.can_access_sensitive_attempt(attempt_id, (select auth.uid()))
);
create policy assessment_attempt_conditions_update_sensitive_party
on public.assessment_attempt_conditions for update to authenticated using (
  private.can_access_sensitive_attempt(attempt_id, (select auth.uid()))
) with check (
  private.can_access_sensitive_attempt(attempt_id, (select auth.uid()))
);
create policy assessment_attempt_conditions_delete_sensitive_party
on public.assessment_attempt_conditions for delete to authenticated using (
  private.can_access_sensitive_attempt(attempt_id, (select auth.uid()))
);

create policy training_prescriptions_read_scoped
on public.training_prescriptions for select to authenticated using (
  (
    private.enrollment_profile(enrollment_id) = (select auth.uid())
    and private.is_active_program_member(
      (select auth.uid()), program_id, 'participant'
    )
  )
  or private.has_program_role(program_id, array['coach', 'admin'])
);
create policy training_prescriptions_write_staff
on public.training_prescriptions for all to authenticated using (
  private.has_program_role(program_id, array['coach', 'admin'])
) with check (
  private.has_program_role(program_id, array['coach', 'admin'])
);

create policy session_adherence_evidence_insert_sensitive_party
on public.session_adherence_evidence for insert to authenticated with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy session_adherence_evidence_update_sensitive_party
on public.session_adherence_evidence for update to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
) with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy session_adherence_evidence_delete_sensitive_party
on public.session_adherence_evidence for delete to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);

create policy program_attrition_events_read_sensitive_party
on public.program_attrition_events for select to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy program_attrition_events_insert_staff
on public.program_attrition_events for insert to authenticated with check (
  private.has_program_role(program_id, array['coach', 'admin'])
);

create policy resting_heart_rate_readings_insert_sensitive_party
on public.resting_heart_rate_readings for insert to authenticated with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy resting_heart_rate_readings_update_sensitive_party
on public.resting_heart_rate_readings for update to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
) with check (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);
create policy resting_heart_rate_readings_delete_sensitive_party
on public.resting_heart_rate_readings for delete to authenticated using (
  private.can_access_sensitive_enrollment(
    program_id, enrollment_id, (select auth.uid())
  )
);

create policy governance_release_statuses_admin
on public.governance_release_statuses for all to authenticated using (
  private.has_program_role(program_id, array['admin'])
) with check (
  private.has_program_role(program_id, array['admin'])
);

create policy measurement_report_snapshots_admin
on public.measurement_report_snapshots for all to authenticated using (
  private.has_program_role(program_id, array['admin'])
) with check (
  private.has_program_role(program_id, array['admin'])
);

create policy report_aggregate_cells_admin
on public.report_aggregate_cells for all to authenticated using (
  private.has_program_role(
    private.report_snapshot_program(snapshot_id), array['admin']
  )
) with check (
  private.has_program_role(
    private.report_snapshot_program(snapshot_id), array['admin']
  )
);

do $$
declare
  target record;
begin
  for target in
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format(
      'drop policy if exists active_authenticated_only on public.%I',
      target.table_name
    );
    execute format(
      'create policy active_authenticated_only on public.%I as restrictive '
      || 'for all to authenticated '
      || 'using ((select private.current_actor_is_active())) '
      || 'with check ((select private.current_actor_is_active()))',
      target.table_name
    );
  end loop;
end;
$$;

drop policy if exists active_authenticated_only on storage.objects;
create policy active_authenticated_only on storage.objects as restrictive
for all to authenticated
using ((select private.current_actor_is_active()))
with check ((select private.current_actor_is_active()));

revoke all on all tables in schema public
from plus_aggregate_exporter, plus_service_worker;
revoke all on all sequences in schema public
from plus_aggregate_exporter, plus_service_worker;
revoke all on schema private
from plus_aggregate_exporter, plus_service_worker;
revoke execute on all functions in schema private from public;
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to plus_service_worker;
grant execute on function private.accept_structured_import(
  uuid, uuid, uuid, text, timestamptz, text, text, text[], jsonb, uuid, text
), private.create_screenshot_draft_job(
  uuid, uuid, uuid, uuid, text, text, integer
), private.finish_screenshot_draft_job(uuid, text, text),
  private.enqueue_notification_event(
    uuid, uuid, text, text, text, uuid, text, timestamptz
  ), private.advance_account_deletion(uuid, text, timestamptz),
  private.record_account_deletion_failure(uuid, text),
  private.scan_deletion_job_alerts(timestamptz)
to plus_service_worker;
grant plus_aggregate_exporter, plus_service_worker to service_role;

comment on function public.read_suppressed_report_snapshot(uuid) is
  'Only released aggregate cells are returned; primary/complementary or sub-five cells have count and value masked at query time.';
comment on role plus_aggregate_exporter is
  'NOLOGIN/NOBYPASSRLS role assumed by the export worker for the suppressed report RPC only.';
comment on role plus_service_worker is
  'NOLOGIN/NOBYPASSRLS role assumed by service workers for allowlisted lifecycle functions only.';
