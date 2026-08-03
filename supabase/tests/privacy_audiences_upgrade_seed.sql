\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000009001', '{"display_name":"Legacy participant"}'),
  ('00000000-0000-0000-0000-000000009002', '{"display_name":"Legacy peer participant"}'),
  ('00000000-0000-0000-0000-000000009011', '{"display_name":"Legacy coach"}'),
  ('00000000-0000-0000-0000-000000009021', '{"display_name":"Legacy admin"}');

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000009100', 'Legacy privacy organization');

insert into public.organization_memberships (
  id, organization_id, profile_id, role, status, starts_at
) values
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009100', '00000000-0000-0000-0000-000000009001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009100', '00000000-0000-0000-0000-000000009002', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009111', '00000000-0000-0000-0000-000000009100', '00000000-0000-0000-0000-000000009011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009121', '00000000-0000-0000-0000-000000009100', '00000000-0000-0000-0000-000000009021', 'admin', 'active', now() - interval '1 day');

insert into public.programs (
  id, organization_id, title, starts_on, ends_on, status, created_by
) values (
  '00000000-0000-0000-0000-000000009200',
  '00000000-0000-0000-0000-000000009100',
  'Legacy privacy program', '2000-01-01', '2099-12-31', 'active',
  '00000000-0000-0000-0000-000000009021'
);

insert into public.program_memberships (
  id, program_id, profile_id, role, status, joined_at
) values
  ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009200', '00000000-0000-0000-0000-000000009001', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009202', '00000000-0000-0000-0000-000000009200', '00000000-0000-0000-0000-000000009002', 'participant', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009211', '00000000-0000-0000-0000-000000009200', '00000000-0000-0000-0000-000000009011', 'coach', 'active', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009221', '00000000-0000-0000-0000-000000009200', '00000000-0000-0000-0000-000000009021', 'admin', 'active', now() - interval '1 day');

insert into public.assignments (
  id, program_id, title, instructions, assignment_kind, published_at, created_by
) values (
  '00000000-0000-0000-0000-000000009301',
  '00000000-0000-0000-0000-000000009200',
  'Legacy health assignment', 'Private response requested', 'health', now(),
  '00000000-0000-0000-0000-000000009011'
);

insert into public.homework_submissions (
  id, assignment_id, program_id, participant_id, response_text, status, submitted_at
) values (
  '00000000-0000-0000-0000-000000009311',
  '00000000-0000-0000-0000-000000009301',
  '00000000-0000-0000-0000-000000009200',
  '00000000-0000-0000-0000-000000009001',
  'Legacy private health response 91', 'submitted', now()
);

insert into public.metric_records (
  id, program_id, owner_profile_id, submission_id, source, metric_type,
  numeric_value, unit, observed_at, sensitivity, verification_status
) values (
  '00000000-0000-0000-0000-000000009401',
  '00000000-0000-0000-0000-000000009200',
  '00000000-0000-0000-0000-000000009001',
  '00000000-0000-0000-0000-000000009311',
  'manual', 'heart_rate_bpm', 91, 'bpm', now(), 'health', 'accepted'
);

insert into public.metric_consents (
  id, metric_record_id, owner_profile_id, grantee_profile_id, grantee_role,
  purpose, granted_at, expires_at
) values
  (
    '00000000-0000-0000-0000-000000009411',
    '00000000-0000-0000-0000-000000009401',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000009011', 'coach',
    'legacy coach health review', now(), now() + interval '20 days'
  ),
  (
    '00000000-0000-0000-0000-000000009412',
    '00000000-0000-0000-0000-000000009401',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000009021', 'admin',
    'legacy administrative review', now(), now() + interval '20 days'
  );

insert into public.feed_posts (
  id, program_id, author_profile_id, body, visibility
) values (
  '00000000-0000-0000-0000-000000009501',
  '00000000-0000-0000-0000-000000009200',
  '00000000-0000-0000-0000-000000009001',
  'Legacy low-information social row', 'cohort'
);

insert into public.feed_posts (
  id, program_id, author_profile_id, submission_id, body, visibility
) values
  (
    '00000000-0000-0000-0000-000000009502',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000009311',
    'Legacy linked health feed payload 91', 'cohort'
  ),
  (
    '00000000-0000-0000-0000-000000009503',
    '00000000-0000-0000-0000-000000009200',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000009311',
    'Legacy linked health moderation payload 92', 'cohort'
  );

insert into public.feed_comments (id, post_id, author_profile_id, body) values
  (
    '00000000-0000-0000-0000-000000009512',
    '00000000-0000-0000-0000-000000009502',
    '00000000-0000-0000-0000-000000009001',
    'Legacy comment beneath linked health payload 91'
  ),
  (
    '00000000-0000-0000-0000-000000009513',
    '00000000-0000-0000-0000-000000009503',
    '00000000-0000-0000-0000-000000009001',
    'Legacy comment for controlled moderation 92'
  );

insert into public.feed_reactions (post_id, author_profile_id, reaction) values
  (
    '00000000-0000-0000-0000-000000009502',
    '00000000-0000-0000-0000-000000009001', 'heart'
  ),
  (
    '00000000-0000-0000-0000-000000009503',
    '00000000-0000-0000-0000-000000009001', 'heart'
  );

insert into public.feedback_items (
  id, program_id, participant_id, submission_id, origin, classification,
  body, status, created_by, approved_by, approved_at, published_at
) values (
  '00000000-0000-0000-0000-000000009601',
  '00000000-0000-0000-0000-000000009200',
  '00000000-0000-0000-0000-000000009001',
  '00000000-0000-0000-0000-000000009311',
  'coach', 'low_risk', 'Legacy private feedback body', 'published',
  '00000000-0000-0000-0000-000000009011',
  '00000000-0000-0000-0000-000000009011', now(), now()
);

insert into public.notification_records (
  id, recipient_profile_id, program_id, category, title, body,
  contains_sensitive_data, entity_type, entity_id
) values (
  '00000000-0000-0000-0000-000000009701',
  '00000000-0000-0000-0000-000000009001',
  '00000000-0000-0000-0000-000000009200',
  'feedback', 'Legacy heart rate 91', 'Legacy private feedback body', false,
  'feedback_item', '00000000-0000-0000-0000-000000009601'
);

select 'PRIVACY_AUDIENCES_UPGRADE_SEED_PASS' as result;
