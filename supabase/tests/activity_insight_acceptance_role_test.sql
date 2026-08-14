do $$
declare
  orchestration_signature text :=
    'public.accept_activity_import_and_rebuild(jsonb,jsonb,uuid)';
begin
  if to_regprocedure(orchestration_signature) is null then
    raise exception 'Task 6 acceptance orchestration function is missing';
  end if;
  if has_function_privilege('anon', orchestration_signature, 'EXECUTE')
    or has_function_privilege('authenticated', orchestration_signature, 'EXECUTE')
    or not has_function_privilege('service_role', orchestration_signature, 'EXECUTE')
    or has_function_privilege(
      'authenticated',
      'private.activity_insight_has_active_consent(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.participant_can_read_activity_insight(uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.participant_can_read_activity_insight(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'private.accept_structured_import(uuid,uuid,uuid,text,timestamptz,text,text,text[],jsonb,uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'private.rebuild_activity_insight(uuid,uuid,date,uuid[])',
      'EXECUTE'
    ) then
    raise exception 'Task 6 acceptance and rebuild functions are not service-only';
  end if;
end;
$$;

set role anon;
do $$
begin
  begin
    perform public.accept_activity_import_and_rebuild(
      payload.rebuild, payload.accepted_import, payload.consent_grant_id
    ) from activity_insight_acceptance_payload payload;
    raise exception 'expected anonymous acceptance rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub', '70000000-0000-4000-8000-000000000103', false
);
do $$
begin
  begin
    perform public.accept_activity_import_and_rebuild(
      payload.rebuild, payload.accepted_import, payload.consent_grant_id
    ) from activity_insight_acceptance_payload payload;
    raise exception 'expected authenticated acceptance rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.activity_insight_has_active_consent(
      '00000000-0000-4000-8000-000000000000'
    );
    raise exception 'expected authenticated private consent helper rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select 'TASK6_ROLE_MATRIX_PASS' as result;
