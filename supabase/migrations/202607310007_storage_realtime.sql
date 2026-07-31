insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots', 'screenshots', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-imports', 'health-imports', false, 15728640,
  array[
    'application/octet-stream', 'application/json', 'application/xml', 'text/xml',
    'text/csv', 'application/gpx+xml', 'application/vnd.garmin.fit'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists screenshots_owner_select on storage.objects;
create policy screenshots_owner_select on storage.objects for select to authenticated using (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(png|jpg|jpeg|webp)$'
);
drop policy if exists screenshots_owner_insert on storage.objects;
create policy screenshots_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(png|jpg|jpeg|webp)$'
);
drop policy if exists screenshots_owner_delete on storage.objects;
create policy screenshots_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists health_imports_owner_select on storage.objects;
create policy health_imports_owner_select on storage.objects for select to authenticated using (
  bucket_id = 'health-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(fit|tcx|gpx|csv|xml|json)$'
);
drop policy if exists health_imports_owner_insert on storage.objects;
create policy health_imports_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'health-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(fit|tcx|gpx|csv|xml|json)$'
);
drop policy if exists health_imports_owner_delete on storage.objects;
create policy health_imports_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'health-imports' and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$
declare
  realtime_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach realtime_table in array array[
      'feed_posts', 'feed_comments', 'feed_reactions', 'assignments',
      'announcements', 'feedback_items', 'notification_records'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end loop;
  end if;
end;
$$;

comment on table storage.objects is
  'RUN CHANGE private object paths are <auth-uuid>/<upload-uuid>/<sanitized-filename>; raw health objects are never published to Realtime.';
