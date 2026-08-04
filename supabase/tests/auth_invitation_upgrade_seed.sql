\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'program_invitations'
  ) then
    alter publication supabase_realtime add table public.program_invitations;
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'accepted@example.test', '{"display_name":"Accepted"}'),
  ('10000000-0000-4000-8000-000000000002', 'pending@example.test', '{"display_name":"Pending"}'),
  ('10000000-0000-4000-8000-000000000003', 'expired@example.test', '{"display_name":"Expired"}'),
  ('10000000-0000-4000-8000-000000000004', 'suspended@example.test', '{"display_name":"Suspended"}'),
  ('10000000-0000-4000-8000-000000000005', 'withdrawn@example.test', '{"display_name":"Withdrawn"}'),
  ('10000000-0000-4000-8000-000000000006', 'deleted@example.test', '{"display_name":"Deleted"}'),
  ('10000000-0000-4000-8000-000000000007', 'legacy@example.test', '{"display_name":"Legacy"}'),
  ('10000000-0000-4000-8000-000000000008', 'unknown@example.test', '{"display_name":"Unknown"}'),
  ('10000000-0000-4000-8000-000000000009', 'admin@example.test', '{"display_name":"Admin"}');

insert into public.organizations (id, name) values
  ('10000000-0000-4000-8000-000000000100', 'Auth invitation test organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000001', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000002', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000003', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000204', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000004', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000205', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000005', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000206', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000006', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000207', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000007', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000209', '10000000-0000-4000-8000-000000000100', '10000000-0000-4000-8000-000000000009', 'admin', 'active', now() - interval '1 day');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '10000000-0000-4000-8000-000000000300',
  '10000000-0000-4000-8000-000000000100',
  'Auth invitation test program', current_date - 1, current_date + 30,
  'active', '10000000-0000-4000-8000-000000000001'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('10000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000001', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000402', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000002', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000403', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000003', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000404', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000004', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000405', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000005', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000406', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000006', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000407', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000007', 'participant', 'active', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000409', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000009', 'admin', 'active', now() - interval '1 day');

update public.organization_memberships
set status = 'suspended'
where id = '10000000-0000-4000-8000-000000000204';

insert into public.program_invitations (
  id, program_id, invitee_profile_id, invitee_email_hash, role,
  status, invited_at, expires_at, accepted_at
) values
  ('10000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000001', encode(extensions.digest(convert_to('accepted@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'accepted', now() - interval '1 day', now() + interval '1 day', now() - interval '1 hour'),
  ('10000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000002', encode(extensions.digest(convert_to('pending@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'created', now() - interval '1 day', now() + interval '1 day', null),
  ('10000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000003', encode(extensions.digest(convert_to('expired@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'sent', now() - interval '1 day', now() + interval '1 day', null),
  ('10000000-0000-4000-8000-000000000504', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000004', encode(extensions.digest(convert_to('suspended@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'accepted', now() - interval '1 day', now() + interval '1 day', now() - interval '1 hour'),
  ('10000000-0000-4000-8000-000000000505', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000005', encode(extensions.digest(convert_to('withdrawn@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'accepted', now() - interval '1 day', now() + interval '1 day', now() - interval '1 hour'),
  ('10000000-0000-4000-8000-000000000506', '10000000-0000-4000-8000-000000000300', '10000000-0000-4000-8000-000000000006', encode(extensions.digest(convert_to('deleted@example.test', 'UTF8'), 'sha256'), 'hex'), 'participant', 'accepted', now() - interval '1 day', now() + interval '1 day', now() - interval '1 hour');

insert into public.program_enrollments (
  id, program_id, profile_id, program_membership_id, invitation_id,
  lifecycle_status, enrolled_on, withdrawn_at
) values (
  '10000000-0000-4000-8000-000000000605',
  '10000000-0000-4000-8000-000000000300',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000405',
  '10000000-0000-4000-8000-000000000505',
  'withdrawn', current_date - 1, now() - interval '1 hour'
);

update public.profiles
set lifecycle_status = 'disabled'
where id = '10000000-0000-4000-8000-000000000006';

select 'AUTH_INVITATION_UPGRADE_SEED_PASS' as result;
