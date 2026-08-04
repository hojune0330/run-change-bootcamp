create or replace function private.is_active_program_member(
  target_profile uuid,
  target_program uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile is not null and exists (
    select 1
    from public.programs program
    join public.program_memberships program_member
      on program_member.program_id = program.id
      and program_member.profile_id = target_profile
      and program_member.role = target_role
    join public.organization_memberships organization_member
      on organization_member.organization_id = program.organization_id
      and organization_member.profile_id = target_profile
      and organization_member.role = target_role
    join public.profiles profile on profile.id = target_profile
    where program.id = target_program
      and program.status = 'active'
      and current_date between program.starts_on and program.ends_on
      and program_member.status = 'active'
      and program_member.joined_at <= now()
      and (program_member.ended_at is null or program_member.ended_at > now())
      and organization_member.status = 'active'
      and organization_member.starts_at <= now()
      and (organization_member.ends_at is null or organization_member.ends_at > now())
      and profile.lifecycle_status = 'active'
  );
$$;

create or replace function private.is_active_named_coach(
  target_program uuid,
  target_participant uuid,
  target_coach uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.is_active_program_member(target_participant, target_program, 'participant')
    and private.is_active_program_member(target_coach, target_program, 'coach')
    and exists (
      select 1
      from public.consent_grants consent
      join public.named_coach_grants coach_grant
        on coach_grant.consent_grant_id = consent.id
        and coach_grant.program_id = consent.program_id
        and coach_grant.participant_profile_id = consent.participant_profile_id
        and coach_grant.coach_profile_id = consent.recipient_profile_id
      where consent.program_id = target_program
        and consent.participant_profile_id = target_participant
        and consent.purpose = 'named_coach_sensitive_metrics'
        and consent.recipient_profile_id = target_coach
        and consent.status = 'active'
        and consent.expires_at > now()
        and coach_grant.status = 'active'
        and coach_grant.expires_at > now()
    );
end;
$$;

create or replace function private.audit_details_are_content_free(target_details jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  detail_key text;
  detail_value jsonb;
  normalized_key text;
  scalar_value text;
begin
  if target_details is null then
    return true;
  end if;
  if jsonb_typeof(target_details) <> 'object' then
    return false;
  end if;
  for detail_key, detail_value in select key, value from jsonb_each(target_details) loop
    normalized_key := lower(regexp_replace(
      detail_key, '([a-z0-9])([A-Z])', '\1_\2', 'g'
    ));
    if normalized_key ~ '(body|value|payload|content|prompt|response|question|answer|note)'
      or normalized_key ~ '(^|_)text(_|$)' then
      return false;
    end if;
    if normalized_key not in (
      'metric_record_id', 'grantee_profile_id', 'projection', 'thread_id',
      'faq_copy_id', 'audience', 'opt_in_id', 'consent_grant_id', 'purpose',
      'recipient_profile_id', 'named_coach_grant_id', 'coach_profile_id',
      'program_id', 'participant_profile_id'
    ) then
      return false;
    end if;
    if normalized_key in (
      'metric_record_id', 'grantee_profile_id', 'thread_id', 'faq_copy_id',
      'opt_in_id', 'consent_grant_id', 'recipient_profile_id',
      'named_coach_grant_id', 'coach_profile_id', 'program_id',
      'participant_profile_id'
    ) then
      if jsonb_typeof(detail_value) = 'null' then
        continue;
      end if;
      if jsonb_typeof(detail_value) <> 'string' then
        return false;
      end if;
      scalar_value := detail_value #>> '{}';
      if scalar_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return false;
      end if;
    elsif normalized_key = 'projection' then
      if jsonb_typeof(detail_value) <> 'string'
        or detail_value #>> '{}' not in (
          'participant_sensitive_metrics', 'named_coach_sensitive_metrics',
          'participant_private_question', 'named_coach_private_question',
          'participant_private_question_metadata',
          'named_coach_private_question_metadata'
        ) then
        return false;
      end if;
    elsif normalized_key = 'audience' then
      if jsonb_typeof(detail_value) <> 'string'
        or detail_value #>> '{}' <> 'anonymous' then
        return false;
      end if;
    elsif normalized_key = 'purpose' then
      if jsonb_typeof(detail_value) <> 'string'
        or detail_value #>> '{}' not in (
          'program_data_processing', 'named_coach_sensitive_metrics',
          'screenshot_ai', 'generative_feedback_ai', 'social_publication',
          'aggregate_analysis_reporting'
        ) then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.private_question_threads (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  question_body text not null check (char_length(question_body) between 1 and 5000),
  content_origin text not null default 'general'
    check (content_origin in ('general', 'training', 'health', 'reflection', 'pain')),
  content_sensitivity text generated always as (
    case when content_origin in ('health', 'reflection', 'pain')
      then 'sensitive' else 'private' end
  ) stored,
  visibility text not null default 'private' check (visibility = 'private'),
  status text not null default 'open'
    check (status in ('open', 'closed', 'archived', 'deleted')),
  routing_status text not null default 'unanswered'
    check (routing_status in ('unanswered', 'answered', 'needs_followup')),
  closed_at timestamptz,
  closed_by_profile_id uuid references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  archived_by_profile_id uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by_profile_id uuid references public.profiles(id) on delete restrict,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, program_id),
  check ((closed_at is null) = (closed_by_profile_id is null)),
  check ((archived_at is null) = (archived_by_profile_id is null)),
  check ((deleted_at is null) = (deleted_by_profile_id is null)),
  check (
    (status <> 'closed' or closed_at is not null)
    and (status <> 'archived' or archived_at is not null)
    and (
      status <> 'deleted'
      or (deleted_at is not null and purge_after = deleted_at + interval '30 days')
    )
  )
);

create index private_question_threads_owner_queue_idx
  on public.private_question_threads (participant_profile_id, program_id, routing_status, created_at desc)
  where status <> 'deleted';
create index private_question_threads_program_queue_idx
  on public.private_question_threads (program_id, routing_status, created_at)
  where status = 'open';

create table public.private_question_answers (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  program_id uuid not null,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  answer_body text not null check (char_length(answer_body) between 1 and 5000),
  visibility text not null default 'private' check (visibility = 'private'),
  status text not null default 'active' check (status in ('active', 'deleted')),
  deleted_at timestamptz,
  deleted_by_profile_id uuid references public.profiles(id) on delete restrict,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (thread_id, program_id)
    references public.private_question_threads (id, program_id) on delete cascade,
  check (
    (status = 'active' and deleted_at is null
      and deleted_by_profile_id is null and purge_after is null)
    or
    (status = 'deleted' and deleted_at is not null
      and deleted_by_profile_id is not null
      and purge_after = deleted_at + interval '30 days')
  )
);

create index private_question_answers_thread_idx
  on public.private_question_answers (thread_id, created_at)
  where status = 'active';

create or replace function private.validate_private_question_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  active_answer_exists boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open' or new.routing_status <> 'unanswered'
      or new.closed_at is not null or new.archived_at is not null
      or new.deleted_at is not null or new.purge_after is not null
      or not private.is_active_program_member(
        new.participant_profile_id, new.program_id, 'participant'
      ) then
      raise exception 'private question must start open, unanswered, and participant-owned'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status in ('archived', 'deleted') then
    raise exception 'archived or deleted private questions are immutable'
      using errcode = '23514';
  end if;
  if new.id is distinct from old.id
    or new.program_id is distinct from old.program_id
    or new.participant_profile_id is distinct from old.participant_profile_id
    or new.content_origin is distinct from old.content_origin
    or new.visibility is distinct from old.visibility
    or new.created_at is distinct from old.created_at then
    raise exception 'private question identity, origin, and visibility are immutable'
      using errcode = '23514';
  end if;
  if new.question_body is distinct from old.question_body and old.status <> 'open' then
    raise exception 'only an open private question may be edited'
      using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status in ('closed', 'archived', 'deleted'))
      or (old.status = 'closed' and new.status in ('archived', 'deleted'))
    ) then
      raise exception 'illegal private-question status transition'
        using errcode = '23514';
    end if;
    if actor <> old.participant_profile_id then
      raise exception 'only the participant owner may close, archive, or delete a question'
        using errcode = '42501';
    end if;
    if new.closed_at is distinct from old.closed_at
      or new.closed_by_profile_id is distinct from old.closed_by_profile_id
      or new.archived_at is distinct from old.archived_at
      or new.archived_by_profile_id is distinct from old.archived_by_profile_id
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by_profile_id is distinct from old.deleted_by_profile_id
      or new.purge_after is distinct from old.purge_after then
      raise exception 'private-question transition metadata is database controlled'
        using errcode = '23514';
    end if;
    if new.status = 'closed' then
      new.closed_at := now();
      new.closed_by_profile_id := old.participant_profile_id;
    elsif new.status = 'archived' then
      new.archived_at := now();
      new.archived_by_profile_id := old.participant_profile_id;
    elsif new.status = 'deleted' then
      new.deleted_at := now();
      new.deleted_by_profile_id := old.participant_profile_id;
      new.purge_after := new.deleted_at + interval '30 days';
    end if;
  elsif new.closed_at is distinct from old.closed_at
    or new.closed_by_profile_id is distinct from old.closed_by_profile_id
    or new.archived_at is distinct from old.archived_at
    or new.archived_by_profile_id is distinct from old.archived_by_profile_id
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by_profile_id is distinct from old.deleted_by_profile_id
    or new.purge_after is distinct from old.purge_after then
    raise exception 'private-question lifecycle metadata is database controlled'
      using errcode = '23514';
  end if;

  if new.routing_status is distinct from old.routing_status then
    select exists (
      select 1 from public.private_question_answers answer
      where answer.thread_id = old.id and answer.status = 'active'
    ) into active_answer_exists;
    if new.routing_status = 'answered' and not active_answer_exists then
      raise exception 'answered routing requires a private answer'
        using errcode = '23514';
    elsif new.routing_status = 'unanswered' and active_answer_exists then
      raise exception 'unanswered routing cannot hide an active private answer'
        using errcode = '23514';
    elsif new.routing_status = 'needs_followup'
      and not private.is_active_named_coach(old.program_id, old.participant_profile_id, actor) then
      raise exception 'only the active named coach may route a question for follow-up'
        using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger private_question_threads_validate
before insert or update on public.private_question_threads
for each row execute function private.validate_private_question_thread();

create or replace function private.validate_private_question_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into thread from public.private_question_threads where id = new.thread_id;
  if thread.id is null or thread.program_id <> new.program_id
    or thread.visibility <> 'private' or thread.status <> 'open' then
    raise exception 'private answer requires an open private thread in the same program'
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'active' or new.deleted_at is not null
      or new.deleted_by_profile_id is not null or new.purge_after is not null then
      raise exception 'private answer must start active without deletion metadata'
        using errcode = '23514';
    end if;
    if new.author_profile_id <> actor
      or not private.is_active_named_coach(
        thread.program_id, thread.participant_profile_id, actor
      ) then
      raise exception 'only the active named coach may answer this private question'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status = 'deleted' then
    raise exception 'deleted private answers are immutable'
      using errcode = '23514';
  end if;
  if new.id is distinct from old.id
    or new.thread_id is distinct from old.thread_id
    or new.program_id is distinct from old.program_id
    or new.author_profile_id is distinct from old.author_profile_id
    or new.visibility is distinct from old.visibility
    or new.created_at is distinct from old.created_at then
    raise exception 'private answer identity and visibility are immutable'
      using errcode = '23514';
  end if;
  if actor <> old.author_profile_id
    or not private.is_active_named_coach(
      thread.program_id, thread.participant_profile_id, actor
    ) then
    raise exception 'only the active named-coach author may edit or delete the answer'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if new.status <> 'deleted' then
      raise exception 'private answers can only transition from active to deleted'
        using errcode = '23514';
    end if;
    new.deleted_at := now();
    new.deleted_by_profile_id := actor;
    new.purge_after := new.deleted_at + interval '30 days';
  elsif new.deleted_at is distinct from old.deleted_at
    or new.deleted_by_profile_id is distinct from old.deleted_by_profile_id
    or new.purge_after is distinct from old.purge_after then
    raise exception 'private-answer deletion metadata is database controlled'
      using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger private_question_answers_validate
before insert or update on public.private_question_answers
for each row execute function private.validate_private_question_answer();

create or replace function private.refresh_private_question_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.private_question_threads thread
  set routing_status = case when exists (
    select 1 from public.private_question_answers answer
    where answer.thread_id = thread.id and answer.status = 'active'
  ) then 'answered' else 'unanswered' end
  where thread.id = coalesce(new.thread_id, old.thread_id)
    and thread.status = 'open';
  return coalesce(new, old);
end;
$$;

create trigger private_question_answers_refresh_routing
after insert or update of status on public.private_question_answers
for each row execute function private.refresh_private_question_routing();

create or replace function public.read_participant_private_question(target_thread uuid)
returns table (
  item_kind text,
  item_id uuid,
  author_profile_id uuid,
  body text,
  created_at timestamptz,
  thread_status text,
  routing_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or thread.status = 'deleted' then
    return;
  end if;
  if thread.participant_profile_id <> actor
    or not private.is_active_program_member(actor, thread.program_id, 'participant') then
    raise exception 'participant private-question projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, actor,
    'sensitive.private_question.participant_read',
    'private_question_thread', thread.id,
    jsonb_build_object('projection', 'participant_private_question', 'thread_id', thread.id)
  );
  return query
  select projected.item_kind, projected.item_id, projected.author_profile_id,
    projected.body, projected.created_at, projected.thread_status, projected.routing_status
  from (
    select 0 as sort_order, 'question'::text as item_kind, thread.id as item_id,
      thread.participant_profile_id as author_profile_id, thread.question_body as body,
      thread.created_at, thread.status as thread_status, thread.routing_status
    union all
    select 1, 'answer'::text, answer.id, answer.author_profile_id, answer.answer_body,
      answer.created_at, thread.status, thread.routing_status
    from public.private_question_answers answer
    where answer.thread_id = thread.id and answer.status = 'active'
  ) projected
  order by projected.sort_order, projected.created_at, projected.item_id;
end;
$$;

create or replace function public.read_named_coach_private_question(target_thread uuid)
returns table (
  item_kind text,
  item_id uuid,
  author_profile_id uuid,
  body text,
  created_at timestamptz,
  thread_status text,
  routing_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or thread.status = 'deleted' then
    return;
  end if;
  if not private.is_active_named_coach(
    thread.program_id, thread.participant_profile_id, actor
  ) then
    raise exception 'named-coach private-question projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, thread.participant_profile_id,
    'sensitive.private_question.named_coach_read',
    'private_question_thread', thread.id,
    jsonb_build_object('projection', 'named_coach_private_question', 'thread_id', thread.id)
  );
  return query
  select projected.item_kind, projected.item_id, projected.author_profile_id,
    projected.body, projected.created_at, projected.thread_status, projected.routing_status
  from (
    select 0 as sort_order, 'question'::text as item_kind, thread.id as item_id,
      thread.participant_profile_id as author_profile_id, thread.question_body as body,
      thread.created_at, thread.status as thread_status, thread.routing_status
    union all
    select 1, 'answer'::text, answer.id, answer.author_profile_id, answer.answer_body,
      answer.created_at, thread.status, thread.routing_status
    from public.private_question_answers answer
    where answer.thread_id = thread.id and answer.status = 'active'
  ) projected
  order by projected.sort_order, projected.created_at, projected.item_id;
end;
$$;

create or replace function private.current_actor_is_private_question_party(
  target_thread uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.private_question_threads thread
    where thread.id = target_thread
      and (
        (
          thread.participant_profile_id = (select auth.uid())
          and private.is_active_program_member(
            (select auth.uid()), thread.program_id, 'participant'
          )
        )
        or private.is_active_named_coach(
          thread.program_id, thread.participant_profile_id, (select auth.uid())
        )
      )
  );
$$;

create or replace function private.current_actor_is_named_coach_for_private_question(
  target_thread uuid,
  target_program uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.private_question_threads thread
    where thread.id = target_thread
      and thread.program_id = target_program
      and private.is_active_named_coach(
        thread.program_id, thread.participant_profile_id, (select auth.uid())
      )
  );
$$;

create or replace function private.current_actor_can_answer_private_question(
  target_thread uuid,
  target_program uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.private_question_threads thread
    where thread.id = target_thread
      and thread.program_id = target_program
      and thread.status = 'open'
      and private.is_active_named_coach(
        thread.program_id, thread.participant_profile_id, (select auth.uid())
      )
  );
$$;

create or replace function public.read_participant_private_question_metadata(
  target_thread uuid
)
returns table (
  thread_id uuid,
  program_id uuid,
  participant_profile_id uuid,
  content_origin text,
  content_sensitivity text,
  thread_status text,
  routing_status text,
  created_at timestamptz,
  updated_at timestamptz,
  active_answer_count bigint,
  latest_answer_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null then
    return;
  end if;
  if thread.participant_profile_id <> actor
    or not private.is_active_program_member(actor, thread.program_id, 'participant') then
    raise exception 'participant private-question metadata projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, actor,
    'sensitive.private_question.participant_metadata_read',
    'private_question_thread', thread.id,
    jsonb_build_object(
      'projection', 'participant_private_question_metadata',
      'thread_id', thread.id
    )
  );
  return query
  select thread.id, thread.program_id, thread.participant_profile_id,
    thread.content_origin, thread.content_sensitivity, thread.status,
    thread.routing_status, thread.created_at, thread.updated_at,
    (select count(*) from public.private_question_answers answer
      where answer.thread_id = thread.id and answer.status = 'active'),
    (select max(answer.created_at) from public.private_question_answers answer
      where answer.thread_id = thread.id and answer.status = 'active');
end;
$$;

create or replace function public.read_named_coach_private_question_metadata(
  target_thread uuid
)
returns table (
  thread_id uuid,
  program_id uuid,
  participant_profile_id uuid,
  content_origin text,
  content_sensitivity text,
  thread_status text,
  routing_status text,
  created_at timestamptz,
  updated_at timestamptz,
  active_answer_count bigint,
  latest_answer_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or thread.status = 'deleted' then
    return;
  end if;
  if not private.is_active_named_coach(
    thread.program_id, thread.participant_profile_id, actor
  ) then
    raise exception 'named-coach private-question metadata projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, thread.participant_profile_id,
    'sensitive.private_question.named_coach_metadata_read',
    'private_question_thread', thread.id,
    jsonb_build_object(
      'projection', 'named_coach_private_question_metadata',
      'thread_id', thread.id
    )
  );
  return query
  select thread.id, thread.program_id, thread.participant_profile_id,
    thread.content_origin, thread.content_sensitivity, thread.status,
    thread.routing_status, thread.created_at, thread.updated_at,
    (select count(*) from public.private_question_answers answer
      where answer.thread_id = thread.id and answer.status = 'active'),
    (select max(answer.created_at) from public.private_question_answers answer
      where answer.thread_id = thread.id and answer.status = 'active');
end;
$$;

create or replace function public.edit_participant_private_question(
  target_thread uuid,
  target_question_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or thread.participant_profile_id <> actor
    or not private.is_active_program_member(actor, thread.program_id, 'participant') then
    raise exception 'participant private-question edit forbidden' using errcode = '42501';
  end if;
  update public.private_question_threads
  set question_body = target_question_body
  where id = thread.id;
end;
$$;

create or replace function public.transition_participant_private_question(
  target_thread uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or thread.participant_profile_id <> actor
    or not private.is_active_program_member(actor, thread.program_id, 'participant') then
    raise exception 'participant private-question transition forbidden' using errcode = '42501';
  end if;
  update public.private_question_threads set status = target_status where id = thread.id;
end;
$$;

create or replace function public.route_named_coach_private_question(
  target_thread uuid,
  target_routing_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into thread from public.private_question_threads where id = target_thread;
  if thread.id is null or not private.is_active_named_coach(
    thread.program_id, thread.participant_profile_id, actor
  ) then
    raise exception 'named-coach private-question routing forbidden' using errcode = '42501';
  end if;
  update public.private_question_threads
  set routing_status = target_routing_status
  where id = thread.id;
end;
$$;

create or replace function public.edit_named_coach_private_answer(
  target_answer uuid,
  target_answer_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer public.private_question_answers;
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into answer from public.private_question_answers where id = target_answer;
  select * into thread from public.private_question_threads where id = answer.thread_id;
  if answer.id is null or answer.author_profile_id <> actor
    or not private.is_active_named_coach(
      thread.program_id, thread.participant_profile_id, actor
    ) then
    raise exception 'named-coach private-answer edit forbidden' using errcode = '42501';
  end if;
  update public.private_question_answers
  set answer_body = target_answer_body
  where id = answer.id;
end;
$$;

create or replace function public.delete_named_coach_private_answer(
  target_answer uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer public.private_question_answers;
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into answer from public.private_question_answers where id = target_answer;
  select * into thread from public.private_question_threads where id = answer.thread_id;
  if answer.id is null or answer.author_profile_id <> actor
    or not private.is_active_named_coach(
      thread.program_id, thread.participant_profile_id, actor
    ) then
    raise exception 'named-coach private-answer deletion forbidden' using errcode = '42501';
  end if;
  update public.private_question_answers set status = 'deleted' where id = answer.id;
end;
$$;

create table public.faq_redaction_proposals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  program_id uuid not null,
  proposed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  redacted_question text not null check (char_length(redacted_question) between 1 and 2000),
  redacted_answer text not null check (char_length(redacted_answer) between 1 and 3000),
  redacted_copy_sha256 text generated always as (
    encode(extensions.digest(redacted_question || chr(31) || redacted_answer, 'sha256'), 'hex')
  ) stored,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by_profile_id uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_control text check (
    review_control is null or review_control = 'named_staff_redaction_review'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (thread_id, program_id)
    references public.private_question_threads (id, program_id) on delete restrict,
  check (
    (review_status = 'pending' and reviewed_by_profile_id is null
      and reviewed_at is null and review_control is null)
    or
    (review_status in ('approved', 'rejected') and reviewed_by_profile_id is not null
      and reviewed_at is not null and review_control = 'named_staff_redaction_review')
  )
);

create index faq_redaction_proposals_thread_idx
  on public.faq_redaction_proposals (thread_id, review_status, created_at desc);

create table public.faq_participant_opt_ins (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.faq_redaction_proposals(id) on delete restrict,
  thread_id uuid not null,
  program_id uuid not null,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  copy_sha256 text not null check (copy_sha256 ~ '^[0-9a-f]{64}$'),
  opted_in_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at timestamptz,
  withdrawn_by_profile_id uuid references public.profiles(id) on delete restrict,
  withdrawal_reason_code text check (
    withdrawal_reason_code is null
    or withdrawal_reason_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  created_at timestamptz not null default now(),
  foreign key (thread_id, program_id)
    references public.private_question_threads (id, program_id) on delete restrict,
  check (
    (status = 'active' and withdrawn_at is null
      and withdrawn_by_profile_id is null and withdrawal_reason_code is null)
    or
    (status = 'withdrawn' and withdrawn_at is not null
      and withdrawn_by_profile_id = participant_profile_id
      and withdrawal_reason_code is not null and withdrawn_at >= opted_in_at)
  )
);

create table public.anonymous_faq_copies (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_thread_id uuid not null,
  source_proposal_id uuid not null unique references public.faq_redaction_proposals(id) on delete restrict,
  participant_opt_in_id uuid not null unique references public.faq_participant_opt_ins(id) on delete restrict,
  question_copy text not null check (char_length(question_copy) between 1 and 2000),
  answer_copy text not null check (char_length(answer_copy) between 1 and 3000),
  audience text not null default 'anonymous' check (audience = 'anonymous'),
  publication_status text not null default 'published'
    check (publication_status in ('published', 'unpublished')),
  published_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unpublished_by_profile_id uuid references public.profiles(id) on delete restrict,
  unpublished_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  foreign key (source_thread_id, program_id)
    references public.private_question_threads (id, program_id) on delete restrict,
  check (
    (publication_status = 'published' and unpublished_by_profile_id is null
      and unpublished_at is null and purge_after is null)
    or
    (publication_status = 'unpublished' and unpublished_by_profile_id is not null
      and unpublished_at is not null and purge_after = unpublished_at + interval '30 days')
  )
);

create or replace function private.validate_faq_redaction_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
begin
  select * into thread from public.private_question_threads where id = new.thread_id;
  if thread.id is null or thread.program_id <> new.program_id
    or thread.status in ('archived', 'deleted')
    or thread.content_origin not in ('general', 'training')
    or not private.is_active_named_coach(thread.program_id, thread.participant_profile_id, actor) then
    raise exception 'FAQ redaction proposal requires a non-sensitive private source and its active named coach'
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.review_status <> 'pending' or new.proposed_by_profile_id <> actor then
      raise exception 'FAQ proposal must start pending under the named proposer'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if old.review_status <> 'pending' then
    raise exception 'reviewed FAQ redaction proposals are immutable'
      using errcode = '23514';
  end if;
  if new.id is distinct from old.id or new.thread_id is distinct from old.thread_id
    or new.program_id is distinct from old.program_id
    or new.proposed_by_profile_id is distinct from old.proposed_by_profile_id
    or new.created_at is distinct from old.created_at then
    raise exception 'FAQ proposal identity and source are immutable'
      using errcode = '23514';
  end if;
  if new.review_status = 'pending' then
    if actor <> old.proposed_by_profile_id then
      raise exception 'only the named proposer may edit a pending redaction'
        using errcode = '42501';
    end if;
  elsif new.review_status in ('approved', 'rejected') then
    new.reviewed_by_profile_id := actor;
    new.reviewed_at := now();
    new.review_control := 'named_staff_redaction_review';
  else
    raise exception 'illegal FAQ review transition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger faq_redaction_proposals_validate
before insert or update on public.faq_redaction_proposals
for each row execute function private.validate_faq_redaction_proposal();

create or replace function private.validate_faq_participant_opt_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.faq_redaction_proposals;
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  withdrawal_time timestamptz;
  faq_id uuid;
  target_organization uuid;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'withdrawn'
      or new.id is distinct from old.id
      or new.proposal_id is distinct from old.proposal_id
      or new.thread_id is distinct from old.thread_id
      or new.program_id is distinct from old.program_id
      or new.participant_profile_id is distinct from old.participant_profile_id
      or new.copy_sha256 is distinct from old.copy_sha256
      or new.opted_in_at is distinct from old.opted_in_at
      or new.created_at is distinct from old.created_at
      or new.status <> 'withdrawn'
      or actor <> old.participant_profile_id then
      raise exception 'FAQ opt-in may only be withdrawn by its participant'
        using errcode = '23514';
    end if;
    withdrawal_time := now();
    new.withdrawn_at := withdrawal_time;
    new.withdrawn_by_profile_id := old.participant_profile_id;
    update public.anonymous_faq_copies
    set publication_status = 'unpublished',
      unpublished_by_profile_id = old.participant_profile_id,
      unpublished_at = withdrawal_time,
      purge_after = withdrawal_time + interval '30 days'
    where participant_opt_in_id = old.id
      and publication_status = 'published'
    returning id into faq_id;
    if faq_id is not null then
      select organization_id into target_organization
      from public.programs where id = old.program_id;
      perform private.record_audit(
        target_organization, old.participant_profile_id, old.participant_profile_id,
        'faq.anonymous_copy.unpublished_by_opt_in_withdrawal',
        'anonymous_faq_copy', faq_id,
        jsonb_build_object(
          'faq_copy_id', faq_id,
          'opt_in_id', old.id,
          'thread_id', old.thread_id,
          'audience', 'anonymous'
        )
      );
    end if;
    return new;
  end if;

  select * into proposal from public.faq_redaction_proposals where id = new.proposal_id;
  select * into thread from public.private_question_threads where id = new.thread_id;
  if proposal.id is null or thread.id is null
    or proposal.thread_id <> thread.id or proposal.program_id <> thread.program_id
    or proposal.review_status <> 'approved'
    or proposal.redacted_copy_sha256 <> new.copy_sha256
    or thread.program_id <> new.program_id
    or thread.participant_profile_id <> new.participant_profile_id
    or thread.content_origin not in ('general', 'training')
    or thread.status in ('archived', 'deleted')
    or new.participant_profile_id <> actor
    or new.status <> 'active'
    or new.opted_in_at > now()
    or not private.is_active_program_member(actor, new.program_id, 'participant') then
    raise exception 'FAQ opt-in must affirm the exact reviewed redacted copy by its participant'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger faq_participant_opt_ins_validate
before insert or update on public.faq_participant_opt_ins
for each row execute function private.validate_faq_participant_opt_in();

create or replace function public.publish_anonymous_faq(
  target_proposal uuid,
  target_opt_in uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.faq_redaction_proposals;
  opt_in public.faq_participant_opt_ins;
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  faq_id uuid;
  target_organization uuid;
begin
  select * into proposal from public.faq_redaction_proposals
  where id = target_proposal for update;
  select * into opt_in from public.faq_participant_opt_ins
  where id = target_opt_in for update;
  select * into thread from public.private_question_threads
  where id = proposal.thread_id for update;
  if proposal.id is null or opt_in.id is null or thread.id is null
    or proposal.review_status <> 'approved'
    or opt_in.proposal_id <> proposal.id
    or opt_in.thread_id <> thread.id
    or opt_in.program_id <> thread.program_id
    or opt_in.participant_profile_id <> thread.participant_profile_id
    or opt_in.status <> 'active'
    or opt_in.copy_sha256 <> proposal.redacted_copy_sha256
    or thread.content_origin not in ('general', 'training')
    or thread.status in ('archived', 'deleted')
    or not private.is_active_named_coach(
      thread.program_id, thread.participant_profile_id, actor
    ) then
    raise exception 'anonymous FAQ publication requires reviewed exact opt-in and active named staff'
      using errcode = '23514';
  end if;
  insert into public.anonymous_faq_copies (
    program_id, source_thread_id, source_proposal_id, participant_opt_in_id,
    question_copy, answer_copy, published_by_profile_id
  ) values (
    thread.program_id, thread.id, proposal.id, opt_in.id,
    proposal.redacted_question, proposal.redacted_answer, actor
  ) returning id into faq_id;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, thread.participant_profile_id,
    'faq.anonymous_copy.published', 'anonymous_faq_copy', faq_id,
    jsonb_build_object('faq_copy_id', faq_id, 'thread_id', thread.id, 'audience', 'anonymous')
  );
  return faq_id;
end;
$$;

create or replace function public.unpublish_anonymous_faq(target_faq uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  faq public.anonymous_faq_copies;
  thread public.private_question_threads;
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  select * into faq from public.anonymous_faq_copies where id = target_faq for update;
  if faq.id is null or faq.publication_status <> 'published' then
    return false;
  end if;
  select * into thread from public.private_question_threads where id = faq.source_thread_id;
  if actor <> thread.participant_profile_id
    and (
      actor <> faq.published_by_profile_id
      or not private.is_active_named_coach(
        thread.program_id, thread.participant_profile_id, actor
      )
    ) then
    raise exception 'anonymous FAQ reversal forbidden' using errcode = '42501';
  end if;
  update public.anonymous_faq_copies
  set publication_status = 'unpublished', unpublished_by_profile_id = actor,
    unpublished_at = now(), purge_after = now() + interval '30 days'
  where id = faq.id;
  select organization_id into target_organization
  from public.programs where id = thread.program_id;
  perform private.record_audit(
    target_organization, actor, thread.participant_profile_id,
    'faq.anonymous_copy.unpublished', 'anonymous_faq_copy', faq.id,
    jsonb_build_object('faq_copy_id', faq.id, 'thread_id', thread.id, 'audience', 'anonymous')
  );
  return true;
end;
$$;

create view public.anonymous_faq_projection
with (security_barrier = true)
as
select id, program_id, question_copy, answer_copy, audience, published_at
from public.anonymous_faq_copies
where publication_status = 'published';

create or replace function private.record_audit(
  target_organization uuid,
  actor_profile uuid,
  subject_profile uuid,
  target_event text,
  target_entity_type text,
  target_entity_id uuid,
  target_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_details jsonb := coalesce(target_details, '{}'::jsonb);
begin
  if not private.audit_details_are_content_free(safe_details) then
    raise exception 'audit details must contain identifiers and event metadata only'
      using errcode = '23514';
  end if;
  insert into public.audit_events (
    organization_id, actor_profile_id, subject_profile_id,
    event_type, entity_type, entity_id, details
  ) values (
    target_organization, actor_profile, subject_profile,
    target_event, target_entity_type, target_entity_id, safe_details
  );
end;
$$;

create or replace function private.validate_audit_event_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_type !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    or new.entity_type !~ '^[a-z][a-z0-9_]{0,79}$' then
    raise exception 'audit event and entity types must be metadata slugs'
      using errcode = '23514';
  end if;
  if not private.audit_details_are_content_free(new.details) then
    raise exception 'audit events cannot store bodies, values, prompts, or payloads'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_events_content_free on public.audit_events;
create trigger audit_events_content_free
before insert or update on public.audit_events
for each row execute function private.validate_audit_event_content();

create table public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in (
    'program_data_processing',
    'named_coach_sensitive_metrics',
    'screenshot_ai',
    'generative_feedback_ai',
    'social_publication',
    'aggregate_analysis_reporting'
  )),
  provider text not null check (char_length(provider) between 2 and 80),
  provider_project_id text check (
    provider_project_id is null
    or provider_project_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  ),
  endpoint text not null check (
    endpoint = '/v1/responses' or endpoint ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  data_classes text[] not null check (
    cardinality(data_classes) > 0 and array_position(data_classes, null) is null
  ),
  stated_purpose text not null check (stated_purpose ~ '^[a-z][a-z0-9_]{2,79}$'),
  recipient text not null check (recipient ~ '^[a-z][a-z0-9_]{2,79}$'),
  recipient_profile_id uuid references public.profiles(id) on delete restrict,
  audience text not null check (audience ~ '^[a-z][a-z0-9_]{2,79}$'),
  control text not null check (control ~ '^[a-z][a-z0-9_]{2,79}$'),
  processor_disclosure text check (
    processor_disclosure is null
    or processor_disclosure ~ '^[a-z][a-z0-9_]{2,119}$'
  ),
  zero_data_retention_control text check (
    zero_data_retention_control is null
    or zero_data_retention_control = 'approved_project_endpoint_zdr'
  ),
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at timestamptz,
  withdrawn_by_profile_id uuid references public.profiles(id) on delete restrict,
  withdrawal_reason_code text check (
    withdrawal_reason_code is null
    or withdrawal_reason_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  created_at timestamptz not null default now(),
  unique (id, program_id, participant_profile_id),
  check (participant_profile_id <> recipient_profile_id),
  check (expires_at > granted_at),
  check (
    (status = 'active' and withdrawn_at is null
      and withdrawn_by_profile_id is null and withdrawal_reason_code is null)
    or
    (status = 'withdrawn' and withdrawn_at is not null
      and withdrawn_by_profile_id is not null and withdrawal_reason_code is not null
      and withdrawn_at >= granted_at)
  ),
  check (
    case purpose
      when 'program_data_processing' then
        provider = 'plus_run_first_party'
        and provider_project_id is null
        and endpoint = 'program_operational_database'
        and data_classes = array['identity', 'enrollment', 'program_activity']::text[]
        and stated_purpose = 'program_data_processing'
        and recipient = 'program_operations'
        and recipient_profile_id is null
        and audience = 'participant_and_program_operations'
        and control = 'participant_withdrawal'
        and processor_disclosure is null
        and zero_data_retention_control is null
      when 'named_coach_sensitive_metrics' then
        provider = 'plus_run_first_party'
        and provider_project_id is null
        and endpoint = 'audited_sensitive_metric_projection'
        and data_classes = array['activity_metrics', 'health_metrics', 'pain_metrics']::text[]
        and stated_purpose = 'named_coach_sensitive_metrics'
        and recipient = 'named_coach'
        and recipient_profile_id is not null
        and audience = 'participant_and_named_coach'
        and control = 'participant_revocable_named_grant'
        and processor_disclosure is null
        and zero_data_retention_control is null
      when 'screenshot_ai' then
        provider = 'openai'
        and provider_project_id is not null
        and endpoint = '/v1/responses'
        and data_classes = array['server_sanitized_screenshot_pixels', 'reviewable_metric_draft']::text[]
        and stated_purpose = 'screenshot_metric_draft_extraction'
        and recipient = 'openai'
        and recipient_profile_id is null
        and audience = 'processor_for_participant_draft_only'
        and control = 'per_request_participant_review'
        and processor_disclosure = 'openai_subprocessor_disclosed'
        and zero_data_retention_control = 'approved_project_endpoint_zdr'
      when 'generative_feedback_ai' then
        provider = 'openai'
        and provider_project_id is not null
        and endpoint = '/v1/responses'
        and data_classes = array['approved_nonsensitive_training_context', 'feedback_draft']::text[]
        and stated_purpose = 'generative_feedback_draft_creation'
        and recipient = 'openai'
        and recipient_profile_id is null
        and audience = 'processor_and_named_coach_review'
        and control = 'named_coach_review_required'
        and processor_disclosure = 'openai_subprocessor_disclosed'
        and zero_data_retention_control = 'approved_project_endpoint_zdr'
      when 'social_publication' then
        provider = 'plus_run_first_party'
        and provider_project_id is null
        and endpoint = 'program_social_feed'
        and data_classes = array['low_information_social_content']::text[]
        and stated_purpose = 'social_publication'
        and recipient = 'program_cohort'
        and recipient_profile_id is null
        and audience = 'program_cohort'
        and control = 'explicit_per_post_publication'
        and processor_disclosure is null
        and zero_data_retention_control is null
      when 'aggregate_analysis_reporting' then
        provider = 'plus_run_first_party'
        and provider_project_id is null
        and endpoint = 'suppressed_aggregate_report'
        and data_classes = array['deidentified_aggregate_metrics']::text[]
        and stated_purpose = 'aggregate_analysis_reporting'
        and recipient = 'authorized_aggregate_recipients'
        and recipient_profile_id is null
        and audience = 'suppressed_aggregate_only'
        and control = 'participant_analysis_inclusion'
        and processor_disclosure is null
        and zero_data_retention_control is null
      else false
    end
  )
);

create unique index consent_grants_one_unwithdrawn_purpose_idx
  on public.consent_grants (program_id, participant_profile_id, purpose)
  where status = 'active';
create index consent_grants_active_lookup_idx
  on public.consent_grants (program_id, participant_profile_id, purpose, expires_at)
  where status = 'active';

create table public.named_coach_grants (
  id uuid primary key default gen_random_uuid(),
  consent_grant_id uuid not null unique references public.consent_grants(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at timestamptz,
  withdrawn_by_profile_id uuid references public.profiles(id) on delete restrict,
  withdrawal_reason_code text check (
    withdrawal_reason_code is null
    or withdrawal_reason_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  created_at timestamptz not null default now(),
  unique (id, program_id, participant_profile_id, coach_profile_id),
  check (participant_profile_id <> coach_profile_id),
  check (expires_at > granted_at),
  check (
    (status = 'active' and withdrawn_at is null
      and withdrawn_by_profile_id is null and withdrawal_reason_code is null)
    or
    (status = 'withdrawn' and withdrawn_at is not null
      and withdrawn_by_profile_id is not null and withdrawal_reason_code is not null
      and withdrawn_at >= granted_at)
  )
);

create unique index named_coach_grants_one_unwithdrawn_idx
  on public.named_coach_grants (program_id, participant_profile_id, coach_profile_id)
  where status = 'active';
create index named_coach_grants_active_lookup_idx
  on public.named_coach_grants (program_id, participant_profile_id, coach_profile_id, expires_at)
  where status = 'active';

alter table public.metric_consents
  add column consent_grant_id uuid references public.consent_grants(id) on delete restrict,
  add column named_coach_grant_id uuid references public.named_coach_grants(id) on delete restrict;

create index metric_consents_privacy_bridge_idx
  on public.metric_consents (metric_record_id, grantee_profile_id, consent_grant_id, named_coach_grant_id)
  where revoked_at is null;

create or replace function private.validate_consent_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'withdrawn' then
      raise exception 'withdrawn consent grants are immutable; create a new affirmative grant'
        using errcode = '23514';
    end if;
    if new.program_id is distinct from old.program_id
      or new.participant_profile_id is distinct from old.participant_profile_id
      or new.purpose is distinct from old.purpose
      or new.provider is distinct from old.provider
      or new.provider_project_id is distinct from old.provider_project_id
      or new.endpoint is distinct from old.endpoint
      or new.data_classes is distinct from old.data_classes
      or new.stated_purpose is distinct from old.stated_purpose
      or new.recipient is distinct from old.recipient
      or new.recipient_profile_id is distinct from old.recipient_profile_id
      or new.audience is distinct from old.audience
      or new.control is distinct from old.control
      or new.processor_disclosure is distinct from old.processor_disclosure
      or new.zero_data_retention_control is distinct from old.zero_data_retention_control
      or new.granted_at is distinct from old.granted_at
      or new.expires_at is distinct from old.expires_at
      or new.created_at is distinct from old.created_at then
      raise exception 'consent grant contract fields are immutable; withdraw and create a new grant'
        using errcode = '23514';
    end if;
    if new.status <> 'withdrawn'
      or new.withdrawn_by_profile_id <> new.participant_profile_id then
      raise exception 'the participant may only withdraw an active consent grant'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status <> 'active' or new.granted_at > now() or new.expires_at <= now() then
    raise exception 'a new consent must be an active affirmative grant with a future expiry'
      using errcode = '23514';
  end if;
  if not private.is_active_program_member(
    new.participant_profile_id, new.program_id, 'participant'
  ) then
    raise exception 'consent participant must be active in the current program and organization'
      using errcode = '23514';
  end if;
  if new.purpose = 'named_coach_sensitive_metrics'
    and not private.is_active_program_member(
      new.recipient_profile_id, new.program_id, 'coach'
    ) then
    raise exception 'named sensitive-metrics recipient must be an active coach in the same program'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger consent_grants_validate
before insert or update on public.consent_grants
for each row execute function private.validate_consent_grant();

create or replace function private.audit_consent_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  target_event text;
begin
  select organization_id into target_organization
  from public.programs where id = new.program_id;
  target_event := case when tg_op = 'INSERT'
    then 'consent.' || new.purpose || '.granted'
    else 'consent.' || new.purpose || '.withdrawn'
  end;
  perform private.record_audit(
    target_organization,
    new.participant_profile_id,
    new.participant_profile_id,
    target_event,
    'consent_grant',
    new.id,
    jsonb_build_object(
      'consent_grant_id', new.id,
      'purpose', new.purpose,
      'recipient_profile_id', new.recipient_profile_id
    )
  );
  return new;
end;
$$;

create trigger consent_grants_audit
after insert or update on public.consent_grants
for each row execute function private.audit_consent_grant();

create or replace function private.validate_named_coach_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent public.consent_grants;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'withdrawn' then
      raise exception 'withdrawn named-coach grants are immutable'
        using errcode = '23514';
    end if;
    if new.consent_grant_id is distinct from old.consent_grant_id
      or new.program_id is distinct from old.program_id
      or new.participant_profile_id is distinct from old.participant_profile_id
      or new.coach_profile_id is distinct from old.coach_profile_id
      or new.granted_at is distinct from old.granted_at
      or new.expires_at is distinct from old.expires_at
      or new.created_at is distinct from old.created_at then
      raise exception 'named-coach grant fields are immutable; withdraw and create a new grant'
        using errcode = '23514';
    end if;
    if new.status <> 'withdrawn'
      or new.withdrawn_by_profile_id <> new.participant_profile_id then
      raise exception 'the participant may only withdraw an active named-coach grant'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select * into consent from public.consent_grants where id = new.consent_grant_id;
  if consent.id is null
    or consent.purpose <> 'named_coach_sensitive_metrics'
    or consent.program_id <> new.program_id
    or consent.participant_profile_id <> new.participant_profile_id
    or consent.recipient_profile_id <> new.coach_profile_id
    or consent.status <> 'active'
    or consent.expires_at <= now()
    or new.status <> 'active'
    or new.granted_at < consent.granted_at
    or new.expires_at > consent.expires_at
    or new.expires_at <= now() then
    raise exception 'named-coach grant must match an active sensitive-metrics consent'
      using errcode = '23514';
  end if;
  if not private.is_active_program_member(
    new.coach_profile_id, new.program_id, 'coach'
  ) then
    raise exception 'named coach must be active in the same program and organization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger named_coach_grants_validate
before insert or update on public.named_coach_grants
for each row execute function private.validate_named_coach_grant();

create or replace function private.audit_named_coach_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
begin
  select organization_id into target_organization
  from public.programs where id = new.program_id;
  perform private.record_audit(
    target_organization,
    new.participant_profile_id,
    new.participant_profile_id,
    case when tg_op = 'INSERT'
      then 'named_coach.granted' else 'named_coach.withdrawn' end,
    'named_coach_grant',
    new.id,
    jsonb_build_object(
      'consent_grant_id', new.consent_grant_id,
      'named_coach_grant_id', new.id,
      'coach_profile_id', new.coach_profile_id
    )
  );
  return new;
end;
$$;

create trigger named_coach_grants_audit
after insert or update on public.named_coach_grants
for each row execute function private.audit_named_coach_grant();

create or replace function private.has_active_consent(
  target_program uuid,
  target_participant uuid,
  target_purpose text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_program_member(target_participant, target_program, 'participant')
    and exists (
      select 1 from public.consent_grants consent
      where consent.program_id = target_program
        and consent.participant_profile_id = target_participant
        and consent.purpose = target_purpose
        and consent.status = 'active'
        and consent.expires_at > now()
    );
$$;

create or replace function private.has_active_ai_consent(
  target_program uuid,
  target_participant uuid,
  target_purpose text,
  expected_provider text,
  expected_provider_project_id text,
  expected_endpoint text,
  expected_data_classes text[],
  expected_zero_data_retention_control text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_purpose in ('screenshot_ai', 'generative_feedback_ai')
    and private.is_active_program_member(target_participant, target_program, 'participant')
    and exists (
      select 1 from public.consent_grants consent
      where consent.program_id = target_program
        and consent.participant_profile_id = target_participant
        and consent.purpose = target_purpose
        and consent.provider = expected_provider
        and consent.provider_project_id = expected_provider_project_id
        and consent.endpoint = expected_endpoint
        and consent.data_classes = expected_data_classes
        and consent.zero_data_retention_control = expected_zero_data_retention_control
        and consent.processor_disclosure is not null
        and consent.status = 'active'
        and consent.expires_at > now()
    );
$$;

revoke all on function private.has_active_ai_consent(
  uuid, uuid, text, text, text, text, text[], text
) from public, anon, authenticated;

create or replace function private.validate_metric_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metric public.metric_records;
  consent public.consent_grants;
  coach_grant public.named_coach_grants;
begin
  if tg_op = 'UPDATE' then
    if old.revoked_at is not null then
      raise exception 'revoked consent rows are immutable; create a new grant'
        using errcode = '23514';
    end if;
    if new.metric_record_id is distinct from old.metric_record_id
      or new.owner_profile_id is distinct from old.owner_profile_id
      or new.grantee_profile_id is distinct from old.grantee_profile_id
      or new.grantee_role is distinct from old.grantee_role
      or new.purpose is distinct from old.purpose
      or new.granted_at is distinct from old.granted_at
      or new.expires_at is distinct from old.expires_at
      or new.consent_grant_id is distinct from old.consent_grant_id
      or new.named_coach_grant_id is distinct from old.named_coach_grant_id
      or (old.revoked_at is null and new.revoked_at is null
        and new.revocation_reason is distinct from old.revocation_reason) then
      raise exception 'metric-consent grant fields are immutable; revoke and create a new grant'
        using errcode = '23514';
    end if;
    if old.revoked_at is null and new.revoked_at is not null then
      return new;
    end if;
    raise exception 'metric consent update must be a one-way revocation'
      using errcode = '23514';
  end if;

  if new.consent_grant_id is null or new.named_coach_grant_id is null
    or new.grantee_role <> 'coach'
    or new.purpose <> 'named_coach_sensitive_metrics'
    or new.expires_at <= now() then
    raise exception 'new metric consent requires the canonical named-coach consent bridge'
      using errcode = '23514';
  end if;
  select * into metric from public.metric_records where id = new.metric_record_id;
  select * into consent from public.consent_grants where id = new.consent_grant_id;
  select * into coach_grant from public.named_coach_grants where id = new.named_coach_grant_id;
  if metric.id is null
    or metric.owner_profile_id <> new.owner_profile_id
    or consent.id is null
    or consent.program_id <> metric.program_id
    or consent.participant_profile_id <> new.owner_profile_id
    or consent.purpose <> 'named_coach_sensitive_metrics'
    or consent.recipient_profile_id <> new.grantee_profile_id
    or consent.status <> 'active'
    or consent.expires_at <= now()
    or coach_grant.id is null
    or coach_grant.consent_grant_id <> consent.id
    or coach_grant.program_id <> metric.program_id
    or coach_grant.participant_profile_id <> new.owner_profile_id
    or coach_grant.coach_profile_id <> new.grantee_profile_id
    or coach_grant.status <> 'active'
    or coach_grant.expires_at <= now()
    or new.expires_at > least(consent.expires_at, coach_grant.expires_at) then
    raise exception 'metric consent must match the active participant, program, consent, and named coach'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.can_read_metric(target_metric uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.metric_records metric
    where metric.id = target_metric
      and (
        metric.owner_profile_id = (select auth.uid())
        or exists (
          select 1
          from public.metric_consents metric_consent
          join public.consent_grants consent
            on consent.id = metric_consent.consent_grant_id
          join public.named_coach_grants coach_grant
            on coach_grant.id = metric_consent.named_coach_grant_id
          where metric_consent.metric_record_id = metric.id
            and metric_consent.owner_profile_id = metric.owner_profile_id
            and metric_consent.grantee_profile_id = (select auth.uid())
            and metric_consent.grantee_role = 'coach'
            and metric_consent.purpose = 'named_coach_sensitive_metrics'
            and metric_consent.revoked_at is null
            and metric_consent.expires_at > now()
            and consent.program_id = metric.program_id
            and consent.participant_profile_id = metric.owner_profile_id
            and consent.purpose = 'named_coach_sensitive_metrics'
            and consent.recipient_profile_id = (select auth.uid())
            and consent.status = 'active'
            and consent.expires_at > now()
            and coach_grant.consent_grant_id = consent.id
            and coach_grant.program_id = metric.program_id
            and coach_grant.participant_profile_id = metric.owner_profile_id
            and coach_grant.coach_profile_id = (select auth.uid())
            and coach_grant.status = 'active'
            and coach_grant.expires_at > now()
            and private.is_active_named_coach(
              metric.program_id, metric.owner_profile_id, (select auth.uid())
            )
        )
      )
  );
$$;

create or replace function public.read_participant_sensitive_metrics(target_program uuid)
returns table (
  metric_record_id uuid,
  metric_type text,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  source text,
  sensitivity text,
  verification_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  if not private.is_active_program_member(actor, target_program, 'participant') then
    raise exception 'participant sensitive-metric projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = target_program;
  perform private.record_audit(
    target_organization, actor, actor,
    'sensitive.metric_projection.participant_read',
    'metric_projection', target_program,
    jsonb_build_object('projection', 'participant_sensitive_metrics', 'program_id', target_program)
  );
  return query
  select metric.id, metric.metric_type, metric.numeric_value, metric.unit,
    metric.observed_at, metric.source, metric.sensitivity, metric.verification_status
  from public.metric_records metric
  where metric.program_id = target_program
    and metric.owner_profile_id = actor
  order by metric.observed_at desc nulls last, metric.id;
end;
$$;

alter table public.feed_posts
  add column audience_preview text not null default 'program_cohort',
  add column publication_source text not null default 'explicit_user',
  add column content_origin text not null default 'social',
  add column content_sensitivity text generated always as (
    case when content_origin in ('health', 'reflection', 'pain')
      then 'sensitive' else 'nonsensitive' end
  ) stored,
  add column edited_at timestamptz,
  add column moderation_state text not null default 'visible',
  add column moderated_by_profile_id uuid references public.profiles(id) on delete restrict,
  add column moderated_at timestamptz,
  add column moderation_reason_code text,
  add column delete_state text not null default 'active',
  add column purge_after timestamptz,
  add column purged_at timestamptz;

update public.feed_posts post
set content_origin = coalesce((
  select case assignment.assignment_kind
    when 'running' then 'achievement'
    when 'health' then 'health'
    when 'reflection' then 'reflection'
  end
  from public.homework_submissions submission
  join public.assignments assignment on assignment.id = submission.assignment_id
  where submission.id = post.submission_id
    and submission.program_id = post.program_id
    and submission.participant_id = post.author_profile_id
), 'reflection')
where post.submission_id is not null;

update public.feed_posts
set body = '[quarantined sensitive source]'
where content_sensitivity = 'sensitive';

update public.feed_comments comment
set body = '[quarantined sensitive source]'
where exists (
  select 1
  from public.feed_posts post
  where post.id = comment.post_id
    and post.content_sensitivity = 'sensitive'
);

alter table public.feed_comments
  add column content_origin text not null default 'social',
  add column content_sensitivity text generated always as (
    case when content_origin in ('health', 'reflection', 'pain')
      then 'sensitive' else 'nonsensitive' end
  ) stored,
  add column edited_at timestamptz,
  add column moderation_state text not null default 'visible',
  add column moderated_by_profile_id uuid references public.profiles(id) on delete restrict,
  add column moderated_at timestamptz,
  add column moderation_reason_code text,
  add column delete_state text not null default 'active',
  add column purge_after timestamptz,
  add column purged_at timestamptz;

create table public.feed_share_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  share_method text not null check (share_method in ('native', 'clipboard')),
  audience_preview text not null check (
    audience_preview in ('program_cohort', 'named_program_staff')
  ),
  created_at timestamptz not null default now(),
  unique (post_id, actor_profile_id, share_method, created_at)
);

create index feed_share_events_post_time_idx
  on public.feed_share_events (post_id, created_at desc);

create or replace function private.validate_feed_post_privacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  return new;
end;
$$;

create or replace function private.validate_feed_comment_privacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  return new;
end;
$$;

create or replace function private.enforce_notification_metadata_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  return new;
end;
$$;

create or replace function public.read_named_coach_sensitive_metrics(
  target_program uuid,
  target_participant uuid
)
returns table (
  metric_record_id uuid,
  metric_type text,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  source text,
  sensitivity text,
  verification_status text
)
language plpgsql security definer set search_path = '' as $$
begin
  return;
end;
$$;

alter table public.consent_grants enable row level security;
alter table public.named_coach_grants enable row level security;
alter table public.private_question_threads enable row level security;
alter table public.private_question_answers enable row level security;
alter table public.faq_redaction_proposals enable row level security;
alter table public.faq_participant_opt_ins enable row level security;
alter table public.anonymous_faq_copies enable row level security;
alter table public.feed_share_events enable row level security;

revoke select on public.metric_records, public.homework_submissions,
  public.data_uploads, public.feedback_items, public.resting_heart_rate_readings,
  public.assessment_attempts, public.assessment_attempt_conditions,
  public.private_question_threads, public.private_question_answers
from anon, authenticated;
revoke select on public.private_question_threads, public.private_question_answers
  from public;
revoke delete on public.feed_posts, public.feed_comments from anon, authenticated;
revoke update, delete on public.private_question_threads, public.private_question_answers
  from public, anon, authenticated;
revoke all on public.anonymous_faq_copies from public, anon, authenticated;

drop policy if exists metrics_consent_select on public.metric_records;
drop policy if exists submissions_select_owner_staff on public.homework_submissions;
drop policy if exists feedback_select_participant_staff on public.feedback_items;
drop policy if exists screenshots_owner_select on storage.objects;
drop policy if exists health_imports_owner_select on storage.objects;

grant select, insert, update on public.consent_grants, public.named_coach_grants
  to authenticated;
grant insert on public.private_question_threads, public.private_question_answers
  to authenticated;
grant select, insert, update on public.faq_redaction_proposals,
  public.faq_participant_opt_ins to authenticated;
grant select, insert on public.feed_share_events to authenticated;
grant select on public.anonymous_faq_projection to anon, authenticated;

drop policy if exists consent_grants_select_parties on public.consent_grants;
create policy consent_grants_select_parties
on public.consent_grants for select to authenticated using (
  participant_profile_id = (select auth.uid())
  or (
    purpose = 'named_coach_sensitive_metrics'
    and recipient_profile_id = (select auth.uid())
    and private.is_active_program_member((select auth.uid()), program_id, 'coach')
  )
);
drop policy if exists consent_grants_insert_participant on public.consent_grants;
create policy consent_grants_insert_participant
on public.consent_grants for insert to authenticated with check (
  participant_profile_id = (select auth.uid())
  and status = 'active'
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists consent_grants_withdraw_participant on public.consent_grants;
create policy consent_grants_withdraw_participant
on public.consent_grants for update to authenticated using (
  participant_profile_id = (select auth.uid()) and status = 'active'
) with check (
  participant_profile_id = (select auth.uid())
  and status = 'withdrawn'
  and withdrawn_by_profile_id = (select auth.uid())
);

drop policy if exists named_coach_grants_select_parties on public.named_coach_grants;
create policy named_coach_grants_select_parties
on public.named_coach_grants for select to authenticated using (
  participant_profile_id = (select auth.uid())
  or (
    coach_profile_id = (select auth.uid())
    and private.is_active_program_member((select auth.uid()), program_id, 'coach')
  )
);
drop policy if exists named_coach_grants_insert_participant on public.named_coach_grants;
create policy named_coach_grants_insert_participant
on public.named_coach_grants for insert to authenticated with check (
  participant_profile_id = (select auth.uid())
  and status = 'active'
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists named_coach_grants_withdraw_participant on public.named_coach_grants;
create policy named_coach_grants_withdraw_participant
on public.named_coach_grants for update to authenticated using (
  participant_profile_id = (select auth.uid()) and status = 'active'
) with check (
  participant_profile_id = (select auth.uid())
  and status = 'withdrawn'
  and withdrawn_by_profile_id = (select auth.uid())
);

drop policy if exists private_question_threads_select_parties on public.private_question_threads;
drop policy if exists private_question_threads_insert_owner on public.private_question_threads;
create policy private_question_threads_insert_owner
on public.private_question_threads for insert to authenticated with check (
  participant_profile_id = (select auth.uid())
  and visibility = 'private' and status = 'open' and routing_status = 'unanswered'
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists private_question_threads_update_owner on public.private_question_threads;
create policy private_question_threads_update_owner
on public.private_question_threads for update to authenticated using (
  participant_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
) with check (participant_profile_id = (select auth.uid()) and visibility = 'private');
drop policy if exists private_question_threads_route_named_coach on public.private_question_threads;
create policy private_question_threads_route_named_coach
on public.private_question_threads for update to authenticated using (
  private.is_active_named_coach(program_id, participant_profile_id, (select auth.uid()))
) with check (
  private.is_active_named_coach(program_id, participant_profile_id, (select auth.uid()))
  and visibility = 'private'
);

drop policy if exists private_question_answers_select_parties on public.private_question_answers;
drop policy if exists private_question_answers_insert_named_coach on public.private_question_answers;
create policy private_question_answers_insert_named_coach
on public.private_question_answers for insert to authenticated with check (
  author_profile_id = (select auth.uid()) and visibility = 'private'
  and private.current_actor_can_answer_private_question(thread_id, program_id)
);
drop policy if exists private_question_answers_update_author on public.private_question_answers;
create policy private_question_answers_update_author
on public.private_question_answers for update to authenticated using (
  author_profile_id = (select auth.uid())
) with check (author_profile_id = (select auth.uid()) and visibility = 'private');

drop policy if exists faq_redaction_proposals_select_parties on public.faq_redaction_proposals;
create policy faq_redaction_proposals_select_parties
on public.faq_redaction_proposals for select to authenticated using (
  private.current_actor_is_private_question_party(thread_id)
);
drop policy if exists faq_redaction_proposals_insert_named_coach on public.faq_redaction_proposals;
create policy faq_redaction_proposals_insert_named_coach
on public.faq_redaction_proposals for insert to authenticated with check (
  proposed_by_profile_id = (select auth.uid())
  and private.current_actor_is_named_coach_for_private_question(thread_id, program_id)
);
drop policy if exists faq_redaction_proposals_update_named_coach on public.faq_redaction_proposals;
create policy faq_redaction_proposals_update_named_coach
on public.faq_redaction_proposals for update to authenticated using (
  private.current_actor_is_named_coach_for_private_question(thread_id, program_id)
) with check (
  private.current_actor_is_named_coach_for_private_question(thread_id, program_id)
);

drop policy if exists faq_participant_opt_ins_select_parties on public.faq_participant_opt_ins;
create policy faq_participant_opt_ins_select_parties
on public.faq_participant_opt_ins for select to authenticated using (
  participant_profile_id = (select auth.uid())
  or private.is_active_named_coach(program_id, participant_profile_id, (select auth.uid()))
);
drop policy if exists faq_participant_opt_ins_insert_participant on public.faq_participant_opt_ins;
create policy faq_participant_opt_ins_insert_participant
on public.faq_participant_opt_ins for insert to authenticated with check (
  participant_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists faq_participant_opt_ins_withdraw_participant on public.faq_participant_opt_ins;
create policy faq_participant_opt_ins_withdraw_participant
on public.faq_participant_opt_ins for update to authenticated using (
  participant_profile_id = (select auth.uid()) and status = 'active'
) with check (
  participant_profile_id = (select auth.uid()) and status = 'withdrawn'
);

drop policy if exists feed_posts_select_member on public.feed_posts;
create policy feed_posts_select_member
on public.feed_posts for select to authenticated using (
  (
    author_profile_id = (select auth.uid())
    and content_sensitivity = 'nonsensitive'
    and private.is_active_program_member((select auth.uid()), program_id, 'participant')
  )
  or (
    delete_state = 'active'
    and content_sensitivity = 'nonsensitive'
    and moderation_state = 'visible' and visibility = 'cohort'
    and (
      private.is_active_program_member((select auth.uid()), program_id, 'participant')
      or private.is_active_program_member((select auth.uid()), program_id, 'coach')
      or private.is_active_program_member((select auth.uid()), program_id, 'admin')
    )
  )
  or (
    content_sensitivity = 'nonsensitive'
    and (
      private.is_active_program_member((select auth.uid()), program_id, 'coach')
      or private.is_active_program_member((select auth.uid()), program_id, 'admin')
    )
  )
);
drop policy if exists feed_posts_insert_member on public.feed_posts;
create policy feed_posts_insert_member
on public.feed_posts for insert to authenticated with check (
  author_profile_id = (select auth.uid())
  and (
    private.is_active_program_member((select auth.uid()), program_id, 'participant')
    or private.is_active_program_member((select auth.uid()), program_id, 'coach')
    or private.is_active_program_member((select auth.uid()), program_id, 'admin')
  )
);
drop policy if exists feed_posts_update_author on public.feed_posts;
create policy feed_posts_update_author
on public.feed_posts for update to authenticated using (
  author_profile_id = (select auth.uid())
  and (
    private.is_active_program_member((select auth.uid()), program_id, 'participant')
    or private.is_active_program_member((select auth.uid()), program_id, 'coach')
    or private.is_active_program_member((select auth.uid()), program_id, 'admin')
  )
) with check (author_profile_id = (select auth.uid()));
drop policy if exists feed_posts_moderate_staff on public.feed_posts;
create policy feed_posts_moderate_staff
on public.feed_posts for update to authenticated using (
  private.is_active_program_member((select auth.uid()), program_id, 'coach')
  or private.is_active_program_member((select auth.uid()), program_id, 'admin')
) with check (
  private.is_active_program_member((select auth.uid()), program_id, 'coach')
  or private.is_active_program_member((select auth.uid()), program_id, 'admin')
);
drop policy if exists feed_posts_delete_author on public.feed_posts;

drop policy if exists feed_comments_select_post_member on public.feed_comments;
create policy feed_comments_select_post_member
on public.feed_comments for select to authenticated using (
  (
    author_profile_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts post
      where post.id = post_id
        and (
          post.content_sensitivity = 'nonsensitive'
        )
    )
  )
  or (
    delete_state = 'active' and moderation_state = 'visible'
    and exists (
      select 1 from public.feed_posts post
      where post.id = post_id and post.delete_state = 'active'
        and post.content_sensitivity = 'nonsensitive'
        and (
          private.is_active_program_member((select auth.uid()), post.program_id, 'participant')
          or private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
          or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
        )
    )
  )
  or exists (
    select 1 from public.feed_posts post
    where post.id = post_id
      and post.content_sensitivity = 'nonsensitive'
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
      )
  )
);
drop policy if exists feed_comments_insert_member on public.feed_comments;
create policy feed_comments_insert_member
on public.feed_comments for insert to authenticated with check (
  author_profile_id = (select auth.uid()) and exists (
    select 1 from public.feed_posts post
    where post.id = post_id and post.delete_state = 'active'
      and post.content_sensitivity = 'nonsensitive'
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'participant')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
      )
  )
);
drop policy if exists feed_comments_update_author on public.feed_comments;
create policy feed_comments_update_author
on public.feed_comments for update to authenticated using (
  author_profile_id = (select auth.uid())
) with check (author_profile_id = (select auth.uid()));
drop policy if exists feed_comments_moderate_staff on public.feed_comments;
create policy feed_comments_moderate_staff
on public.feed_comments for update to authenticated using (
  exists (
    select 1 from public.feed_posts post
    where post.id = post_id
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
      )
  )
) with check (
  exists (
    select 1 from public.feed_posts post
    where post.id = post_id
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
      )
  )
);
drop policy if exists feed_comments_delete_author on public.feed_comments;

drop policy if exists feed_reactions_select_post_member on public.feed_reactions;
create policy feed_reactions_select_post_member
on public.feed_reactions for select to authenticated using (
  exists (
    select 1 from public.feed_posts post
    where post.id = post_id
      and post.content_sensitivity = 'nonsensitive'
      and post.delete_state = 'active' and post.moderation_state = 'visible'
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'participant')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
      )
  )
);
drop policy if exists feed_reactions_insert_self on public.feed_reactions;
create policy feed_reactions_insert_self
on public.feed_reactions for insert to authenticated with check (
  author_profile_id = (select auth.uid()) and exists (
    select 1 from public.feed_posts post
    where post.id = post_id and post.delete_state = 'active' and post.moderation_state = 'visible'
      and post.content_sensitivity = 'nonsensitive'
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
        or (
          private.is_active_program_member((select auth.uid()), post.program_id, 'participant')
          and private.has_active_consent(post.program_id, (select auth.uid()), 'social_publication')
        )
      )
  )
);

drop policy if exists feed_share_events_select_scoped on public.feed_share_events;
create policy feed_share_events_select_scoped
on public.feed_share_events for select to authenticated using (
  exists (
    select 1 from public.feed_posts post
    where post.id = post_id and post.content_sensitivity = 'nonsensitive'
      and (
        actor_profile_id = (select auth.uid())
        or post.author_profile_id = (select auth.uid())
      )
  )
);
drop policy if exists feed_share_events_insert_self on public.feed_share_events;
create policy feed_share_events_insert_self
on public.feed_share_events for insert to authenticated with check (
  actor_profile_id = (select auth.uid()) and exists (
    select 1 from public.feed_posts post
    where post.id = post_id and post.delete_state = 'active'
      and post.content_sensitivity = 'nonsensitive'
      and audience_preview = post.audience_preview
      and (
        private.is_active_program_member((select auth.uid()), post.program_id, 'coach')
        or private.is_active_program_member((select auth.uid()), post.program_id, 'admin')
        or (
          private.is_active_program_member((select auth.uid()), post.program_id, 'participant')
          and private.has_active_consent(post.program_id, (select auth.uid()), 'social_publication')
        )
      )
  )
);

drop policy if exists consents_insert_owner on public.metric_consents;
create policy consents_insert_owner
on public.metric_consents for insert to authenticated with check (
  owner_profile_id = (select auth.uid())
);

drop policy if exists metrics_owner_insert on public.metric_records;
create policy metrics_owner_insert
on public.metric_records for insert to authenticated with check (
  owner_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists metrics_owner_update on public.metric_records;
create policy metrics_owner_update
on public.metric_records for update to authenticated using (
  owner_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
) with check (
  owner_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);
drop policy if exists metrics_owner_delete on public.metric_records;
create policy metrics_owner_delete
on public.metric_records for delete to authenticated using (
  owner_profile_id = (select auth.uid())
  and private.is_active_program_member((select auth.uid()), program_id, 'participant')
);

revoke all on function private.is_active_program_member(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.audit_details_are_content_free(jsonb)
  from public, anon, authenticated;
revoke all on function private.validate_audit_event_content()
  from public, anon, authenticated;
revoke all on function private.validate_consent_grant()
  from public, anon, authenticated;
revoke all on function private.audit_consent_grant()
  from public, anon, authenticated;
revoke all on function private.validate_named_coach_grant()
  from public, anon, authenticated;
revoke all on function private.audit_named_coach_grant()
  from public, anon, authenticated;
revoke all on function private.is_active_named_coach(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.has_active_consent(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.can_read_metric(uuid)
  from public, anon, authenticated;
revoke all on function private.validate_private_question_thread()
  from public, anon, authenticated;
revoke all on function private.validate_private_question_answer()
  from public, anon, authenticated;
revoke all on function private.refresh_private_question_routing()
  from public, anon, authenticated;
revoke all on function private.validate_faq_redaction_proposal()
  from public, anon, authenticated;
revoke all on function private.validate_faq_participant_opt_in()
  from public, anon, authenticated;
revoke all on function private.validate_feed_post_privacy()
  from public, anon, authenticated;
revoke all on function private.validate_feed_comment_privacy()
  from public, anon, authenticated;
revoke all on function private.enforce_notification_metadata_only()
  from public, anon, authenticated;
revoke all on function private.current_actor_is_private_question_party(uuid)
  from public, anon, authenticated;
revoke all on function private.current_actor_is_named_coach_for_private_question(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.current_actor_can_answer_private_question(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.is_active_program_member(uuid, uuid, text),
  private.is_active_named_coach(uuid, uuid, uuid),
  private.has_active_consent(uuid, uuid, text),
  private.current_actor_is_private_question_party(uuid),
  private.current_actor_is_named_coach_for_private_question(uuid, uuid),
  private.current_actor_can_answer_private_question(uuid, uuid)
to authenticated;

revoke all on function public.read_participant_sensitive_metrics(uuid)
  from public, anon, authenticated;
revoke all on function public.read_named_coach_sensitive_metrics(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.read_participant_private_question(uuid)
  from public, anon, authenticated;
revoke all on function public.read_named_coach_private_question(uuid)
  from public, anon, authenticated;
revoke all on function public.read_participant_private_question_metadata(uuid)
  from public, anon, authenticated;
revoke all on function public.read_named_coach_private_question_metadata(uuid)
  from public, anon, authenticated;
revoke all on function public.edit_participant_private_question(uuid, text)
  from public, anon, authenticated;
revoke all on function public.transition_participant_private_question(uuid, text)
  from public, anon, authenticated;
revoke all on function public.route_named_coach_private_question(uuid, text)
  from public, anon, authenticated;
revoke all on function public.edit_named_coach_private_answer(uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_named_coach_private_answer(uuid)
  from public, anon, authenticated;
revoke all on function public.publish_anonymous_faq(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unpublish_anonymous_faq(uuid)
  from public, anon, authenticated;
grant execute on function public.read_participant_sensitive_metrics(uuid),
  public.read_named_coach_sensitive_metrics(uuid, uuid),
  public.read_participant_private_question(uuid),
  public.read_named_coach_private_question(uuid),
  public.read_participant_private_question_metadata(uuid),
  public.read_named_coach_private_question_metadata(uuid),
  public.edit_participant_private_question(uuid, text),
  public.transition_participant_private_question(uuid, text),
  public.route_named_coach_private_question(uuid, text),
  public.edit_named_coach_private_answer(uuid, text),
  public.delete_named_coach_private_answer(uuid),
  public.publish_anonymous_faq(uuid, uuid),
  public.unpublish_anonymous_faq(uuid)
to authenticated;

comment on table public.consent_grants is
  'Canonical independent affirmative purposes. One purpose never substitutes for another; AI rows bind exact provider project, endpoint, data classes, disclosure, and approved ZDR control.';
comment on column public.metric_consents.consent_grant_id is
  'Compatibility bridge to the canonical named-coach sensitive-metrics purpose. Legacy unlinked rows are preserved but cannot authorize a read.';
comment on table public.private_question_threads is
  'Body is private and browser SELECT is denied; participant and named-coach body projections are audited once per authorized call.';
comment on table public.anonymous_faq_copies is
  'A separately stored reversible anonymous copy. Browser roles only see anonymous_faq_projection, never private source identifiers or bodies.';
comment on table public.feed_posts is
  'Only explicit nonsensitive social or achievement bodies may be stored; sensitivity is database-derived and soft-delete has a fixed 30-day purge deadline.';
comment on table public.feed_share_events is
  'Metadata-only share observation; approved feed body is never duplicated into an event row.';
comment on table public.notification_records is
  'Metadata-only templates. Trigger replaces caller text with generic body-free notification copy.';
comment on table public.audit_events is
  'Identifiers and event metadata only; a trigger rejects body/value/prompt/payload keys recursively.';

update public.feed_posts
set audience_preview = case visibility
  when 'cohort' then 'program_cohort' else 'named_program_staff' end,
  delete_state = case when deleted_at is null then 'active' else 'soft_deleted' end,
  purge_after = case when deleted_at is null then null else deleted_at + interval '30 days' end;

alter table public.feed_posts
  add constraint feed_posts_audience_preview_check check (
    (visibility = 'cohort' and audience_preview = 'program_cohort')
    or (visibility = 'coach_only' and audience_preview = 'named_program_staff')
  ),
  add constraint feed_posts_explicit_source_check
    check (publication_source in ('explicit_user', 'explicit_staff')),
  add constraint feed_posts_content_origin_check
    check (content_origin in ('social', 'achievement', 'health', 'reflection', 'pain')),
  add constraint feed_posts_moderation_state_check
    check (moderation_state in ('visible', 'hidden', 'removed')),
  add constraint feed_posts_moderation_metadata_check check (
    moderation_state = 'visible'
    or (moderated_by_profile_id is not null and moderated_at is not null
      and moderation_reason_code ~ '^[a-z][a-z0-9_]{2,79}$')
  ),
  add constraint feed_posts_delete_state_check
    check (delete_state in ('active', 'soft_deleted', 'purged')),
  add constraint feed_posts_delete_metadata_check check (
    (delete_state = 'active' and deleted_at is null and purge_after is null and purged_at is null)
    or
    (delete_state = 'soft_deleted' and deleted_at is not null
      and purge_after = deleted_at + interval '30 days' and purged_at is null)
    or
    (delete_state = 'purged' and deleted_at is not null
      and purge_after = deleted_at + interval '30 days'
      and purged_at is not null and purged_at >= purge_after)
  );

update public.feed_comments
set delete_state = case when deleted_at is null then 'active' else 'soft_deleted' end,
  purge_after = case when deleted_at is null then null else deleted_at + interval '30 days' end;

alter table public.feed_comments
  add constraint feed_comments_content_origin_check
    check (content_origin in ('social', 'health', 'reflection', 'pain')),
  add constraint feed_comments_moderation_state_check
    check (moderation_state in ('visible', 'hidden', 'removed')),
  add constraint feed_comments_moderation_metadata_check check (
    moderation_state = 'visible'
    or (moderated_by_profile_id is not null and moderated_at is not null
      and moderation_reason_code ~ '^[a-z][a-z0-9_]{2,79}$')
  ),
  add constraint feed_comments_delete_state_check
    check (delete_state in ('active', 'soft_deleted', 'purged')),
  add constraint feed_comments_delete_metadata_check check (
    (delete_state = 'active' and deleted_at is null and purge_after is null and purged_at is null)
    or
    (delete_state = 'soft_deleted' and deleted_at is not null
      and purge_after = deleted_at + interval '30 days' and purged_at is null)
    or
    (delete_state = 'purged' and deleted_at is not null
      and purge_after = deleted_at + interval '30 days'
      and purged_at is not null and purged_at >= purge_after)
  );

create or replace function private.validate_feed_post_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  assignment_kind text;
  actor_is_staff boolean;
  actor_is_participant boolean;
begin
  actor_is_participant := private.is_active_program_member(actor, new.program_id, 'participant');
  actor_is_staff := private.is_active_program_member(actor, new.program_id, 'coach')
    or private.is_active_program_member(actor, new.program_id, 'admin');
  if tg_op = 'INSERT' then
    if new.author_profile_id <> actor or not (actor_is_participant or actor_is_staff) then
      raise exception 'feed post author must be an active program member'
        using errcode = '42501';
    end if;
    if new.submission_id is not null then
      select assignment.assignment_kind into assignment_kind
      from public.homework_submissions submission
      join public.assignments assignment on assignment.id = submission.assignment_id
      where submission.id = new.submission_id
        and submission.program_id = new.program_id
        and submission.participant_id = new.author_profile_id;
      if assignment_kind is null then
        raise exception 'feed submission must belong to its author and program'
          using errcode = '23514';
      end if;
      new.content_origin := case assignment_kind
        when 'running' then 'achievement'
        when 'health' then 'health'
        when 'reflection' then 'reflection'
      end;
    end if;
    if new.content_origin in ('health', 'reflection', 'pain') then
      raise exception 'health, reflection, and pain content cannot be stored in the feed'
        using errcode = '23514';
    end if;
    if actor_is_participant
      and not private.has_active_consent(new.program_id, actor, 'social_publication') then
      raise exception 'participant feed publication requires active social-publication consent'
        using errcode = '42501';
    end if;
    new.publication_source := case when actor_is_participant
      then 'explicit_user' else 'explicit_staff' end;
    new.audience_preview := case new.visibility
      when 'cohort' then 'program_cohort' else 'named_program_staff' end;
    new.delete_state := 'active';
    new.deleted_at := null;
    new.purge_after := null;
    new.purged_at := null;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.program_id is distinct from old.program_id
    or new.author_profile_id is distinct from old.author_profile_id
    or new.submission_id is distinct from old.submission_id
    or new.publication_source is distinct from old.publication_source
    or new.content_origin is distinct from old.content_origin
    or new.created_at is distinct from old.created_at then
    raise exception 'feed post identity, source, and sensitivity origin are immutable'
      using errcode = '23514';
  end if;
  if actor = old.author_profile_id then
    if old.delete_state <> 'active' then
      raise exception 'soft-deleted or purged feed posts are immutable to their author'
        using errcode = '23514';
    end if;
    if new.moderation_state is distinct from old.moderation_state
      or new.moderated_by_profile_id is distinct from old.moderated_by_profile_id
      or new.moderated_at is distinct from old.moderated_at
      or new.moderation_reason_code is distinct from old.moderation_reason_code
      or new.purged_at is distinct from old.purged_at then
      raise exception 'authors cannot set moderation or purge metadata'
        using errcode = '42501';
    end if;
    if old.content_origin in ('health', 'reflection', 'pain')
      and (
        new.body is distinct from old.body
        or new.visibility is distinct from old.visibility
        or new.edited_at is distinct from old.edited_at
      ) then
      raise exception 'quarantined legacy sensitive feed posts may only be deleted by their author'
        using errcode = '42501';
    end if;
    if new.delete_state is distinct from old.delete_state then
      if new.delete_state <> 'soft_deleted' then
        raise exception 'authors may only soft-delete feed posts'
          using errcode = '23514';
      end if;
      new.deleted_at := now();
      new.purge_after := new.deleted_at + interval '30 days';
    elsif new.deleted_at is distinct from old.deleted_at
      or new.purge_after is distinct from old.purge_after then
      raise exception 'feed deletion deadlines are database controlled'
        using errcode = '23514';
    end if;
    if new.body is distinct from old.body or new.visibility is distinct from old.visibility then
      new.edited_at := now();
    end if;
  elsif actor_is_staff then
    if new.body is distinct from old.body or new.visibility is distinct from old.visibility
      or new.edited_at is distinct from old.edited_at then
      raise exception 'moderators cannot rewrite an author feed body'
        using errcode = '42501';
    end if;
    if new.delete_state is distinct from old.delete_state
      or new.deleted_at is distinct from old.deleted_at
      or new.purge_after is distinct from old.purge_after
      or new.purged_at is distinct from old.purged_at then
      raise exception 'moderators cannot set feed deletion or purge metadata'
        using errcode = '42501';
    end if;
    if new.moderation_state is distinct from old.moderation_state then
      if new.moderation_state not in ('hidden', 'removed')
        or new.moderation_reason_code is null then
        raise exception 'moderation must hide or remove with a reason code'
          using errcode = '23514';
      end if;
      new.moderated_by_profile_id := actor;
      new.moderated_at := now();
      if new.moderation_state = 'removed' and old.delete_state = 'active' then
        new.delete_state := 'soft_deleted';
        new.deleted_at := now();
        new.purge_after := new.deleted_at + interval '30 days';
      end if;
    elsif new.moderated_by_profile_id is distinct from old.moderated_by_profile_id
      or new.moderated_at is distinct from old.moderated_at
      or new.moderation_reason_code is distinct from old.moderation_reason_code then
      raise exception 'unchanged moderation state cannot rewrite moderation metadata'
        using errcode = '42501';
    end if;
  elsif actor is null and old.delete_state = 'soft_deleted'
    and new.delete_state = 'purged' and old.purge_after <= now() then
    new.body := '[purged]';
    new.visibility := old.visibility;
    new.audience_preview := old.audience_preview;
    new.edited_at := old.edited_at;
    new.moderation_state := old.moderation_state;
    new.moderated_by_profile_id := old.moderated_by_profile_id;
    new.moderated_at := old.moderated_at;
    new.moderation_reason_code := old.moderation_reason_code;
    new.deleted_at := old.deleted_at;
    new.purge_after := old.purge_after;
    new.purged_at := now();
  else
    raise exception 'feed post update forbidden' using errcode = '42501';
  end if;
  new.audience_preview := case new.visibility
    when 'cohort' then 'program_cohort' else 'named_program_staff' end;
  return new;
end;
$$;

create trigger feed_posts_privacy_validate
before insert or update on public.feed_posts
for each row execute function private.validate_feed_post_privacy();

create or replace function private.validate_feed_comment_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  post public.feed_posts;
  actor_is_staff boolean;
  actor_is_participant boolean;
  due_purge boolean;
begin
  select * into post from public.feed_posts where id = new.post_id;
  due_purge := tg_op = 'UPDATE' and actor is null
    and old.delete_state = 'soft_deleted' and new.delete_state = 'purged'
    and old.purge_after <= now();
  actor_is_participant := private.is_active_program_member(actor, post.program_id, 'participant');
  actor_is_staff := private.is_active_program_member(actor, post.program_id, 'coach')
    or private.is_active_program_member(actor, post.program_id, 'admin');
  if post.id is null or (
    not due_purge
    and (
      post.delete_state <> 'active'
      or post.moderation_state <> 'visible'
      or (
        post.content_sensitivity is distinct from 'nonsensitive'
        and (
          tg_op = 'INSERT'
          or (actor is distinct from post.author_profile_id and not actor_is_staff)
        )
      )
    )
  ) then
    raise exception 'feed comment requires a visible active post'
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.author_profile_id <> actor or not (actor_is_participant or actor_is_staff) then
      raise exception 'feed comment author must be an active program member'
        using errcode = '42501';
    end if;
    if actor_is_participant
      and not private.has_active_consent(post.program_id, actor, 'social_publication') then
      raise exception 'participant comment requires active social-publication consent'
        using errcode = '42501';
    end if;
    if new.content_origin <> 'social' then
      raise exception 'health, reflection, and pain content cannot be stored in feed comments'
        using errcode = '23514';
    end if;
    new.delete_state := 'active';
    return new;
  end if;
  if new.id is distinct from old.id or new.post_id is distinct from old.post_id
    or new.author_profile_id is distinct from old.author_profile_id
    or new.content_origin is distinct from old.content_origin
    or new.created_at is distinct from old.created_at then
    raise exception 'feed comment identity and sensitivity origin are immutable'
      using errcode = '23514';
  end if;
  if actor = old.author_profile_id then
    if old.delete_state <> 'active' then
      raise exception 'soft-deleted or purged comments are immutable to their author'
        using errcode = '23514';
    end if;
    if new.moderation_state is distinct from old.moderation_state
      or new.moderated_by_profile_id is distinct from old.moderated_by_profile_id
      or new.moderated_at is distinct from old.moderated_at
      or new.moderation_reason_code is distinct from old.moderation_reason_code
      or new.purged_at is distinct from old.purged_at then
      raise exception 'comment authors cannot set moderation or purge metadata'
        using errcode = '42501';
    end if;
    if post.content_sensitivity is distinct from 'nonsensitive'
      and (new.body is distinct from old.body or new.edited_at is distinct from old.edited_at) then
      raise exception 'comments beneath quarantined sensitive posts may only be deleted by their author'
        using errcode = '42501';
    end if;
    if new.delete_state is distinct from old.delete_state then
      if new.delete_state <> 'soft_deleted' then
        raise exception 'authors may only soft-delete comments' using errcode = '23514';
      end if;
      new.deleted_at := now();
      new.purge_after := new.deleted_at + interval '30 days';
    elsif new.deleted_at is distinct from old.deleted_at
      or new.purge_after is distinct from old.purge_after then
      raise exception 'comment deletion deadlines are database controlled'
        using errcode = '23514';
    end if;
    if new.body is distinct from old.body then
      new.edited_at := now();
    end if;
  elsif actor_is_staff then
    if new.body is distinct from old.body or new.edited_at is distinct from old.edited_at then
      raise exception 'moderators cannot rewrite a comment body' using errcode = '42501';
    end if;
    if new.delete_state is distinct from old.delete_state
      or new.deleted_at is distinct from old.deleted_at
      or new.purge_after is distinct from old.purge_after
      or new.purged_at is distinct from old.purged_at then
      raise exception 'moderators cannot set comment deletion or purge metadata'
        using errcode = '42501';
    end if;
    if new.moderation_state is distinct from old.moderation_state then
      if new.moderation_state not in ('hidden', 'removed')
        or new.moderation_reason_code is null then
        raise exception 'comment moderation requires a reason code'
          using errcode = '23514';
      end if;
      new.moderated_by_profile_id := actor;
      new.moderated_at := now();
      if new.moderation_state = 'removed' and old.delete_state = 'active' then
        new.delete_state := 'soft_deleted';
        new.deleted_at := now();
        new.purge_after := new.deleted_at + interval '30 days';
      end if;
    elsif new.moderated_by_profile_id is distinct from old.moderated_by_profile_id
      or new.moderated_at is distinct from old.moderated_at
      or new.moderation_reason_code is distinct from old.moderation_reason_code then
      raise exception 'unchanged comment moderation state cannot rewrite metadata'
        using errcode = '42501';
    end if;
  elsif due_purge then
    new.body := '[purged]';
    new.edited_at := old.edited_at;
    new.moderation_state := old.moderation_state;
    new.moderated_by_profile_id := old.moderated_by_profile_id;
    new.moderated_at := old.moderated_at;
    new.moderation_reason_code := old.moderation_reason_code;
    new.deleted_at := old.deleted_at;
    new.purge_after := old.purge_after;
    new.purged_at := now();
  else
    raise exception 'feed comment update forbidden' using errcode = '42501';
  end if;
  if new.content_origin <> 'social' then
    raise exception 'sensitive content cannot be stored in feed comments'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger feed_comments_privacy_validate
before insert or update on public.feed_comments
for each row execute function private.validate_feed_comment_privacy();

create or replace function public.soft_delete_feed_post(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  post public.feed_posts;
  actor uuid := (select auth.uid());
begin
  select * into post from public.feed_posts where id = target_post_id;
  if post.id is null or post.author_profile_id <> actor or not (
    private.is_active_program_member(actor, post.program_id, 'participant')
    or private.is_active_program_member(actor, post.program_id, 'coach')
    or private.is_active_program_member(actor, post.program_id, 'admin')
  ) then
    raise exception 'feed post soft deletion forbidden' using errcode = '42501';
  end if;
  if post.delete_state <> 'active' then
    raise exception 'feed post is already deleted' using errcode = '23514';
  end if;
  update public.feed_posts set delete_state = 'soft_deleted' where id = post.id;
end;
$$;

create or replace function public.soft_delete_feed_comment(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment public.feed_comments;
  post public.feed_posts;
  actor uuid := (select auth.uid());
begin
  select * into comment from public.feed_comments where id = target_comment_id;
  select * into post from public.feed_posts where id = comment.post_id;
  if comment.id is null or comment.author_profile_id <> actor or not (
    private.is_active_program_member(actor, post.program_id, 'participant')
    or private.is_active_program_member(actor, post.program_id, 'coach')
    or private.is_active_program_member(actor, post.program_id, 'admin')
  ) then
    raise exception 'feed comment soft deletion forbidden' using errcode = '42501';
  end if;
  if comment.delete_state <> 'active' then
    raise exception 'feed comment is already deleted' using errcode = '23514';
  end if;
  update public.feed_comments set delete_state = 'soft_deleted' where id = comment.id;
end;
$$;

create or replace function public.moderate_feed_post(
  target_post_id uuid,
  target_moderation_state text,
  target_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_program uuid;
begin
  if target_moderation_state not in ('hidden', 'removed')
    or target_reason_code is null
    or target_reason_code !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception 'feed moderation requires a hidden or removed state and a reason code'
      using errcode = '23514';
  end if;
  select post.program_id into target_program
  from public.feed_posts post
  where post.id = target_post_id;
  if target_program is null or not (
    private.is_active_program_member(actor, target_program, 'coach')
    or private.is_active_program_member(actor, target_program, 'admin')
  ) then
    raise exception 'feed post moderation forbidden' using errcode = '42501';
  end if;
  update public.feed_posts
  set moderation_state = target_moderation_state,
    moderation_reason_code = target_reason_code
  where id = target_post_id;
end;
$$;

create or replace function public.moderate_feed_comment(
  target_comment_id uuid,
  target_moderation_state text,
  target_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_program uuid;
begin
  if target_moderation_state not in ('hidden', 'removed')
    or target_reason_code is null
    or target_reason_code !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception 'comment moderation requires a hidden or removed state and a reason code'
      using errcode = '23514';
  end if;
  select post.program_id into target_program
  from public.feed_comments comment
  join public.feed_posts post on post.id = comment.post_id
  where comment.id = target_comment_id;
  if target_program is null or not (
    private.is_active_program_member(actor, target_program, 'coach')
    or private.is_active_program_member(actor, target_program, 'admin')
  ) then
    raise exception 'feed comment moderation forbidden' using errcode = '42501';
  end if;
  update public.feed_comments
  set moderation_state = target_moderation_state,
    moderation_reason_code = target_reason_code
  where id = target_comment_id;
end;
$$;

revoke all on function public.moderate_feed_post(uuid, text, text) from public;
revoke all on function public.moderate_feed_comment(uuid, text, text) from public;
revoke all on function public.soft_delete_feed_post(uuid) from public;
revoke all on function public.soft_delete_feed_comment(uuid) from public;
grant execute on function public.moderate_feed_post(uuid, text, text) to authenticated;
grant execute on function public.moderate_feed_comment(uuid, text, text) to authenticated;
grant execute on function public.soft_delete_feed_post(uuid) to authenticated;
grant execute on function public.soft_delete_feed_comment(uuid) to authenticated;

alter table public.notification_records
  add column template_key text not null default 'generic_update',
  add column audience text not null default 'participant',
  add column preview_kind text not null default 'metadata_only',
  add column content_sensitivity text generated always as ('metadata_only'::text) stored;

update public.notification_records
set title = case category
    when 'assignment' then 'Program assignment update'
    when 'announcement' then 'Program notice available'
    when 'feedback' then 'Coach feedback available'
    else 'Program reminder'
  end,
  body = 'Open PLUS Run to view this update.',
  template_key = case category
    when 'assignment' then 'assignment_update'
    when 'announcement' then 'announcement_available'
    when 'feedback' then 'feedback_available'
    else 'program_reminder'
  end,
  audience = 'participant',
  preview_kind = 'metadata_only',
  contains_sensitive_data = false;

alter table public.notification_records
  add constraint notification_records_template_key_check
    check (template_key in (
      'assignment_update', 'announcement_available', 'feedback_available', 'program_reminder'
    )),
  add constraint notification_records_audience_check check (audience = 'participant'),
  add constraint notification_records_preview_kind_check check (preview_kind = 'metadata_only'),
  add constraint notification_records_generic_body_check
    check (body = 'Open PLUS Run to view this update.');

create or replace function private.enforce_notification_metadata_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := case new.category
    when 'assignment' then 'Program assignment update'
    when 'announcement' then 'Program notice available'
    when 'feedback' then 'Coach feedback available'
    else 'Program reminder'
  end;
  new.body := 'Open PLUS Run to view this update.';
  new.template_key := case new.category
    when 'assignment' then 'assignment_update'
    when 'announcement' then 'announcement_available'
    when 'feedback' then 'feedback_available'
    else 'program_reminder'
  end;
  new.audience := 'participant';
  new.preview_kind := 'metadata_only';
  new.contains_sensitive_data := false;
  return new;
end;
$$;

create trigger notification_records_metadata_only
before insert or update of category, title, body, contains_sensitive_data,
  template_key, audience, preview_kind
on public.notification_records
for each row execute function private.enforce_notification_metadata_only();

create or replace function public.read_named_coach_sensitive_metrics(
  target_program uuid,
  target_participant uuid
)
returns table (
  metric_record_id uuid,
  metric_type text,
  numeric_value numeric,
  unit text,
  observed_at timestamptz,
  source text,
  sensitivity text,
  verification_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_organization uuid;
begin
  if not private.is_active_named_coach(target_program, target_participant, actor) then
    raise exception 'named-coach sensitive-metric projection forbidden'
      using errcode = '42501';
  end if;
  select organization_id into target_organization
  from public.programs where id = target_program;
  perform private.record_audit(
    target_organization, actor, target_participant,
    'sensitive.metric_projection.named_coach_read',
    'metric_projection', target_program,
    jsonb_build_object(
      'projection', 'named_coach_sensitive_metrics',
      'program_id', target_program,
      'participant_profile_id', target_participant
    )
  );
  return query
  select metric.id, metric.metric_type, metric.numeric_value, metric.unit,
    metric.observed_at, metric.source, metric.sensitivity, metric.verification_status
  from public.metric_records metric
  where metric.program_id = target_program
    and metric.owner_profile_id = target_participant
    and exists (
      select 1
      from public.metric_consents metric_consent
      join public.consent_grants consent
        on consent.id = metric_consent.consent_grant_id
      join public.named_coach_grants coach_grant
        on coach_grant.id = metric_consent.named_coach_grant_id
      where metric_consent.metric_record_id = metric.id
        and metric_consent.owner_profile_id = target_participant
        and metric_consent.grantee_profile_id = actor
        and metric_consent.grantee_role = 'coach'
        and metric_consent.purpose = 'named_coach_sensitive_metrics'
        and metric_consent.revoked_at is null
        and metric_consent.expires_at > now()
        and consent.program_id = metric.program_id
        and consent.participant_profile_id = target_participant
        and consent.purpose = 'named_coach_sensitive_metrics'
        and consent.recipient_profile_id = actor
        and consent.status = 'active'
        and consent.expires_at > now()
        and coach_grant.consent_grant_id = consent.id
        and coach_grant.program_id = metric.program_id
        and coach_grant.participant_profile_id = target_participant
        and coach_grant.coach_profile_id = actor
        and coach_grant.status = 'active'
        and coach_grant.expires_at > now()
    )
  order by metric.observed_at desc nulls last, metric.id;
end;
$$;
