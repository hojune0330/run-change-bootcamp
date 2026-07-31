grant select on public.profiles, public.organizations, public.organization_memberships,
  public.programs, public.program_memberships, public.program_sessions,
  public.time_trial_decisions, public.assignments, public.announcements,
  public.homework_submissions, public.data_uploads, public.metric_records,
  public.ai_requests to authenticated;
grant insert on public.homework_submissions, public.data_uploads, public.metric_records to authenticated;
grant update, delete on public.homework_submissions, public.data_uploads, public.metric_records to authenticated;
grant insert, update, delete on public.program_sessions, public.time_trial_decisions,
  public.assignments, public.announcements to authenticated;
grant insert, update, delete on public.organization_memberships, public.programs,
  public.program_memberships to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists profiles_select_directory on public.profiles;
create policy profiles_select_directory on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.program_memberships viewer
    join public.program_memberships listed on listed.program_id = viewer.program_id
    where viewer.profile_id = (select auth.uid())
      and viewer.role in ('participant', 'coach', 'admin') and viewer.status = 'active'
      and listed.profile_id = profiles.id and listed.status = 'active'
  )
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations for select to authenticated
using (private.has_org_role(id, array['participant', 'coach', 'admin', 'stakeholder']));
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
using (private.has_org_role(id, array['admin'])) with check (private.has_org_role(id, array['admin']));

drop policy if exists organization_memberships_select_scoped on public.organization_memberships;
create policy organization_memberships_select_scoped on public.organization_memberships for select to authenticated using (
  profile_id = (select auth.uid())
  or private.has_org_role(organization_id, array['coach', 'admin'])
);
drop policy if exists organization_memberships_insert_admin on public.organization_memberships;
create policy organization_memberships_insert_admin on public.organization_memberships for insert to authenticated
with check (private.has_org_role(organization_id, array['admin']));
drop policy if exists organization_memberships_update_admin on public.organization_memberships;
create policy organization_memberships_update_admin on public.organization_memberships for update to authenticated
using (private.has_org_role(organization_id, array['admin']))
with check (private.has_org_role(organization_id, array['admin']));
drop policy if exists organization_memberships_delete_admin on public.organization_memberships;
create policy organization_memberships_delete_admin on public.organization_memberships for delete to authenticated
using (private.has_org_role(organization_id, array['admin']));

drop policy if exists programs_select_member on public.programs;
create policy programs_select_member on public.programs for select to authenticated using (
  private.has_program_role(id, array['participant', 'coach', 'admin', 'stakeholder'])
  or private.has_org_role(organization_id, array['admin'])
);
drop policy if exists programs_insert_admin on public.programs;
create policy programs_insert_admin on public.programs for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['admin']));
drop policy if exists programs_update_staff on public.programs;
create policy programs_update_staff on public.programs for update to authenticated
using (private.has_program_role(id, array['coach', 'admin']))
with check (private.has_org_role(organization_id, array['coach', 'admin']));
drop policy if exists programs_delete_admin on public.programs;
create policy programs_delete_admin on public.programs for delete to authenticated
using (private.has_org_role(organization_id, array['admin']));

drop policy if exists program_memberships_select_scoped on public.program_memberships;
create policy program_memberships_select_scoped on public.program_memberships for select to authenticated using (
  profile_id = (select auth.uid())
  or private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);
drop policy if exists program_memberships_insert_admin on public.program_memberships;
create policy program_memberships_insert_admin on public.program_memberships for insert to authenticated
with check (private.has_program_role(program_id, array['admin']));
drop policy if exists program_memberships_update_admin on public.program_memberships;
create policy program_memberships_update_admin on public.program_memberships for update to authenticated
using (private.has_program_role(program_id, array['admin']))
with check (private.has_program_role(program_id, array['admin']));
drop policy if exists program_memberships_delete_admin on public.program_memberships;
create policy program_memberships_delete_admin on public.program_memberships for delete to authenticated
using (private.has_program_role(program_id, array['admin']));

drop policy if exists sessions_select_member on public.program_sessions;
create policy sessions_select_member on public.program_sessions for select to authenticated
using (private.has_program_role(program_id, array['participant', 'coach', 'admin', 'stakeholder']));
drop policy if exists sessions_write_staff on public.program_sessions;
create policy sessions_write_staff on public.program_sessions for all to authenticated
using (private.has_program_role(program_id, array['coach', 'admin']))
with check (private.has_program_role(program_id, array['coach', 'admin']));

drop policy if exists time_trials_select_member on public.time_trial_decisions;
create policy time_trials_select_member on public.time_trial_decisions for select to authenticated
using (private.has_program_role(program_id, array['participant', 'coach', 'admin', 'stakeholder']));
drop policy if exists time_trials_write_staff on public.time_trial_decisions;
create policy time_trials_write_staff on public.time_trial_decisions for all to authenticated
using (private.has_program_role(program_id, array['coach', 'admin']))
with check (decided_by = (select auth.uid()) and private.has_program_role(program_id, array['coach', 'admin']));

drop policy if exists assignments_select_member on public.assignments;
create policy assignments_select_member on public.assignments for select to authenticated
using (published_at is not null and private.has_program_role(program_id, array['participant', 'coach', 'admin', 'stakeholder'])
  or private.has_program_role(program_id, array['coach', 'admin']));
drop policy if exists assignments_write_staff on public.assignments;
create policy assignments_write_staff on public.assignments for all to authenticated
using (private.has_program_role(program_id, array['coach', 'admin']))
with check (created_by = (select auth.uid()) and private.has_program_role(program_id, array['coach', 'admin']));

drop policy if exists announcements_select_member on public.announcements;
create policy announcements_select_member on public.announcements for select to authenticated
using (published_at is not null and private.has_program_role(program_id, array['participant', 'coach', 'admin', 'stakeholder'])
  or private.has_program_role(program_id, array['coach', 'admin']));
drop policy if exists announcements_write_staff on public.announcements;
create policy announcements_write_staff on public.announcements for all to authenticated
using (private.has_program_role(program_id, array['coach', 'admin']))
with check (created_by = (select auth.uid()) and private.has_program_role(program_id, array['coach', 'admin']));

drop policy if exists submissions_select_owner_staff on public.homework_submissions;
create policy submissions_select_owner_staff on public.homework_submissions for select to authenticated using (
  participant_id = (select auth.uid()) or private.has_program_role(program_id, array['coach', 'admin'])
);
drop policy if exists submissions_insert_owner on public.homework_submissions;
create policy submissions_insert_owner on public.homework_submissions for insert to authenticated with check (
  participant_id = (select auth.uid()) and private.has_program_role(program_id, array['participant'])
);
drop policy if exists submissions_update_owner on public.homework_submissions;
create policy submissions_update_owner on public.homework_submissions for update to authenticated
using (participant_id = (select auth.uid()))
with check (participant_id = (select auth.uid()) and private.has_program_role(program_id, array['participant']));
drop policy if exists submissions_delete_owner on public.homework_submissions;
create policy submissions_delete_owner on public.homework_submissions for delete to authenticated
using (participant_id = (select auth.uid()) and status = 'draft');

drop policy if exists uploads_owner_only on public.data_uploads;
create policy uploads_owner_only on public.data_uploads for all to authenticated
using (owner_profile_id = (select auth.uid()))
with check (owner_profile_id = (select auth.uid()) and private.has_program_role(program_id, array['participant']));

drop policy if exists metrics_consent_select on public.metric_records;
create policy metrics_consent_select on public.metric_records for select to authenticated
using (private.can_read_metric(id));
drop policy if exists metrics_owner_insert on public.metric_records;
create policy metrics_owner_insert on public.metric_records for insert to authenticated with check (
  owner_profile_id = (select auth.uid()) and private.has_program_role(program_id, array['participant'])
);
drop policy if exists metrics_owner_update on public.metric_records;
create policy metrics_owner_update on public.metric_records for update to authenticated
using (owner_profile_id = (select auth.uid()))
with check (
  owner_profile_id = (select auth.uid())
  and private.has_program_role(program_id, array['participant'])
);
drop policy if exists metrics_owner_delete on public.metric_records;
create policy metrics_owner_delete on public.metric_records for delete to authenticated
using (owner_profile_id = (select auth.uid()));

drop policy if exists ai_requests_select_owner on public.ai_requests;
create policy ai_requests_select_owner on public.ai_requests for select to authenticated
using (requested_by = (select auth.uid()));

comment on policy metrics_consent_select on public.metric_records is
  'Owner reads are direct; activity staff reads are scoped; health and stakeholder reads require active named consent.';
