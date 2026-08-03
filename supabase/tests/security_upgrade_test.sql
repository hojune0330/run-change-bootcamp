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

create or replace function pg_temp.state_checksum()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  relation_hash text;
  payload text := '';
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('auth', 'public', 'storage')
      and relation.relkind in ('r', 'p')
    order by namespace.nspname, relation.relname
  loop
    execute pg_catalog.format(
      'select pg_catalog.md5(coalesce(pg_catalog.string_agg('
      || 'pg_catalog.to_jsonb(source_row)::text, E''\n'' order by '
      || 'pg_catalog.to_jsonb(source_row)::text), '''')) from %I.%I source_row',
      target.schema_name,
      target.table_name
    ) into relation_hash;
    payload := payload || target.schema_name || '.' || target.table_name
      || ':' || relation_hash || E'\n';
  end loop;
  return pg_catalog.md5(payload);
end;
$$;

\ir security_upgrade_seed.sql

create temporary table security_upgrade_state as
select pg_temp.state_checksum() as checksum;

\ir ../migrations/202607310013_security_role_matrix.sql

select pg_temp.assert_true(
  pg_temp.state_checksum() = (select checksum from security_upgrade_state),
  'migration 013 preserves every auth public and storage row byte-for-byte'
);
select pg_temp.assert_true(
  (select display_name = 'Legacy participant'
    from public.profiles
    where id = '90000000-0000-0000-0000-000000000002')
  and (select elapsed_seconds = 1000 and status = 'accepted'
    from public.assessment_attempts
    where id = '90000000-0000-0000-0000-000000000521')
  and (select bpm = 60 and status = 'accepted'
    from public.resting_heart_rate_readings
    where id = '90000000-0000-0000-0000-000000000531')
  and (select question_body = 'Legacy private question retained.'
    from public.private_question_threads
    where id = '90000000-0000-0000-0000-000000000601')
  and (select body = 'Open PLUS Run to view this update.'
    from public.notification_records
    where id = '90000000-0000-0000-0000-000000000611'),
  'upgrade retains measurement Q&A and lifecycle values exactly'
);
select pg_temp.assert_true(
  current_setting('server_version') = '17.10'
    and to_regprocedure(
      'public.read_suppressed_report_snapshot(uuid)'
    ) is not null,
  'upgrade runs on exact PostgreSQL 17.10 and installs security projections'
);

select 'SECURITY_UPGRADE_PASS' as result;
