create unique index if not exists program_memberships_measurement_scope_key
  on public.program_memberships (id, program_id, profile_id);
create unique index if not exists program_sessions_measurement_scope_key
  on public.program_sessions (id, program_id);

create table public.tenant_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  brand_key text not null check (brand_key in ('run_change', 'plus_run')),
  program_config_key text not null
    check (program_config_key in ('run_change_nine_week', 'plus_run_complete_2026')),
  timezone text not null default 'Asia/Seoul' check (timezone in ('Asia/Seoul')),
  created_at timestamptz not null default now(),
  check (
    (brand_key = 'plus_run' and program_config_key = 'plus_run_complete_2026')
    or (brand_key = 'run_change' and program_config_key = 'run_change_nine_week')
  )
);

create table public.measurement_protocol_templates (
  code text not null,
  version smallint not null check (version > 0),
  timezone text not null check (timezone = 'Asia/Seoul'),
  schedule_anchor_on date not null,
  program_start_on date not null,
  onboarding_on date not null,
  official_baseline_on date not null,
  rhr_baseline_start_on date not null,
  rhr_baseline_end_on date not null,
  rhr_comparison_start_on date not null,
  rhr_comparison_end_on date not null,
  intervention_endpoint_on date not null,
  official_retest_on date not null,
  administrative_end_on date not null,
  festival_on date not null,
  distance_m integer not null check (distance_m = 3000),
  minimum_valid_pairs smallint not null check (minimum_valid_pairs = 15),
  minimum_median_change_pct numeric not null check (minimum_median_change_pct = 3),
  minimum_improved_pct numeric not null check (minimum_improved_pct = 60),
  per_protocol_minimum_pct numeric not null check (per_protocol_minimum_pct = 80),
  minimum_rhr_days smallint not null check (minimum_rhr_days = 3),
  primary key (code, version),
  check (code = 'plus_run_complete_2026'),
  check (schedule_anchor_on = program_start_on),
  check (rhr_baseline_start_on <= rhr_baseline_end_on),
  check (rhr_comparison_start_on <= rhr_comparison_end_on),
  check (intervention_endpoint_on = official_retest_on),
  check (administrative_end_on = festival_on),
  check (official_baseline_on < official_retest_on)
);

insert into public.measurement_protocol_templates (
  code, version, timezone, schedule_anchor_on, program_start_on, onboarding_on,
  official_baseline_on, rhr_baseline_start_on, rhr_baseline_end_on,
  rhr_comparison_start_on, rhr_comparison_end_on, intervention_endpoint_on,
  official_retest_on, administrative_end_on, festival_on, distance_m,
  minimum_valid_pairs, minimum_median_change_pct, minimum_improved_pct,
  per_protocol_minimum_pct, minimum_rhr_days
) values (
  'plus_run_complete_2026', 1, 'Asia/Seoul', date '2026-08-24', date '2026-08-24',
  date '2026-08-25', date '2026-08-27', date '2026-08-17', date '2026-08-23',
  date '2026-10-08', date '2026-10-14', date '2026-10-15', date '2026-10-15',
  date '2026-10-24', date '2026-10-24', 3000, 15, 3, 60, 80, 3
);

create table public.program_invitations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  invitee_profile_id uuid references public.profiles(id) on delete cascade,
  invitee_email_hash text not null check (invitee_email_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('participant', 'coach', 'admin', 'stakeholder')),
  status text not null default 'created'
    check (status in ('created', 'sent', 'accepted', 'expired', 'revoked')),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  check (expires_at > invited_at),
  check ((status = 'accepted') = (accepted_at is not null))
);

create table public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_membership_id uuid not null,
  invitation_id uuid references public.program_invitations(id) on delete restrict,
  lifecycle_status text not null default 'onboarding'
    check (lifecycle_status in ('onboarding', 'active', 'paused', 'withdrawn', 'completed', 'ended')),
  enrolled_on date not null,
  active_from date,
  active_until date,
  withdrawn_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (program_id, profile_id),
  unique (id, program_id),
  foreign key (program_membership_id, program_id, profile_id)
    references public.program_memberships (id, program_id, profile_id) on delete cascade,
  check (active_until is null or (active_from is not null and active_until >= active_from)),
  check ((lifecycle_status = 'withdrawn') = (withdrawn_at is not null)),
  check ((lifecycle_status = 'completed') = (completed_at is not null))
);

create table public.assessment_protocol_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  template_code text not null,
  template_version smallint not null,
  version smallint not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'locked', 'retired')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (program_id, version),
  unique (id, program_id),
  foreign key (template_code, template_version)
    references public.measurement_protocol_templates (code, version) on delete restrict,
  check ((status = 'locked') = (locked_at is not null))
);

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  protocol_version_id uuid not null,
  purpose text not null check (purpose in ('baseline', 'retest')),
  scheduled_on date not null,
  is_official boolean not null default true check (is_official),
  created_at timestamptz not null default now(),
  unique (protocol_version_id, purpose),
  unique (id, program_id, protocol_version_id),
  foreign key (protocol_version_id, program_id)
    references public.assessment_protocol_versions (id, program_id) on delete cascade
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  protocol_version_id uuid not null,
  assessment_session_id uuid not null,
  enrollment_id uuid not null,
  attempt_kind text not null check (attempt_kind in ('original', 'technical_reattempt')),
  original_attempt_id uuid references public.assessment_attempts(id) on delete restrict,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'rejected', 'invalidated')),
  elapsed_seconds numeric not null check (elapsed_seconds > 0),
  recorded_at timestamptz not null,
  accepted_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason_code text
    check (invalidation_reason_code is null or invalidation_reason_code = 'technical_interruption'),
  created_at timestamptz not null default now(),
  foreign key (assessment_session_id, program_id, protocol_version_id)
    references public.assessment_sessions (id, program_id, protocol_version_id) on delete cascade,
  foreign key (enrollment_id, program_id)
    references public.program_enrollments (id, program_id) on delete cascade,
  check ((attempt_kind = 'original') = (original_attempt_id is null)),
  check ((status = 'accepted') = (accepted_at is not null)),
  check (
    (status = 'invalidated' and invalidated_at is not null and invalidation_reason_code is not null)
    or (status <> 'invalidated' and invalidated_at is null and invalidation_reason_code is null)
  )
);

create unique index assessment_attempts_one_original_idx
  on public.assessment_attempts (assessment_session_id, enrollment_id)
  where attempt_kind = 'original';
create unique index assessment_attempts_one_technical_reattempt_idx
  on public.assessment_attempts (original_attempt_id)
  where attempt_kind = 'technical_reattempt';

create table public.assessment_attempt_conditions (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  route_version text not null check (route_version ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  measured_distance_m integer not null check (measured_distance_m = 3000),
  surface_key text not null check (surface_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
  timing_method_key text not null check (timing_method_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
  warmup_protocol_key text not null check (warmup_protocol_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
  started_local_at time not null,
  timezone text not null check (timezone = 'Asia/Seoul'),
  source_family text not null check (source_family ~ '^[a-z][a-z0-9_-]{0,39}$'),
  device_family text not null check (device_family ~ '^[a-z][a-z0-9_-]{0,39}$'),
  recorded_at timestamptz not null default now()
);

create table public.training_prescriptions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid not null,
  session_id uuid not null,
  assigned_at timestamptz not null,
  assigned_while_active boolean not null default false,
  status text not null default 'assigned' check (status in ('assigned', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (enrollment_id, session_id),
  foreign key (enrollment_id, program_id)
    references public.program_enrollments (id, program_id) on delete cascade,
  foreign key (session_id, program_id)
    references public.program_sessions (id, program_id) on delete cascade
);

create table public.session_adherence_evidence (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid not null,
  prescription_id uuid not null references public.training_prescriptions(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('manual', 'activity', 'import', 'submission')),
  linked_record_id uuid not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'rejected')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (prescription_id, linked_record_id),
  check ((status = 'accepted') = (accepted_at is not null))
);

create table public.program_attrition_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid not null,
  event_kind text not null
    check (event_kind in ('withdrawal', 'lost_to_followup', 'completion', 'administrative_end')),
  effective_at timestamptz not null,
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_-]{0,79}$'),
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, program_id)
    references public.program_enrollments (id, program_id) on delete cascade
);

create table public.resting_heart_rate_readings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  protocol_version_id uuid not null,
  enrollment_id uuid not null,
  local_date date not null,
  local_time time not null,
  timezone text not null check (timezone = 'Asia/Seoul'),
  bpm numeric not null check (bpm between 20 and 240),
  source_family text not null check (source_family ~ '^[a-z][a-z0-9_-]{0,39}$'),
  device_family text not null check (device_family ~ '^[a-z][a-z0-9_-]{0,39}$'),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'rejected')),
  accepted_at timestamptz,
  recorded_at timestamptz not null default now(),
  foreign key (protocol_version_id, program_id)
    references public.assessment_protocol_versions (id, program_id) on delete cascade,
  foreign key (enrollment_id, program_id)
    references public.program_enrollments (id, program_id) on delete cascade,
  check ((status = 'accepted') = (accepted_at is not null))
);

create table public.governance_release_statuses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  protocol_version_id uuid not null,
  status text not null default 'blocked' check (status in ('blocked', 'pending', 'approved', 'released')),
  candidate_sha text check (candidate_sha is null or candidate_sha ~ '^[0-9a-f]{40}$'),
  program_owner_approved_at timestamptz,
  privacy_approved_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (protocol_version_id),
  unique (id, program_id, protocol_version_id),
  foreign key (protocol_version_id, program_id)
    references public.assessment_protocol_versions (id, program_id) on delete cascade,
  check (
    status not in ('approved', 'released')
    or (candidate_sha is not null and program_owner_approved_at is not null and privacy_approved_at is not null)
  ),
  check ((status = 'released') = (released_at is not null))
);

create table public.measurement_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  protocol_version_id uuid not null,
  governance_release_status_id uuid,
  calculation_version text not null check (calculation_version = 'plus_run_measurement_v1'),
  status text not null default 'draft' check (status in ('draft', 'frozen', 'released', 'superseded')),
  report_payload jsonb not null check (jsonb_typeof(report_payload) = 'object'),
  generated_at timestamptz not null default now(),
  frozen_at timestamptz,
  released_at timestamptz,
  foreign key (protocol_version_id, program_id)
    references public.assessment_protocol_versions (id, program_id) on delete cascade,
  foreign key (governance_release_status_id, program_id, protocol_version_id)
    references public.governance_release_statuses (id, program_id, protocol_version_id)
    on delete restrict,
  check ((status in ('frozen', 'released', 'superseded')) = (frozen_at is not null)),
  check ((status in ('released', 'superseded')) = (released_at is not null))
);

create table public.report_aggregate_cells (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.measurement_report_snapshots(id) on delete cascade,
  row_key text not null check (row_key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  column_key text not null check (column_key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  participant_count integer not null check (participant_count >= 0),
  numeric_value numeric,
  suppressed boolean not null default false,
  suppression_reason text check (suppression_reason in ('primary', 'complementary')),
  unique (snapshot_id, row_key, column_key),
  check (suppressed = (suppression_reason is not null))
);

create or replace function private.reject_protocol_template_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'measurement protocol templates are immutable; create a new version'
    using errcode = '23514';
end;
$$;

create trigger measurement_protocol_templates_immutable
before update or delete on public.measurement_protocol_templates
for each row execute function private.reject_protocol_template_mutation();

create or replace function private.validate_program_enrollment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.program_memberships membership
    where membership.id = new.program_membership_id
      and membership.program_id = new.program_id
      and membership.profile_id = new.profile_id
      and membership.role = 'participant'
  ) then
    raise exception 'enrollment must reference the participant membership in the same program'
      using errcode = '23514';
  end if;
  if new.invitation_id is not null and not exists (
    select 1 from public.program_invitations invitation
    where invitation.id = new.invitation_id
      and invitation.program_id = new.program_id
      and invitation.invitee_profile_id = new.profile_id
      and invitation.role = 'participant'
      and invitation.status = 'accepted'
  ) then
    raise exception 'enrollment invitation must be an accepted participant invitation in the same program'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger program_enrollments_validate
before insert or update on public.program_enrollments
for each row execute function private.validate_program_enrollment();

create or replace function private.validate_assessment_session()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  expected_date date;
begin
  select case new.purpose
      when 'baseline' then template.official_baseline_on
      when 'retest' then template.official_retest_on
    end
    into expected_date
  from public.assessment_protocol_versions protocol
  join public.measurement_protocol_templates template
    on template.code = protocol.template_code and template.version = protocol.template_version
  where protocol.id = new.protocol_version_id and protocol.program_id = new.program_id;
  if expected_date is null or new.scheduled_on <> expected_date then
    raise exception 'official assessment session date must match the locked protocol'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assessment_sessions_validate
before insert or update on public.assessment_sessions
for each row execute function private.validate_assessment_session();

create or replace function private.reject_locked_assessment_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_protocol uuid;
begin
  if tg_table_name = 'assessment_protocol_versions' then
    target_protocol := old.id;
  else
    target_protocol := old.protocol_version_id;
  end if;
  if exists (
    select 1 from public.assessment_attempts attempt
    where attempt.protocol_version_id = target_protocol and attempt.status = 'accepted'
  ) then
    raise exception 'protocol and official sessions are immutable after an accepted attempt'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger assessment_protocol_versions_lock
before update or delete on public.assessment_protocol_versions
for each row execute function private.reject_locked_assessment_mutation();
create trigger assessment_sessions_lock
before update or delete on public.assessment_sessions
for each row execute function private.reject_locked_assessment_mutation();

create or replace function private.validate_assessment_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    old.status = 'accepted'
    or exists (
      select 1 from public.assessment_attempts reattempt
      where reattempt.original_attempt_id = old.id
        and reattempt.status = 'accepted'
    )
  ) then
    raise exception 'accepted assessment attempts are immutable' using errcode = '23514';
  end if;
  if new.attempt_kind = 'technical_reattempt' and not exists (
    select 1 from public.assessment_attempts original
    where original.id = new.original_attempt_id
      and original.attempt_kind = 'original'
      and original.assessment_session_id = new.assessment_session_id
      and original.enrollment_id = new.enrollment_id
      and original.status = 'invalidated'
      and original.invalidation_reason_code = 'technical_interruption'
      and new.recorded_at > original.recorded_at
      and new.recorded_at <= original.recorded_at + interval '7 days'
  ) then
    raise exception 'reattempt requires the same invalidated original within seven days after a documented technical interruption'
      using errcode = '23514';
  end if;
  if new.status = 'accepted' and not exists (
    select 1 from public.assessment_attempt_conditions conditions where conditions.attempt_id = new.id
  ) then
    raise exception 'accepted assessment attempts require complete immutable conditions'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assessment_attempts_validate
before insert or update on public.assessment_attempts
for each row execute function private.validate_assessment_attempt();

create or replace function private.reject_accepted_attempt_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'accepted' then
    raise exception 'accepted assessment attempts are immutable' using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger assessment_attempts_delete_lock
before delete on public.assessment_attempts
for each row execute function private.reject_accepted_attempt_delete();

create or replace function private.reject_accepted_conditions_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.assessment_attempts attempt
    where attempt.id = old.attempt_id
      and (
        attempt.status = 'accepted'
        or exists (
          select 1 from public.assessment_attempts reattempt
          where reattempt.original_attempt_id = attempt.id and reattempt.status = 'accepted'
        )
      )
  ) then
    raise exception 'accepted assessment attempt conditions are immutable' using errcode = '23514';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1 from public.assessment_attempts attempt
    where attempt.id = new.attempt_id
      and (
        attempt.status = 'accepted'
        or exists (
          select 1 from public.assessment_attempts reattempt
          where reattempt.original_attempt_id = attempt.id and reattempt.status = 'accepted'
        )
      )
  ) then
    raise exception 'accepted assessment attempt conditions are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger assessment_attempt_conditions_lock
before insert or update or delete on public.assessment_attempt_conditions
for each row execute function private.reject_accepted_conditions_mutation();

create or replace function private.validate_training_prescription()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  enrollment_status text;
  enrollment_active_from date;
  enrollment_active_until date;
begin
  select enrollment.lifecycle_status, enrollment.active_from, enrollment.active_until
    into enrollment_status, enrollment_active_from, enrollment_active_until
  from public.program_enrollments enrollment
  where enrollment.id = new.enrollment_id and enrollment.program_id = new.program_id;
  if enrollment_status is null or not exists (
    select 1 from public.program_sessions session
    where session.id = new.session_id and session.program_id = new.program_id
  ) then
    raise exception 'prescription enrollment and session must belong to the same program'
      using errcode = '23514';
  end if;
  new.assigned_while_active := enrollment_status = 'active'
    and enrollment_active_from is not null
    and (new.assigned_at at time zone 'Asia/Seoul')::date >= enrollment_active_from
    and (
      enrollment_active_until is null
      or (new.assigned_at at time zone 'Asia/Seoul')::date <= enrollment_active_until
    );
  return new;
end;
$$;

create trigger training_prescriptions_validate
before insert or update on public.training_prescriptions
for each row execute function private.validate_training_prescription();

create or replace function private.is_valid_adherence_source(
  target_kind text,
  target_record uuid,
  target_program uuid,
  target_enrollment uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when target_kind = 'submission' then exists (
      select 1
      from public.homework_submissions submission
      join public.program_enrollments enrollment
        on enrollment.id = target_enrollment
        and enrollment.program_id = submission.program_id
        and enrollment.profile_id = submission.participant_id
      where submission.id = target_record
        and submission.program_id = target_program
        and submission.status = 'reviewed'
        and submission.submitted_at is not null
    )
    else exists (
      select 1
      from public.metric_records metric
      join public.program_enrollments enrollment
        on enrollment.id = target_enrollment
        and enrollment.program_id = metric.program_id
        and enrollment.profile_id = metric.owner_profile_id
      where metric.id = target_record
        and metric.program_id = target_program
        and metric.verification_status = 'accepted'
        and metric.sensitivity = 'activity'
        and metric.observed_at is not null
        and (
          target_kind = 'activity'
          or (target_kind = 'manual' and metric.source = 'manual')
          or (target_kind = 'import' and metric.source = 'import')
        )
    )
  end;
$$;

create or replace function private.validate_adherence_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.training_prescriptions prescription
    where prescription.id = new.prescription_id
      and prescription.program_id = new.program_id
      and prescription.enrollment_id = new.enrollment_id
  ) then
    raise exception 'adherence evidence must match its prescription enrollment and program'
      using errcode = '23514';
  end if;
  if new.status = 'accepted' and not private.is_valid_adherence_source(
    new.evidence_kind, new.linked_record_id, new.program_id, new.enrollment_id
  ) then
    raise exception 'accepted adherence evidence must link an accepted activity record or reviewed participant submission'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger session_adherence_evidence_validate
before insert or update on public.session_adherence_evidence
for each row execute function private.validate_adherence_evidence();

create or replace function private.validate_rhr_reading()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.assessment_protocol_versions protocol
    join public.program_enrollments enrollment on enrollment.id = new.enrollment_id
    where protocol.id = new.protocol_version_id
      and protocol.program_id = new.program_id
      and enrollment.program_id = new.program_id
  ) then
    raise exception 'resting heart-rate reading must match its enrollment and protocol program'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger resting_heart_rate_readings_validate
before insert or update on public.resting_heart_rate_readings
for each row execute function private.validate_rhr_reading();

create or replace function private.reject_released_governance_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'released' then
    raise exception 'released governance status is immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger governance_release_statuses_lock
before update or delete on public.governance_release_statuses
for each row execute function private.reject_released_governance_mutation();

create or replace function private.validate_measurement_report_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('released', 'superseded') and not exists (
    select 1 from public.governance_release_statuses governance
    where governance.id = new.governance_release_status_id
      and governance.program_id = new.program_id
      and governance.protocol_version_id = new.protocol_version_id
      and governance.status = 'released'
  ) then
    raise exception 'released report snapshot requires released governance in the same program and protocol'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger measurement_report_snapshots_validate
before insert or update on public.measurement_report_snapshots
for each row execute function private.validate_measurement_report_snapshot();

create index program_invitations_program_status_idx
  on public.program_invitations (program_id, status, expires_at);
create index program_enrollments_program_status_idx
  on public.program_enrollments (program_id, lifecycle_status);
create index assessment_attempts_reporting_idx
  on public.assessment_attempts (protocol_version_id, enrollment_id, status);
create index training_prescriptions_reporting_idx
  on public.training_prescriptions (program_id, enrollment_id, assigned_while_active);
create index session_adherence_evidence_reporting_idx
  on public.session_adherence_evidence (enrollment_id, status);
create index resting_heart_rate_reporting_idx
  on public.resting_heart_rate_readings (protocol_version_id, enrollment_id, local_date, status);

alter table public.tenant_configs enable row level security;
alter table public.measurement_protocol_templates enable row level security;
alter table public.program_invitations enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.assessment_protocol_versions enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_conditions enable row level security;
alter table public.training_prescriptions enable row level security;
alter table public.session_adherence_evidence enable row level security;
alter table public.program_attrition_events enable row level security;
alter table public.resting_heart_rate_readings enable row level security;
alter table public.governance_release_statuses enable row level security;
alter table public.measurement_report_snapshots enable row level security;
alter table public.report_aggregate_cells enable row level security;

revoke all on public.measurement_protocol_templates from public, anon, authenticated;
revoke all on function private.reject_protocol_template_mutation() from public, anon, authenticated;
revoke all on function private.validate_program_enrollment() from public, anon, authenticated;
revoke all on function private.validate_assessment_session() from public, anon, authenticated;
revoke all on function private.reject_locked_assessment_mutation() from public, anon, authenticated;
revoke all on function private.validate_assessment_attempt() from public, anon, authenticated;
revoke all on function private.reject_accepted_attempt_delete() from public, anon, authenticated;
revoke all on function private.reject_accepted_conditions_mutation() from public, anon, authenticated;
revoke all on function private.validate_training_prescription() from public, anon, authenticated;
revoke all on function private.is_valid_adherence_source(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.validate_adherence_evidence() from public, anon, authenticated;
revoke all on function private.validate_rhr_reading() from public, anon, authenticated;
revoke all on function private.reject_released_governance_mutation() from public, anon, authenticated;
revoke all on function private.validate_measurement_report_snapshot() from public, anon, authenticated;

comment on table public.tenant_configs is
  'Brand and program keys are allowlisted presentation configuration; authorization remains membership-derived.';
comment on table public.measurement_protocol_templates is
  'Immutable PLUS Run 2026 measurement boundaries and predeclared reporting thresholds.';
comment on table public.assessment_attempts is
  'One official original per participant/session; a reattempt is allowed only after documented technical interruption.';
comment on table public.resting_heart_rate_readings is
  'Exploratory resting heart-rate inputs; source and device family are required and device serials are forbidden.';
