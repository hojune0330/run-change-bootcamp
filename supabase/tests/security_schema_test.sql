\set ON_ERROR_STOP on

create or replace function pg_temp.assert_true(actual boolean, label text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
  raise notice 'ASSERTION PASS: %', label;
end;
$$;

select pg_temp.assert_true(
  split_part(current_setting('server_version'), ' ', 1) = '17.10',
  'database server is exactly PostgreSQL 17.10'
);

select pg_temp.assert_true(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'email'
      and data_type = 'character varying'
      and character_maximum_length = 255
      and is_nullable = 'YES'
  ),
  'portable auth users email matches the upstream nullable varchar 255 contract'
);

select pg_temp.assert_true(
  (select not rolcanlogin and not rolinherit and not rolbypassrls
    from pg_roles where rolname = 'plus_aggregate_exporter')
  and (select not rolcanlogin and not rolinherit and not rolbypassrls
    from pg_roles where rolname = 'plus_service_worker'),
  'custom service roles are NOLOGIN NOINHERIT NOBYPASSRLS'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  'every public base table has row level security enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relname <> 'pilot_auth_lifecycle_signals'
      and not exists (
        select 1
        from pg_policy policy
        where policy.polrelid = relation.oid
          and policy.polname = 'active_authenticated_only'
          and not policy.polpermissive
      )
  ),
  'every public base table except the retained-JWT lifecycle signal has the restrictive active-authenticated policy'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'public.pilot_auth_lifecycle_signals'::regclass
      and policy.polname = 'pilot_auth_lifecycle_signal_self'
      and policy.polpermissive
      and policy.polcmd = 'r'
  )
  and not exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'public.pilot_auth_lifecycle_signals'::regclass
      and policy.polname = 'active_authenticated_only'
  )
  and not has_table_privilege(
    'authenticated', 'public.pilot_auth_lifecycle_signals', 'INSERT'
  )
  and not has_table_privilege(
    'authenticated', 'public.pilot_auth_lifecycle_signals', 'UPDATE'
  )
  and not has_table_privilege(
    'authenticated', 'public.pilot_auth_lifecycle_signals', 'DELETE'
  ),
  'retained-JWT lifecycle signal remains self-readable but non-writable after actor deactivation'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'storage.objects'::regclass
      and policy.polname = 'active_authenticated_only'
      and not policy.polpermissive
  ) and (select relrowsecurity from pg_class
    where oid = 'storage.objects'::regclass),
  'storage objects has RLS and the restrictive active-authenticated policy'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.grantee in (
      'plus_aggregate_exporter', 'plus_service_worker'
    )
      and grant_row.table_schema in ('public', 'storage')
  ),
  'custom service roles have no direct public or storage table grants'
);

select pg_temp.assert_true(
  not has_table_privilege(
      'authenticated', 'public.accepted_structured_imports', 'SELECT'
    )
    and not has_table_privilege('authenticated', 'public.metric_records', 'SELECT')
    and not has_table_privilege('authenticated', 'public.data_uploads', 'SELECT')
    and not has_table_privilege('authenticated', 'public.assessment_attempts', 'SELECT')
    and not has_table_privilege(
      'authenticated', 'public.assessment_attempt_conditions', 'SELECT'
    )
    and not has_table_privilege(
      'authenticated', 'public.resting_heart_rate_readings', 'SELECT'
    )
    and not has_table_privilege(
      'authenticated', 'public.private_question_threads', 'SELECT'
    )
    and not has_table_privilege(
      'authenticated', 'public.private_question_answers', 'SELECT'
    ),
  'browser roles cannot directly select sensitive individual tables or import JSON'
);

select pg_temp.assert_true(
  not has_schema_privilege('plus_aggregate_exporter', 'private', 'USAGE')
    and has_schema_privilege('plus_service_worker', 'private', 'USAGE'),
  'aggregate exporter cannot enter private schema and worker can reach its allowlist'
);

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'program_memberships'
    and column_name = 'auth_activated_at'
) as has_auth_activation_column \gset
\if :has_auth_activation_column
select pg_temp.assert_true(
  pg_get_functiondef('private.current_actor_is_active()'::regprocedure)
    like '%auth_activated_at%',
  'final active actor gate requires the server-owned activation marker'
);
select 'SECURITY_AUTH_ACTIVATION_SCHEMA_PASS' as result;
\endif

select 'SECURITY_SCHEMA_PASS' as result;
