\set ON_ERROR_STOP on

do $$
declare
  expected_columns text[];
  granted_columns text[];
  operational_table text;
  published_columns text[];
  source_table text;
begin
  expected_columns := array[
    'change_kind', 'changed_at', 'profile_id', 'program_id', 'revision'
  ];
  select array_agg(published.column_name::text order by published.column_name::text)
    into published_columns
  from pg_publication_tables publication_table
  cross join lateral unnest(publication_table.attnames) published(column_name)
  where publication_table.pubname = 'supabase_realtime'
    and publication_table.schemaname = 'public'
    and publication_table.tablename = 'pilot_auth_lifecycle_signals';
  if published_columns is distinct from expected_columns then
    raise exception 'unexpected auth lifecycle signal publication columns: %',
      published_columns;
  end if;
  foreach source_table in array array[
    'profiles', 'organization_memberships', 'programs', 'program_memberships',
    'program_invitations', 'program_enrollments'
  ] loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = source_table
    ) then
      raise exception 'lifecycle source remains in realtime publication: %', source_table;
    end if;
  end loop;
  foreach operational_table in array array[
    'profiles', 'organization_memberships', 'programs', 'program_memberships',
    'program_invitations', 'program_enrollments'
  ] loop
    if not has_table_privilege(
      'authenticated', format('public.%I', operational_table), 'select'
    ) then
      raise exception 'auth migration removed operational select from %', operational_table;
    end if;
  end loop;
  expected_columns := array[
    'change_kind', 'changed_at', 'profile_id', 'program_id', 'revision'
  ];
  select array_agg(source_column.column_name::text order by source_column.column_name::text)
    into granted_columns
  from information_schema.columns source_column
  where source_column.table_schema = 'public'
    and source_column.table_name = 'pilot_auth_lifecycle_signals'
    and has_column_privilege(
      'authenticated',
      'public.pilot_auth_lifecycle_signals',
      source_column.column_name,
      'select'
    );
  if granted_columns is distinct from expected_columns then
    raise exception 'unexpected auth lifecycle signal select columns: %', granted_columns;
  end if;
  if (
    select count(*)
    from pg_trigger trigger_row
    join pg_class source_relation on source_relation.oid = trigger_row.tgrelid
    join pg_namespace source_schema on source_schema.oid = source_relation.relnamespace
    where source_schema.nspname = 'public'
      and trigger_row.tgname = 'pilot_auth_lifecycle_signal'
      and not trigger_row.tgisinternal
  ) <> 6 then
    raise exception 'all six lifecycle sources do not have the signal trigger';
  end if;
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'organization_memberships', 'program_memberships')
      and policyname = 'pilot_auth_requires_activation'
      and permissive = 'RESTRICTIVE'
  ) <> 3 then
    raise exception 'legacy self policies are not restricted by pilot activation';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.claim_pilot_magic_link_delivery(text,text,uuid)',
    'execute'
  ) then
    raise exception 'service role cannot execute magic-link claim';
  end if;
  if has_function_privilege(
    'anon',
    'public.claim_pilot_magic_link_delivery(text,text,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_pilot_magic_link_delivery(text,text,uuid)',
    'execute'
  ) then
    raise exception 'browser roles can execute service-only magic-link claim';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.bootstrap_pilot_membership()', 'execute'
  ) then
    raise exception 'authenticated role cannot execute membership bootstrap';
  end if;

  if not exists (
    select 1 from public.program_memberships
    where profile_id in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000007'
    )
      and auth_activated_at is not null
  ) then
    raise exception 'accepted and legacy memberships were not activated on upgrade';
  end if;
  if exists (
    select 1 from public.program_memberships
    where profile_id in (
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003'
    )
      and auth_activated_at is not null
  ) then
    raise exception 'pending invitation was incorrectly activated on upgrade';
  end if;
end;
$$;

create temp table retained_jwt_denial_snapshots (
  scenario text primary key,
  program_checksum text not null,
  audit_count bigint not null,
  audit_checksum text not null
);

create or replace function pg_temp.capture_retained_jwt_denial_snapshot(
  target_scenario text,
  target_program uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  captured_audit_checksum text;
  captured_audit_count bigint;
  captured_program_checksum text;
begin
  select encode(
      extensions.digest(convert_to(to_jsonb(program)::text, 'UTF8'), 'sha256'),
      'hex'
    )
    into captured_program_checksum
  from public.programs program
  where program.id = target_program;

  select count(*), encode(
      extensions.digest(
        convert_to(
          coalesce(
            string_agg(to_jsonb(audit_event)::text, '' order by audit_event.id),
            ''
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
    into captured_audit_count, captured_audit_checksum
  from public.audit_events audit_event;

  insert into pg_temp.retained_jwt_denial_snapshots (
    scenario, program_checksum, audit_count, audit_checksum
  ) values (
    target_scenario, captured_program_checksum,
    captured_audit_count, captured_audit_checksum
  );
end;
$$;

create or replace function pg_temp.assert_retained_jwt_denied(
  target_profile uuid,
  target_program uuid,
  target_scenario text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  affected_rows bigint;
  rpc_denied boolean := false;
begin
  if (select auth.uid()) is distinct from target_profile then
    raise exception '% used the wrong retained JWT subject', target_scenario;
  end if;
  if private.current_actor_is_active()
    or private.current_actor_has_role(array['participant'])
    or private.has_program_role(target_program, array['participant'])
    or private.has_org_role(
      '10000000-0000-4000-8000-000000000100', array['participant']
    )
    or private.is_active_program_member(
      target_profile, target_program, 'participant'
    ) then
    raise exception '% retained active authorization', target_scenario;
  end if;
  if exists (
    select 1 from public.programs program where program.id = target_program
  ) then
    raise exception '% retained protected table read access', target_scenario;
  end if;

  update public.programs
  set title = title
  where id = target_program;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception '% retained protected table update access', target_scenario;
  end if;

  begin
    perform 1
    from public.read_participant_sensitive_metrics(target_program);
  exception
    when insufficient_privilege then
      rpc_denied := true;
  end;
  if not rpc_denied then
    raise exception '% retained protected RPC access', target_scenario;
  end if;
end;
$$;

create or replace function pg_temp.assert_retained_jwt_denial_unchanged(
  target_scenario text,
  target_program uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  baseline pg_temp.retained_jwt_denial_snapshots%rowtype;
  current_audit_checksum text;
  current_audit_count bigint;
  current_program_checksum text;
begin
  select * into strict baseline
  from pg_temp.retained_jwt_denial_snapshots snapshot
  where snapshot.scenario = target_scenario;

  select encode(
      extensions.digest(convert_to(to_jsonb(program)::text, 'UTF8'), 'sha256'),
      'hex'
    )
    into current_program_checksum
  from public.programs program
  where program.id = target_program;

  select count(*), encode(
      extensions.digest(
        convert_to(
          coalesce(
            string_agg(to_jsonb(audit_event)::text, '' order by audit_event.id),
            ''
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
    into current_audit_count, current_audit_checksum
  from public.audit_events audit_event;

  if current_program_checksum is distinct from baseline.program_checksum
    or current_audit_count is distinct from baseline.audit_count
    or current_audit_checksum is distinct from baseline.audit_checksum then
    raise exception '% denial changed protected state or audit history', target_scenario;
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', false
);
do $$
begin
  if exists (
    select 1 from public.program_invitations
    where invitee_profile_id = '10000000-0000-4000-8000-000000000007'
  ) or exists (
    select 1 from public.program_enrollments
    where profile_id = '10000000-0000-4000-8000-000000000007'
  ) or not private.is_active_program_member(
    '10000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000300',
    'participant'
  ) then
    raise exception 'explicit no-invitation/no-enrollment legacy cohort was not preserved';
  end if;
  if not exists (
    select 1 from public.programs
    where id = '10000000-0000-4000-8000-000000000300'
  ) then
    raise exception 'explicit legacy cohort lost protected table read access';
  end if;
  perform 1 from public.read_participant_sensitive_metrics(
    '10000000-0000-4000-8000-000000000300'
  );
end;
$$;
reset role;

set role service_role;
do $$
declare
  result jsonb;
begin
  result := public.claim_pilot_magic_link_delivery(
    'unknown@example.test', 'evt-unknown',
    '10000000-0000-4000-8000-000000000008'
  );
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'unknown identity leaked eligibility: %', result;
  end if;
  result := public.claim_pilot_magic_link_delivery(
    'unknown@example.test', 'evt-unknown-retry',
    '10000000-0000-4000-8000-000000000008'
  );
  if result <> '{"status":"resend_guard"}'::jsonb then
    raise exception 'unknown identity skipped uniform resend guard: %', result;
  end if;
  result := public.claim_pilot_magic_link_delivery(
    'unknown@example.test', 'evt-unknown',
    '10000000-0000-4000-8000-000000000008'
  );
  if result <> '{"status":"replayed"}'::jsonb then
    raise exception 'signed hook event replay was not rejected: %', result;
  end if;

  result := public.claim_pilot_magic_link_delivery(
    'pending@example.test', 'evt-pending',
    '10000000-0000-4000-8000-000000000002'
  );
  if result <> '{"status":"send"}'::jsonb then
    raise exception 'eligible pending invitation was not claimed: %', result;
  end if;
  result := public.claim_pilot_magic_link_delivery(
    'pending@example.test', 'evt-pending-retry',
    '10000000-0000-4000-8000-000000000002'
  );
  if result <> '{"status":"resend_guard"}'::jsonb then
    raise exception 'eligible identity skipped resend guard: %', result;
  end if;

  result := public.claim_pilot_magic_link_delivery(
    'accepted@example.test', 'evt-reauth',
    '10000000-0000-4000-8000-000000000001'
  );
  if result <> '{"status":"send"}'::jsonb then
    raise exception 'activated accepted member could not request reauth: %', result;
  end if;
end;
$$;
reset role;

select pg_temp.capture_retained_jwt_denial_snapshot(
  'accepted invitation without enrollment',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000300',
  'accepted invitation without enrollment'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'accepted invitation without enrollment',
  '10000000-0000-4000-8000-000000000300'
);

insert into public.program_invitations (
  id, program_id, invitee_profile_id, invitee_email_hash, role,
  status, invited_at, expires_at, accepted_at
) values (
  '10000000-0000-4000-8000-000000000507',
  '10000000-0000-4000-8000-000000000300',
  '10000000-0000-4000-8000-000000000001',
  encode(extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'),
  'participant', 'revoked', statement_timestamp(), statement_timestamp() + interval '1 day', null
);
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'accepted@example.test', 'evt-newer-revoked-shadow',
    '10000000-0000-4000-8000-000000000001'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'older eligible invitation bypassed newer revoked invitation: %', result;
  end if;
end;
$$;
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"nonmember"}'::jsonb then
    raise exception 'callback did not select the same newer revoked invitation: %', result;
  end if;
end;
$$;
reset role;
delete from public.program_invitations
where id = '10000000-0000-4000-8000-000000000507';

set role service_role;
do $$
declare
  result jsonb;
begin
  result := public.claim_pilot_magic_link_delivery(
    'suspended@example.test', 'evt-suspended-delivery-denied',
    '10000000-0000-4000-8000-000000000004'
  );
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'suspended participant received a magic link: %', result;
  end if;
  result := public.claim_pilot_magic_link_delivery(
    'withdrawn@example.test', 'evt-withdrawn-delivery-denied',
    '10000000-0000-4000-8000-000000000005'
  );
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'withdrawn participant received a magic link: %', result;
  end if;
  result := public.claim_pilot_magic_link_delivery(
    'deleted@example.test', 'evt-disabled-delivery-denied',
    '10000000-0000-4000-8000-000000000006'
  );
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'disabled participant received a magic link: %', result;
  end if;
end;
$$;
reset role;

update public.program_enrollments
set lifecycle_status = 'paused', withdrawn_at = null, completed_at = null
where id = '10000000-0000-4000-8000-000000000605';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('withdrawn@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'withdrawn@example.test', 'evt-paused-enrollment-delivery-denied',
    '10000000-0000-4000-8000-000000000005'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'paused participant enrollment received a magic link: %', result;
  end if;
end;
$$;
reset role;

update public.program_enrollments
set lifecycle_status = 'completed', completed_at = statement_timestamp()
where id = '10000000-0000-4000-8000-000000000605';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('withdrawn@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'withdrawn@example.test', 'evt-completed-enrollment-delivery-denied',
    '10000000-0000-4000-8000-000000000005'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'completed participant enrollment received a magic link: %', result;
  end if;
end;
$$;
reset role;

update public.program_enrollments
set lifecycle_status = 'ended', completed_at = null
where id = '10000000-0000-4000-8000-000000000605';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('withdrawn@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'withdrawn@example.test', 'evt-ended-enrollment-delivery-denied',
    '10000000-0000-4000-8000-000000000005'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'ended participant enrollment received a magic link: %', result;
  end if;
end;
$$;
reset role;
update public.program_enrollments
set lifecycle_status = 'withdrawn', withdrawn_at = statement_timestamp(), completed_at = null
where id = '10000000-0000-4000-8000-000000000605';

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
do $$
declare
  result jsonb;
  visible_enrollments integer;
  visible_invitations integer;
  visible_memberships integer;
  visible_organization_memberships integer;
  visible_profiles integer;
  visible_programs integer;
  visible_signals integer;
begin
  if private.is_active_program_member(
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000300',
    'participant'
  ) then
    raise exception 'unaccepted direct Auth session passed active membership gate';
  end if;
  select count(*) into visible_programs
  from public.programs
  where id = '10000000-0000-4000-8000-000000000300';
  if visible_programs <> 0 then
    raise exception 'unaccepted direct Auth session read operational rows';
  end if;
  select count(*) into visible_profiles
  from public.profiles
  where id = '10000000-0000-4000-8000-000000000002';
  select count(*) into visible_organization_memberships
  from public.organization_memberships
  where profile_id = '10000000-0000-4000-8000-000000000002';
  select count(*) into visible_memberships
  from public.program_memberships
  where profile_id = '10000000-0000-4000-8000-000000000002';
  select count(*) into visible_invitations
  from public.program_invitations
  where invitee_profile_id = '10000000-0000-4000-8000-000000000002';
  select count(*) into visible_enrollments
  from public.program_enrollments
  where profile_id = '10000000-0000-4000-8000-000000000002';
  select count(*) into visible_signals
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000002';
  if visible_profiles <> 0
    or visible_organization_memberships <> 0
    or visible_memberships <> 0
    or visible_invitations <> 0
    or visible_enrollments <> 0 then
    raise exception 'unaccepted direct Auth session read protected operational rows';
  end if;
  if visible_signals <> 1 then
    raise exception 'unaccepted identity cannot read its narrow self-only invalidation row';
  end if;

  result := public.bootstrap_pilot_membership();
  if result ->> 'status' <> 'active'
    or result ->> 'role' <> 'participant' then
    raise exception 'valid first callback did not activate atomically: %', result;
  end if;
  if not private.is_active_program_member(
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000300',
    'participant'
  ) then
    raise exception 'activated callback did not open membership gate';
  end if;
  if not exists (
    select 1
    from public.program_enrollments
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and lifecycle_status = 'onboarding'
  ) then
    raise exception 'first participant callback did not create enrollment';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000002'
      and display_name = 'Pending'
  ) or not exists (
    select 1 from public.programs
    where id = '10000000-0000-4000-8000-000000000300'
      and title = 'Auth invitation test program'
  ) then
    raise exception 'activation did not preserve participant directory and program reads';
  end if;
  if exists (
    select 1 from public.program_invitations
    where invitee_profile_id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'participant could read admin-only invitation issuance metadata';
  end if;
  if not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and program_id = '10000000-0000-4000-8000-000000000300'
  ) then
    raise exception 'activated participant cannot read narrow auth invalidation signal';
  end if;
end;
$$;
reset role;

insert into public.program_invitations (
  id, program_id, invitee_profile_id, invitee_email_hash, role,
  status, invited_at, expires_at, accepted_at
) values (
  '10000000-0000-4000-8000-000000000508',
  '10000000-0000-4000-8000-000000000300',
  '10000000-0000-4000-8000-000000000002',
  encode(extensions.digest(convert_to('pending@example.test', 'UTF8'), 'sha256'), 'hex'),
  'participant', 'revoked', statement_timestamp(),
  statement_timestamp() + interval '1 day', null
);
select pg_temp.capture_retained_jwt_denial_snapshot(
  'newest invitation revoked',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'newest invitation revoked'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'newest invitation revoked',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_invitations
set status = 'expired'
where id = '10000000-0000-4000-8000-000000000508';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'newest invitation expired',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'newest invitation expired'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'newest invitation expired',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_invitations
set status = 'created'
where id = '10000000-0000-4000-8000-000000000508';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'newest invitation ineligible',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'newest invitation ineligible'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'newest invitation ineligible',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_invitations
set status = 'accepted',
    invited_at = statement_timestamp() - interval '1 hour',
    expires_at = statement_timestamp() - interval '30 minutes',
    accepted_at = statement_timestamp() - interval '10 minutes'
where id = '10000000-0000-4000-8000-000000000508';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'newest invitation accepted after expiry',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'newest invitation accepted after expiry'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'newest invitation accepted after expiry',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_invitations
set status = 'accepted',
    invited_at = statement_timestamp() + interval '1 day',
    expires_at = statement_timestamp() + interval '2 days',
    accepted_at = statement_timestamp() + interval '1 day'
where id = '10000000-0000-4000-8000-000000000508';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'newest invitation future',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'newest invitation future'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'newest invitation future',
  '10000000-0000-4000-8000-000000000300'
);
delete from public.program_invitations
where id = '10000000-0000-4000-8000-000000000508';

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000009', false
);
do $$
begin
  if not exists (
    select 1 from public.program_invitations
    where id = '10000000-0000-4000-8000-000000000502'
      and invitee_email_hash is not null
  ) or not exists (
    select 1 from public.program_enrollments
    where id = '10000000-0000-4000-8000-000000000605'
      and lifecycle_status = 'withdrawn'
  ) then
    raise exception 'auth migration removed admin invitation or enrollment reads';
  end if;
end;
$$;
reset role;

update public.program_invitations
set last_magic_link_requested_at = statement_timestamp() - interval '16 minutes',
    magic_link_expires_at = statement_timestamp() - interval '1 minute'
where id in (
  '10000000-0000-4000-8000-000000000502',
  '10000000-0000-4000-8000-000000000503'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result ->> 'status' <> 'active' then
    raise exception 'restored activated session incorrectly expired after 15 minutes: %', result;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"expired_link"}'::jsonb then
    raise exception 'stale first-use link was not denied: %', result;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"suspended"}'::jsonb then
    raise exception 'suspended membership did not resolve deterministically: %', result;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"withdrawn"}'::jsonb then
    raise exception 'withdrawn enrollment did not resolve deterministically: %', result;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"deleted"}'::jsonb then
    raise exception 'deleted profile did not resolve deterministically: %', result;
  end if;
end;
$$;
reset role;

update public.programs
set starts_on = current_date + 1,
    ends_on = current_date + 31
where id = '10000000-0000-4000-8000-000000000300';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'accepted@example.test', 'evt-future-program',
    '10000000-0000-4000-8000-000000000001'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'future program window received a magic link: %', result;
  end if;
end;
$$;
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"nonmember"}'::jsonb then
    raise exception 'future program window bootstrapped as active: %', result;
  end if;
end;
$$;
reset role;
update public.programs
set starts_on = current_date - 1,
    ends_on = current_date + 30
where id = '10000000-0000-4000-8000-000000000300';

update public.program_memberships
set joined_at = statement_timestamp() + interval '1 day'
where id = '10000000-0000-4000-8000-000000000401';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'accepted@example.test', 'evt-future-program-membership',
    '10000000-0000-4000-8000-000000000001'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'future program membership received a magic link: %', result;
  end if;
end;
$$;
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"nonmember"}'::jsonb then
    raise exception 'future program membership bootstrapped as active: %', result;
  end if;
end;
$$;
reset role;
update public.program_memberships
set joined_at = statement_timestamp() - interval '1 day'
where id = '10000000-0000-4000-8000-000000000401';

update public.organization_memberships
set starts_at = statement_timestamp() + interval '1 day'
where id = '10000000-0000-4000-8000-000000000201';
update private.pilot_magic_link_guards
set last_requested_at = statement_timestamp() - interval '61 seconds'
where email_hash = encode(
  extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'
);
set role service_role;
do $$
declare
  result jsonb := public.claim_pilot_magic_link_delivery(
    'accepted@example.test', 'evt-future-organization-membership',
    '10000000-0000-4000-8000-000000000001'
  );
begin
  if result <> '{"status":"ignore"}'::jsonb then
    raise exception 'future organization membership received a magic link: %', result;
  end if;
end;
$$;
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result <> '{"status":"nonmember"}'::jsonb then
    raise exception 'future organization membership bootstrapped as active: %', result;
  end if;
end;
$$;
reset role;
update public.organization_memberships
set starts_at = statement_timestamp() - interval '1 day'
where id = '10000000-0000-4000-8000-000000000201';

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
declare
  result jsonb := public.bootstrap_pilot_membership();
begin
  if result ->> 'status' <> 'active'
    or not private.is_active_program_member(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000300',
      'participant'
    ) then
    raise exception 'accepted participant did not establish enrollment-backed access: %', result;
  end if;
end;
$$;
reset role;
select pg_temp.capture_retained_jwt_denial_snapshot(
  'accepted invitation revoked in place',
  '10000000-0000-4000-8000-000000000300'
);

do $$
declare
  revision_after bigint;
  revision_before bigint;
  signal_kind text;
begin
  if not exists (
    select 1
    from public.program_invitations invitation
    join public.program_memberships membership
      on membership.program_id = invitation.program_id
     and membership.profile_id = invitation.invitee_profile_id
    where invitation.id = '10000000-0000-4000-8000-000000000502'
      and invitation.status = 'accepted'
      and invitation.accepted_at is not null
      and membership.auth_activated_at is not null
  ) then
    raise exception 'first callback did not persist invitation acceptance and activation marker';
  end if;
  if not exists (
    select 1 from public.program_invitations
    where id = '10000000-0000-4000-8000-000000000503'
      and status = 'expired'
  ) then
    raise exception 'stale first-use link did not persist expiration';
  end if;
  if not exists (
    select 1 from public.program_invitations
    where id = '10000000-0000-4000-8000-000000000501'
      and status = 'accepted'
  ) then
    raise exception 'reauth mutated accepted invitation status';
  end if;
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000001'
    and program_id = '10000000-0000-4000-8000-000000000300';
  update public.program_invitations
  set status = 'revoked', accepted_at = null
  where id = '10000000-0000-4000-8000-000000000501';
  select revision, change_kind into revision_after, signal_kind
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000001'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before or signal_kind <> 'invitation' then
    raise exception 'invitation revocation did not advance the auth lifecycle signal';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000300',
  'accepted invitation revoked in place'
);
do $$
begin
  if not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000001'
      and program_id = '10000000-0000-4000-8000-000000000300'
      and change_kind = 'invitation'
  ) then
    raise exception 'revoked invitee cannot read its self-only signal';
  end if;
end;
$$;
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'accepted invitation revoked in place',
  '10000000-0000-4000-8000-000000000300'
);

do $$
declare
  revision_after bigint;
  revision_before bigint;
  signal_kind text;
begin
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000002'
    and program_id = '10000000-0000-4000-8000-000000000300';
  update public.organization_memberships
  set status = 'suspended'
  where id = '10000000-0000-4000-8000-000000000202';
  select revision, change_kind into revision_after, signal_kind
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000002'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before or signal_kind <> 'organization_membership' then
    raise exception 'organization suspension did not advance the auth lifecycle signal';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
do $$
begin
  if private.current_actor_is_active() or exists (
    select 1 from public.organization_memberships
    where profile_id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'suspended organization member retained protected source access';
  end if;
  if not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and program_id = '10000000-0000-4000-8000-000000000300'
      and change_kind = 'organization_membership'
  ) then
    raise exception 'suspended organization member lost its self-only signal';
  end if;
end;
$$;
reset role;

update public.organization_memberships
set status = 'active'
where id = '10000000-0000-4000-8000-000000000202';

update public.program_enrollments
set lifecycle_status = 'paused', withdrawn_at = null, completed_at = null
where profile_id = '10000000-0000-4000-8000-000000000002'
  and program_id = '10000000-0000-4000-8000-000000000300';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'participant enrollment paused',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'participant enrollment paused'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'participant enrollment paused',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_enrollments
set lifecycle_status = 'completed', completed_at = statement_timestamp()
where profile_id = '10000000-0000-4000-8000-000000000002'
  and program_id = '10000000-0000-4000-8000-000000000300';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'participant enrollment completed',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'participant enrollment completed'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'participant enrollment completed',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_enrollments
set lifecycle_status = 'ended', completed_at = null
where profile_id = '10000000-0000-4000-8000-000000000002'
  and program_id = '10000000-0000-4000-8000-000000000300';
select pg_temp.capture_retained_jwt_denial_snapshot(
  'participant enrollment ended',
  '10000000-0000-4000-8000-000000000300'
);
set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'participant enrollment ended'
);
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'participant enrollment ended',
  '10000000-0000-4000-8000-000000000300'
);

update public.program_enrollments
set lifecycle_status = 'onboarding', completed_at = null
where profile_id = '10000000-0000-4000-8000-000000000002'
  and program_id = '10000000-0000-4000-8000-000000000300';

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
do $$
begin
  if exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'peer can read another profile lifecycle signal';
  end if;
end;
$$;
reset role;

do $$
declare
  revision_after bigint;
  revision_before bigint;
  signal_kind text;
begin
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000002'
    and program_id = '10000000-0000-4000-8000-000000000300';
  update public.program_enrollments
  set lifecycle_status = 'withdrawn', withdrawn_at = statement_timestamp()
  where profile_id = '10000000-0000-4000-8000-000000000002'
    and program_id = '10000000-0000-4000-8000-000000000300';
  select revision, change_kind into revision_after, signal_kind
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000002'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before or signal_kind <> 'enrollment' then
    raise exception 'enrollment withdrawal did not advance the auth lifecycle signal';
  end if;
end;
$$;

select pg_temp.capture_retained_jwt_denial_snapshot(
  'participant enrollment withdrawn',
  '10000000-0000-4000-8000-000000000300'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false
);
select pg_temp.assert_retained_jwt_denied(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000300',
  'participant enrollment withdrawn'
);
do $$
begin
  if exists (
    select 1 from public.program_enrollments
    where profile_id = '10000000-0000-4000-8000-000000000002'
  ) or not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000002'
      and change_kind = 'enrollment'
  ) then
    raise exception 'withdrawn enrollment signal is not visible after source access closes';
  end if;
end;
$$;
reset role;
select pg_temp.assert_retained_jwt_denial_unchanged(
  'participant enrollment withdrawn',
  '10000000-0000-4000-8000-000000000300'
);

do $$
declare
  revision_after bigint;
  revision_before bigint;
  signal_kind text;
begin
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000007'
    and program_id = '10000000-0000-4000-8000-000000000300';
  update public.program_memberships
  set status = 'ended', ended_at = statement_timestamp()
  where id = '10000000-0000-4000-8000-000000000407';
  select revision, change_kind into revision_after, signal_kind
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000007'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before or signal_kind <> 'program_membership' then
    raise exception 'program membership end did not advance the auth lifecycle signal';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', false
);
do $$
begin
  if private.current_actor_is_active() or exists (
    select 1 from public.program_memberships
    where profile_id = '10000000-0000-4000-8000-000000000007'
  ) or not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000007'
      and change_kind = 'program_membership'
  ) then
    raise exception 'ended membership signal is not visible after source access closes';
  end if;
end;
$$;
reset role;

do $$
declare
  revision_after bigint;
  revision_before bigint;
begin
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000006'
    and program_id = '10000000-0000-4000-8000-000000000300';
  delete from public.profiles
  where id = '10000000-0000-4000-8000-000000000006';
  select revision into revision_after
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000006'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before then
    raise exception 'profile deletion did not advance the durable auth lifecycle signal';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', false
);
do $$
begin
  if exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000006'
  ) or not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'deleted profile signal did not survive source deletion';
  end if;
end;
$$;
reset role;

do $$
declare
  revision_after bigint;
  revision_before bigint;
  signal_kind text;
begin
  select revision into revision_before
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000009'
    and program_id = '10000000-0000-4000-8000-000000000300';
  update public.programs
  set status = 'completed'
  where id = '10000000-0000-4000-8000-000000000300';
  select revision, change_kind into revision_after, signal_kind
  from public.pilot_auth_lifecycle_signals
  where profile_id = '10000000-0000-4000-8000-000000000009'
    and program_id = '10000000-0000-4000-8000-000000000300';
  if revision_after <= revision_before or signal_kind <> 'program' then
    raise exception 'program completion did not fan out the auth lifecycle signal';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000009', false
);
do $$
begin
  if private.current_actor_is_active() or exists (
    select 1 from public.programs
    where id = '10000000-0000-4000-8000-000000000300'
  ) or not exists (
    select 1 from public.pilot_auth_lifecycle_signals
    where profile_id = '10000000-0000-4000-8000-000000000009'
      and change_kind = 'program'
  ) then
    raise exception 'program fanout signal is not visible after source access closes';
  end if;
end;
$$;
reset role;

select 'AUTH_INVITATION_TEST_PASS' as result;
