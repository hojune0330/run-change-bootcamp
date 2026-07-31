create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.homework_submissions(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  visibility text not null default 'cohort' check (visibility in ('cohort', 'coach_only')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.feed_reactions (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'heart' check (reaction = 'heart'),
  created_at timestamptz not null default now(),
  primary key (post_id, author_profile_id, reaction)
);

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.homework_submissions(id) on delete set null,
  ai_request_id uuid unique references public.ai_requests(id) on delete set null,
  origin text not null check (origin in ('ai', 'coach')),
  classification text not null check (classification in ('low_risk', 'training_change', 'pain', 'risk')),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'pending_approval' check (status in ('draft', 'pending_approval', 'published', 'rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    status <> 'published'
    or classification = 'low_risk'
    or (approved_by is not null and approved_at is not null)
  ),
  check (origin <> 'ai' or status <> 'draft')
);

create table if not exists public.feedback_review_events (
  id bigint generated always as identity primary key,
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://'),
  endpoint_hash text generated always as (encode(extensions.digest(endpoint, 'sha256'), 'hex')) stored,
  p256dh text not null check (char_length(p256dh) between 20 and 300),
  auth_secret text not null check (char_length(auth_secret) between 8 and 200),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (profile_id, endpoint_hash)
);

create table if not exists public.notification_records (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  category text not null check (category in ('assignment', 'announcement', 'feedback', 'reminder')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 500),
  contains_sensitive_data boolean not null default false check (contains_sensitive_data = false),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notification_records(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'push')),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists feed_posts_program_time_idx on public.feed_posts (program_id, created_at desc) where deleted_at is null;
create index if not exists feed_comments_post_time_idx on public.feed_comments (post_id, created_at) where deleted_at is null;
create index if not exists feedback_participant_status_idx on public.feedback_items (participant_id, status, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notification_records (recipient_profile_id, created_at desc) where read_at is null;
create index if not exists notification_outbox_delivery_idx on public.notification_outbox (status, available_at) where status in ('pending', 'failed');

create or replace function public.review_feedback(target_feedback uuid, target_decision text, review_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  feedback public.feedback_items;
  target_organization uuid;
  notification_id uuid;
begin
  if target_decision not in ('approved', 'rejected') then
    raise exception 'invalid feedback decision' using errcode = '22023';
  end if;
  select * into feedback from public.feedback_items where id = target_feedback for update;
  if feedback.id is null or not private.has_program_role(feedback.program_id, array['coach', 'admin']) then
    raise exception 'feedback review forbidden' using errcode = '42501';
  end if;
  if feedback.status <> 'pending_approval' then
    raise exception 'feedback is not pending approval' using errcode = '23514';
  end if;

  if target_decision = 'approved' then
    update public.feedback_items set
      status = 'published', approved_by = (select auth.uid()),
      approved_at = now(), published_at = now()
    where id = target_feedback;
    insert into public.notification_records (
      recipient_profile_id, program_id, category, title, body, entity_type, entity_id
    ) values (
      feedback.participant_id, feedback.program_id, 'feedback',
      'New coach feedback', 'Your coach published feedback.', 'feedback_item', target_feedback
    ) returning id into notification_id;
    insert into public.notification_outbox (notification_id, channel, idempotency_key)
    values (notification_id, 'push', 'feedback:' || target_feedback::text || ':published')
    on conflict (idempotency_key) do nothing;
  else
    update public.feedback_items set status = 'rejected' where id = target_feedback;
  end if;

  insert into public.feedback_review_events (feedback_id, reviewer_profile_id, decision, note)
  values (target_feedback, (select auth.uid()), target_decision, review_note);
  select organization_id into target_organization from public.programs where id = feedback.program_id;
  perform private.record_audit(
    target_organization, (select auth.uid()), feedback.participant_id,
    'feedback.' || target_decision, 'feedback_item', target_feedback
  );
  return target_feedback;
end;
$$;

alter table public.feed_posts enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feedback_items enable row level security;
alter table public.feedback_review_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_records enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on function public.review_feedback(uuid, text, text) from public, anon;
grant execute on function public.review_feedback(uuid, text, text) to authenticated;

comment on table public.notification_outbox is 'Provider-neutral delivery queue; no OAuth tokens or vendor account credentials are stored.';
comment on column public.notification_records.contains_sensitive_data is 'Notifications are intentionally low-risk metadata and must never carry health values.';
