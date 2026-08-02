# Backend blueprint

This directory describes the production boundary implemented in `supabase/`. The SQL
migrations are ordered, repeatable, and use `if not exists`, replaceable functions, and
drop/create policies. Run them on a new local Supabase database before any hosted project.

## Security model

- `auth.uid()` is the only caller identity. Request bodies never accept a user ID.
- Organization and program roles are database rows, not user-editable JWT metadata.
- Health metrics default to `sensitivity = 'health'`. Only the owner can read them until a
  named coach, admin, or stakeholder has a same-organization consent that is unrevoked and
  unexpired. Stakeholders have no cohort-directory, feedback, submission, upload, or feed
  access; their only individual data path is a separately consented metric row.
- Raw screenshots/imports are private and owner-only even after metric consent. Consent is
  for one structured metric, not its source file.
- Consent cannot be deleted by clients or reactivated after revocation. A new grant is
  required after revocation, and both grants and reads require current program,
  organization, and membership windows. Grant, change, and revoke events are appended to
  `audit_events`; audit details contain identifiers, never copied health values.
- The service-role key and OpenAI key exist only in Edge Function secrets. Browser modules
  receive neither key. Gateway JWT verification is enabled and each function also resolves
  the token with `auth.getUser`.
- Realtime publishes operational/feed tables only. Metrics, uploads, consents, audit events,
  AI jobs, push subscriptions, and the outbox are deliberately excluded.

## Browser pilot boundary

The browser has two explicit modes. `preview` is the default and keeps the seeded
`DemoRepository`/localStorage behavior. `pilot` never constructs that repository. Missing,
partial, ambiguous, or malformed public Supabase configuration renders a fail-closed screen
before a Supabase client or demo storage adapter is created.

Pilot accepts one project URL and exactly one public publishable/legacy anon key. The client
uses PKCE, a dedicated `run-change:pilot-auth` storage key, persisted auto-refresh, and
`detectSessionInUrl: false`; this boundary does not consume auth parameters from arbitrary
browser URLs. Its current auth facade is deliberately limited to session read/subscription,
registered-email `signInWithOtp` with implicit signup disabled, and sign-out. OTP verification
or callback exchange is not implemented in this slice.

The injected pilot gateway exposes the smallest SQL-backed consent/audit contract:

- consent grant inserts `metric_consents`; `owner_profile_id` is derived from the authenticated
  Supabase session and RLS rechecks `auth.uid()`;
- revocation updates only `revoked_at` and optional `revocation_reason` for a consent id;
- audit access selects the trigger-written `audit_events` projection; the browser cannot insert,
  update, or delete audit rows;
- caller inputs are strict and reject extra identity or secret fields.

Operational participant/coach data is not wired into the pilot UI. These are static and local
browser contract claims only, not evidence of a hosted Supabase project or real credentials.

## Storage convention

Use the private `screenshots` or `health-imports` bucket and this object key:

```text
<auth-user-uuid>/<upload-uuid>/<sanitized-filename>
```

The filename is 1-120 ASCII letters, numbers, dots, underscores, or hyphens with an allowed
extension. Bucket limits are 8 MiB for PNG/JPEG/WebP screenshots and 15 MiB for supported
imports. MIME and extension checks are admission filters, not content trust. Screenshot
extraction verifies byte signatures and size again; import adapters must parse their real
format before writing metrics. Never render uploaded SVG/HTML or trust an original filename.

## AI functions

Required server secrets are `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and
`OPENAI_SAFETY_SALT`. Leave any OpenAI value absent to disable the provider safely with a
503 response and no accepted metric or published feedback.

- `screenshot-to-metric-draft`: owner-authenticated upload lookup, duplicate request guard,
  byte validation, privacy-preserving safety identifier, Responses API call, then draft-only
  metric rows.
- `draft-feedback`: coach/admin authorization, deidentified submission text, structured AI
  output, and `pending_approval` storage.
- `review-feedback`: calls the atomic `review_feedback` RPC. Training changes, pain, and risk
  cannot publish without a coach/admin approval. The RPC writes review/audit events and a
  provider-neutral notification/outbox row.

OpenAI calls use the Responses API, `store: false`, strict JSON Schema, a server-HMAC safety
identifier, no filename/profile/name, and segregated untrusted user content. Email, Korean
phone, UUID, URL, and control-character patterns are removed from text. Screenshot pixels
cannot be proven deidentified server-side without a trusted image-redaction pipeline, so the
contract requires a cropped/deidentified attestation and sends no transport metadata. A
production privacy review should add deterministic on-server OCR/redaction before accepting
uncropped screenshots. Model output is untrusted and parsed again before persistence.

## Retry and deletion lifecycle

AI requests are unique by `(requested_by, idempotency_key)` and OpenAI receives the same
idempotency key. Succeeded requests replay, failed requests can be claimed again, and
processing requests use a five-minute compare-and-swap lease before stale recovery. Draft
rows are unique per AI request so a retry cannot duplicate stored results. Push endpoints
are database-hashed and unique per profile. Notification
delivery is represented in `notification_outbox`; workers should claim pending rows with
`for update skip locked`, use the outbox idempotency key, cap attempts at 10, and store only
error codes. No wearable or notification-vendor OAuth credentials belong in this schema.

An account deletion request marks the profile immediately; cancelling it restores the
profile to `active` and appends an audit event. A trusted worker must then delete
the Auth user; foreign-key cascades remove profiles, memberships, submissions, metrics,
consents, AI jobs, feedback, push subscriptions, and notifications. Before deleting the Auth
row, delete both storage prefixes for that user. `audit_events` survives only as a
pseudonymized operational record because profile foreign keys become null; configure a legal
retention window and purge it when no longer required. Never place free-text PII in audit
details.

## Verification

Run `pnpm exec vitest run src/integrations`, `pnpm typecheck`, and `pnpm lint`. With the
Supabase CLI and Docker installed, additionally run `supabase db reset`, `supabase db lint`,
`supabase functions serve`, and authenticated curl scenarios for owner, coach, admin, and
stakeholder tokens. This workstation lacks Supabase CLI, Deno, Docker, and `psql`, so the SQL
migrations and Deno bundle still require that local-runtime gate before deployment.
