create or replace function private.invalidate_activity_insights_for_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.purpose = 'program_data_processing'
    and (
      new.status <> 'active'
      or new.withdrawn_at is not null
      or new.expires_at <= statement_timestamp()
    ) then
    delete from public.activity_insights insight
    using public.activity_insight_sources source,
      public.accepted_structured_imports imported
    where source.activity_insight_id = insight.id
      and imported.id = source.accepted_structured_import_id
      and imported.consent_grant_id = old.id;
  end if;
  return new;
end;
$$;

create trigger activity_insights_invalidate_consent
after update of status, withdrawn_at, expires_at on public.consent_grants
for each row execute function private.invalidate_activity_insights_for_consent();

create or replace function private.activity_insight_has_active_consent(
  target_insight uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_insight_sources source
    where source.activity_insight_id = target_insight
  ) and not exists (
    select 1
    from public.activity_insight_sources source
    join public.accepted_structured_imports imported
      on imported.id = source.accepted_structured_import_id
    join public.consent_grants consent
      on consent.id = imported.consent_grant_id
    where source.activity_insight_id = target_insight
      and (
        consent.purpose <> 'program_data_processing'
        or consent.status <> 'active'
        or consent.withdrawn_at is not null
        or consent.granted_at > statement_timestamp()
        or consent.expires_at <= statement_timestamp()
      )
  );
$$;

create or replace function public.participant_can_read_activity_insight(
  target_insight uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_insights insight
    where insight.id = target_insight
      and insight.participant_profile_id = (select auth.uid())
      and private.is_active_program_member(
        (select auth.uid()), insight.program_id, 'participant'
      )
      and private.activity_insight_has_active_consent(insight.id)
  );
$$;

drop policy activity_insights_participant_select on public.activity_insights;
create policy activity_insights_participant_select
on public.activity_insights for select to authenticated using (
  (select public.participant_can_read_activity_insight(id))
);

delete from public.activity_insights insight
where not private.activity_insight_has_active_consent(insight.id);

revoke all on function private.invalidate_activity_insights_for_consent()
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
revoke all on function private.activity_insight_has_active_consent(uuid)
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
revoke all on function public.participant_can_read_activity_insight(uuid)
from public, anon, authenticated, service_role,
  plus_aggregate_exporter, plus_service_worker;
grant execute on function public.participant_can_read_activity_insight(uuid)
to authenticated;

comment on function public.participant_can_read_activity_insight(uuid) is
  'Authenticated participant-only RLS predicate; binds the current actor to insight ownership, membership, and active consent.';
