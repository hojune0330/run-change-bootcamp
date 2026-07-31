create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  session_number smallint not null check (session_number > 0),
  scheduled_at timestamptz not null,
  session_kind text not null check (session_kind in ('onboarding', 'easy', 'time_trial', 'recovery', 'technique', 'training', 'retest')),
  title text not null check (char_length(title) between 1 and 160),
  unique (program_id, session_number)
);

create table if not exists public.time_trial_decisions (
  program_id uuid primary key references public.programs(id) on delete cascade,
  initial_session_number smallint not null check (initial_session_number in (1, 2)),
  protocol text not null check (protocol in ('12_minute', '3k', '5k')),
  decided_by uuid not null references public.profiles(id),
  decided_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  session_id uuid references public.program_sessions(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null check (char_length(instructions) between 1 and 4000),
  assignment_kind text not null check (assignment_kind in ('running', 'health', 'reflection')),
  due_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  response_text text check (response_text is null or char_length(response_text) <= 5000),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, participant_id)
);

create table if not exists public.data_uploads (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  upload_kind text not null check (upload_kind in ('screenshot', 'fit', 'tcx', 'gpx', 'csv', 'xml', 'json')),
  bucket_id text not null check (bucket_id in ('screenshots', 'health-imports')),
  object_path text not null,
  byte_size bigint not null check (byte_size between 1 and 15728640),
  detected_mime_type text not null,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'processed', 'rejected', 'deleted')),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table if not exists public.metric_records (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.homework_submissions(id) on delete set null,
  upload_id uuid references public.data_uploads(id) on delete set null,
  ai_request_id uuid,
  draft_index smallint check (draft_index is null or draft_index between 0 and 9),
  source text not null check (source in ('manual', 'import', 'screenshot')),
  metric_type text not null check (metric_type in ('distance_m', 'duration_s', 'pace_s_per_km', 'heart_rate_bpm', 'weight_kg', 'body_fat_pct', 'pain_score', 'other')),
  numeric_value numeric not null check (numeric_value >= 0),
  unit text not null check (unit in ('m', 's', 's/km', 'bpm', 'kg', '%', 'score')),
  observed_at timestamptz,
  sensitivity text not null default 'health' check (sensitivity in ('activity', 'health')),
  verification_status text not null default 'draft' check (verification_status in ('draft', 'accepted', 'rejected')),
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((ai_request_id is null) = (draft_index is null))
);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  request_kind text not null check (request_kind in ('metric_extraction', 'feedback_draft')),
  target_id uuid not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  provider_response_id text,
  error_code text,
  created_at timestamptz not null default now(),
  last_started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (requested_by, idempotency_key)
);

alter table public.metric_records
  add constraint metric_records_ai_request_fk foreign key (ai_request_id)
  references public.ai_requests(id) on delete cascade;
alter table public.metric_records
  add constraint metric_records_ai_request_draft_key unique (ai_request_id, draft_index);

create index if not exists program_sessions_program_time_idx on public.program_sessions (program_id, scheduled_at);
create index if not exists assignments_program_due_idx on public.assignments (program_id, due_at);
create index if not exists announcements_program_published_idx on public.announcements (program_id, published_at desc);
create index if not exists submissions_participant_idx on public.homework_submissions (participant_id, program_id, status);
create index if not exists uploads_owner_idx on public.data_uploads (owner_profile_id, created_at desc);
create index if not exists metrics_owner_type_idx on public.metric_records (owner_profile_id, metric_type, observed_at desc);
create index if not exists metrics_program_idx on public.metric_records (program_id, owner_profile_id);

drop trigger if exists submissions_touch_updated_at on public.homework_submissions;
create trigger submissions_touch_updated_at before update on public.homework_submissions
for each row execute function private.touch_updated_at();
drop trigger if exists metrics_touch_updated_at on public.metric_records;
create trigger metrics_touch_updated_at before update on public.metric_records
for each row execute function private.touch_updated_at();

alter table public.program_sessions enable row level security;
alter table public.time_trial_decisions enable row level security;
alter table public.assignments enable row level security;
alter table public.announcements enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.data_uploads enable row level security;
alter table public.metric_records enable row level security;
alter table public.ai_requests enable row level security;

comment on table public.metric_records is 'Health data is private by default; every non-owner health read is consent-gated.';
comment on table public.ai_requests is 'Stores operational status only; prompts, images, and raw provider responses are deliberately excluded.';
