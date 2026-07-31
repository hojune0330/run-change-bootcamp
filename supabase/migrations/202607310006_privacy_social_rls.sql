grant select, insert, update on public.metric_consents, public.account_deletion_requests to authenticated;
grant select on public.audit_events, public.feed_posts, public.feed_comments, public.feed_reactions,
  public.feedback_items, public.feedback_review_events, public.push_subscriptions,
  public.notification_records to authenticated;
grant insert, update, delete on public.feed_posts, public.feed_comments, public.feed_reactions,
  public.feedback_items, public.push_subscriptions to authenticated;
revoke update on public.notification_records from authenticated;
grant update (read_at) on public.notification_records to authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;

drop policy if exists consents_select_parties on public.metric_consents;
create policy consents_select_parties on public.metric_consents for select to authenticated using (
  owner_profile_id = (select auth.uid()) or grantee_profile_id = (select auth.uid())
);
drop policy if exists consents_insert_owner on public.metric_consents;
create policy consents_insert_owner on public.metric_consents for insert to authenticated with check (
  owner_profile_id = (select auth.uid())
  and exists (select 1 from public.metric_records metric where metric.id = metric_record_id and metric.owner_profile_id = (select auth.uid()))
);
drop policy if exists consents_revoke_owner on public.metric_consents;
create policy consents_revoke_owner on public.metric_consents for update to authenticated
using (owner_profile_id = (select auth.uid()) and revoked_at is null)
with check (owner_profile_id = (select auth.uid()) and revoked_at is not null);

drop policy if exists audits_select_subject_staff on public.audit_events;
create policy audits_select_subject_staff on public.audit_events for select to authenticated using (
  actor_profile_id = (select auth.uid()) or subject_profile_id = (select auth.uid())
  or private.has_org_role(organization_id, array['coach', 'admin'])
);

drop policy if exists deletion_requests_select_self on public.account_deletion_requests;
create policy deletion_requests_select_self on public.account_deletion_requests for select to authenticated
using (profile_id = (select auth.uid()));
drop policy if exists deletion_requests_insert_self on public.account_deletion_requests;
create policy deletion_requests_insert_self on public.account_deletion_requests for insert to authenticated
with check (profile_id = (select auth.uid()) and status = 'requested');
drop policy if exists deletion_requests_cancel_self on public.account_deletion_requests;
create policy deletion_requests_cancel_self on public.account_deletion_requests for update to authenticated
using (profile_id = (select auth.uid()) and status = 'requested')
with check (profile_id = (select auth.uid()) and status = 'cancelled');

drop policy if exists feed_posts_select_member on public.feed_posts;
create policy feed_posts_select_member on public.feed_posts for select to authenticated using (
  deleted_at is null and private.has_program_role(program_id, array['participant', 'coach', 'admin'])
  and (visibility = 'cohort' or private.has_program_role(program_id, array['coach', 'admin']))
);
drop policy if exists feed_posts_insert_member on public.feed_posts;
create policy feed_posts_insert_member on public.feed_posts for insert to authenticated with check (
  author_profile_id = (select auth.uid())
  and private.has_program_role(program_id, array['participant', 'coach', 'admin'])
);
drop policy if exists feed_posts_update_author on public.feed_posts;
create policy feed_posts_update_author on public.feed_posts for update to authenticated
using (author_profile_id = (select auth.uid())) with check (author_profile_id = (select auth.uid()));
drop policy if exists feed_posts_delete_author on public.feed_posts;
create policy feed_posts_delete_author on public.feed_posts for delete to authenticated
using (author_profile_id = (select auth.uid()));

drop policy if exists feed_comments_select_post_member on public.feed_comments;
create policy feed_comments_select_post_member on public.feed_comments for select to authenticated using (
  deleted_at is null and exists (select 1 from public.feed_posts post where post.id = post_id)
);
drop policy if exists feed_comments_insert_member on public.feed_comments;
create policy feed_comments_insert_member on public.feed_comments for insert to authenticated with check (
  author_profile_id = (select auth.uid())
  and exists (select 1 from public.feed_posts post where post.id = post_id)
);
drop policy if exists feed_comments_update_author on public.feed_comments;
create policy feed_comments_update_author on public.feed_comments for update to authenticated
using (author_profile_id = (select auth.uid())) with check (author_profile_id = (select auth.uid()));
drop policy if exists feed_comments_delete_author on public.feed_comments;
create policy feed_comments_delete_author on public.feed_comments for delete to authenticated
using (author_profile_id = (select auth.uid()));

drop policy if exists feed_reactions_select_post_member on public.feed_reactions;
create policy feed_reactions_select_post_member on public.feed_reactions for select to authenticated
using (exists (select 1 from public.feed_posts post where post.id = post_id));
drop policy if exists feed_reactions_insert_self on public.feed_reactions;
create policy feed_reactions_insert_self on public.feed_reactions for insert to authenticated with check (
  author_profile_id = (select auth.uid())
  and exists (select 1 from public.feed_posts post where post.id = post_id)
);
drop policy if exists feed_reactions_delete_self on public.feed_reactions;
create policy feed_reactions_delete_self on public.feed_reactions for delete to authenticated
using (author_profile_id = (select auth.uid()));

drop policy if exists feedback_select_participant_staff on public.feedback_items;
create policy feedback_select_participant_staff on public.feedback_items for select to authenticated using (
  (participant_id = (select auth.uid()) and status = 'published')
  or private.has_program_role(program_id, array['coach', 'admin'])
);
drop policy if exists feedback_insert_staff on public.feedback_items;
create policy feedback_insert_staff on public.feedback_items for insert to authenticated with check (
  origin = 'coach' and created_by = (select auth.uid())
  and private.has_program_role(program_id, array['coach', 'admin'])
);

drop policy if exists feedback_reviews_select_parties on public.feedback_review_events;
create policy feedback_reviews_select_parties on public.feedback_review_events for select to authenticated using (
  reviewer_profile_id = (select auth.uid()) or exists (
    select 1 from public.feedback_items feedback
    where feedback.id = feedback_id and feedback.participant_id = (select auth.uid())
  )
);

drop policy if exists push_subscriptions_owner_only on public.push_subscriptions;
create policy push_subscriptions_owner_only on public.push_subscriptions for all to authenticated
using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

drop policy if exists notifications_select_owner on public.notification_records;
create policy notifications_select_owner on public.notification_records for select to authenticated
using (recipient_profile_id = (select auth.uid()));
drop policy if exists notifications_mark_read_owner on public.notification_records;
create policy notifications_mark_read_owner on public.notification_records for update to authenticated
using (recipient_profile_id = (select auth.uid())) with check (recipient_profile_id = (select auth.uid()));

comment on policy consents_revoke_owner on public.metric_consents is
  'The owner may revoke; trigger/audit history prevents silent consent disappearance. Direct delete is not granted.';
comment on policy feedback_select_participant_staff on public.feedback_items is
  'Stakeholders never receive feedback rows; only separately consented metric rows may cross that boundary.';
