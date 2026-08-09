-- Restore the aggregate-exporter execution boundary asserted by
-- supabase/tests/security_function_boundary_test.sql:89
-- ("aggregate exporter can execute exactly one projection function").
--
-- public.coach_dashboard_snapshot(uuid) was added in
-- 202608050001_coach_dashboard_snapshot.sql but its revoke/grant block was
-- omitted, so the function kept the default PUBLIC EXECUTE ACL. Because
-- plus_aggregate_exporter is a member of PUBLIC, the role gained a second
-- executable projection function (coach_dashboard_snapshot in addition to
-- read_suppressed_report_snapshot) and the security gate started failing.
--
-- This mirrors the sibling snapshot function convention used in the same
-- migration (coach_participant_detail_snapshot) and in
-- 202608050002_participant_snapshot.sql: revoke from public + anon, then
-- grant explicitly to authenticated.

revoke all on function public.coach_dashboard_snapshot(uuid)
  from public, anon;

grant execute on function public.coach_dashboard_snapshot(uuid)
  to authenticated;

comment on function public.coach_dashboard_snapshot(uuid) is
  'Staff-only roster projection. Health values are never included: only accepted-metric timestamps and counts are exposed for freshness/trend badges.';
