create or replace function private.validate_submission_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.assignments assignment
    where assignment.id = new.assignment_id and assignment.program_id = new.program_id
  ) then
    raise exception 'assignment and submission programs must match' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.program_memberships member
    where member.program_id = new.program_id and member.profile_id = new.participant_id
      and member.role = 'participant' and member.status = 'active'
  ) then
    raise exception 'submission owner must be an active participant' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_validate_scope on public.homework_submissions;
create trigger submissions_validate_scope before insert or update on public.homework_submissions
for each row execute function private.validate_submission_scope();

create or replace function private.validate_metric_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.program_memberships member
    join public.programs program on program.id = member.program_id
    join public.organization_memberships organization_member
      on organization_member.organization_id = program.organization_id
      and organization_member.profile_id = member.profile_id
    where member.program_id = new.program_id
      and member.profile_id = new.owner_profile_id
      and member.role = 'participant'
      and member.status = 'active'
      and member.joined_at <= now()
      and (member.ended_at is null or member.ended_at > now())
      and program.status = 'active'
      and current_date between program.starts_on and program.ends_on
      and organization_member.organization_id = program.organization_id
      and organization_member.profile_id = new.owner_profile_id
      and organization_member.role = 'participant'
      and organization_member.status = 'active'
      and organization_member.starts_at <= now()
      and (organization_member.ends_at is null or organization_member.ends_at > now())
  ) then
    raise exception 'metric owner must be an active participant in the current program and organization' using errcode = '23514';
  end if;
  if new.upload_id is not null and not exists (
    select 1 from public.data_uploads upload
    where upload.id = new.upload_id and upload.program_id = new.program_id
      and upload.owner_profile_id = new.owner_profile_id
  ) then
    raise exception 'metric upload owner and program must match' using errcode = '23514';
  end if;
  if new.submission_id is not null and not exists (
    select 1 from public.homework_submissions submission
    where submission.id = new.submission_id and submission.program_id = new.program_id
      and submission.participant_id = new.owner_profile_id
  ) then
    raise exception 'metric submission owner and program must match' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists metrics_validate_scope on public.metric_records;
create trigger metrics_validate_scope before insert or update on public.metric_records
for each row execute function private.validate_metric_scope();

create or replace function private.validate_program_membership_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_organization uuid;
begin
  select organization_id into target_organization from public.programs where id = new.program_id;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization
      and membership.profile_id = new.profile_id
      and membership.role = new.role
      and membership.status = 'active'
  ) then
    raise exception 'program role must match an active organization role' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists program_memberships_validate_scope on public.program_memberships;
create trigger program_memberships_validate_scope before insert or update on public.program_memberships
for each row execute function private.validate_program_membership_scope();

create or replace function private.validate_feedback_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.program_memberships member
    where member.program_id = new.program_id and member.profile_id = new.participant_id
      and member.role = 'participant' and member.status = 'active'
  ) then
    raise exception 'feedback recipient must be an active participant' using errcode = '23514';
  end if;
  if new.submission_id is not null and not exists (
    select 1 from public.homework_submissions submission
    where submission.id = new.submission_id and submission.program_id = new.program_id
      and submission.participant_id = new.participant_id
  ) then
    raise exception 'feedback submission must belong to the participant and program' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_validate_scope on public.feedback_items;
create trigger feedback_validate_scope before insert or update on public.feedback_items
for each row execute function private.validate_feedback_scope();

comment on function private.validate_metric_scope() is
  'Prevents forged foreign keys from attaching another participant upload or submission to a metric.';
