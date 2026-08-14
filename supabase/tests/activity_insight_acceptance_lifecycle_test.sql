begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
update public.consent_grants
set status = 'withdrawn', withdrawn_at = now(),
  withdrawn_by_profile_id = participant_profile_id,
  withdrawal_reason_code = 'participant_request'
where id = '70000000-0000-4000-8000-000000000201';
do $$
begin
  if exists (select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or pg_temp.activity_insight_orphan_count() <> 0 then
    raise exception 'withdrawn consent retained insight content or orphan sources';
  end if;
end;
$$;
rollback;

select 'TASK6_REVOKED_CONSENT_PASS' as result;

begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
alter table public.consent_grants disable trigger consent_grants_validate;
update public.consent_grants set expires_at = now() - interval '1 second'
where id = '70000000-0000-4000-8000-000000000201';
alter table public.consent_grants enable trigger consent_grants_validate;
do $$
begin
  if exists (select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or pg_temp.activity_insight_orphan_count() <> 0 then
    raise exception 'expired consent retained insight content or orphan sources';
  end if;
end;
$$;
rollback;

select 'TASK6_EXPIRED_CONSENT_PASS' as result;

begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
update public.accepted_structured_imports
set quality_flags = array['device_reported', 'duplicate_suspected']
where source_family = 'reviewed_csv';
do $$
begin
  if exists (select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or pg_temp.activity_insight_orphan_count() <> 0 then
    raise exception 'rejected source retained insight content or orphan sources';
  end if;
end;
$$;
rollback;

select 'TASK6_REJECTED_SOURCE_PASS' as result;

begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
delete from public.accepted_structured_imports where source_family = 'reviewed_csv';
set role service_role;
insert into activity_insight_acceptance_responses (attempt, payload)
select 'deleted_replay', public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
do $$
begin
  if (select payload ->> 'status' from activity_insight_acceptance_responses
      where attempt = 'deleted_replay') <> 'removed'
    or exists (select 1 from public.accepted_structured_imports
      where source_family = 'reviewed_csv')
    or exists (select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or pg_temp.activity_insight_orphan_count() <> 0 then
    raise exception 'deleted source replay resurrected insight data';
  end if;
end;
$$;
rollback;

select 'TASK6_SOURCE_DELETION_PASS' as result;

begin;
set role service_role;
select public.accept_activity_import_and_rebuild(
  payload.rebuild, payload.accepted_import, payload.consent_grant_id
) from activity_insight_acceptance_payload payload;
reset role;
delete from auth.users where id = '70000000-0000-4000-8000-000000000103';
do $$
begin
  if exists (select 1 from public.profiles
      where id = '70000000-0000-4000-8000-000000000103')
    or exists (select 1 from public.accepted_structured_imports
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or exists (select 1 from public.activity_insights
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or exists (select 1 from private.activity_insight_acceptance_requests
      where participant_profile_id = '70000000-0000-4000-8000-000000000103')
    or pg_temp.activity_insight_orphan_count() <> 0 then
    raise exception 'account deletion retained insight data or orphan sources';
  end if;
end;
$$;
rollback;

select 'TASK6_ACCOUNT_DELETION_PASS' as result;
