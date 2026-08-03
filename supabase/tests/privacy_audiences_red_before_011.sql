\set ON_ERROR_STOP on

select count(*) as consent_grant_count
from public.consent_grants;

select 'PRIVACY_AUDIENCES_RED_CONTRACT_PRESENT' as result;
