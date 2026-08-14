# Garmin connection and FIT gate

**Decision (2026-08-12): NO-GO.** The default is **NO provider connection** and
**NO FIT acceptance**.

This record is a decision boundary, not an integration promise. The public
GitHub Pages surface remains **synthetic/demo-only**: seeded/demo data. Its
browser-local demo import is not a production health system of record and must
not expose or ship real accepted insights, provider credentials/tokens, or raw
uploaded health data. Any future pilot use must remain **participant-only and
nonmedical**; it must not make diagnosis, treatment, ranking, or causal claims.

## Closed gates

| Gate | Current status | Re-entry evidence | Owner |
| --- | --- | --- | --- |
| Provider approval and commercial terms | **Closed** | Written Garmin approval for the exact product, region, data fields, and retention scope; executed commercial terms | Product + legal |
| Privacy and security package | **Closed** | Vendor DPA; documented Korea transfer/residency decision; deletion and retention procedure with proof; security review evidence covering access, subprocessors, incidents, and auditability | Privacy + security |
| FIT runtime and license | **Closed** | Audited FIT runtime/decoder, license compatibility review, representative test corpus, provenance checks, and a documented no-raw-file-storage path | Engineering + security |

## Current facts

These facts are external or conditional and must not be read as commitments:

- **This project's** Garmin Connect Developer API access is unavailable pending
  written approval and a license key: we have neither. Public Garmin
  program/docs may continue to invite applications; that external availability
  does not authorize this integration.
- Unofficial MCP access, login automation, and copied session cookies are
  excluded.
- The FIT browser parser remains unsupported. The existing import boundary
  rejects undecoded binary content and requires an audited decoder before
  metrics can become drafts.

## Re-entry checklist

Re-open the decision only when every item has an attached, reviewable artifact
and a named owner sign-off:

- [ ] Written provider approval and commercial terms cover the intended scope.
- [ ] Vendor DPA, Korea transfer/residency, deletion, retention, and security
      evidence are accepted by the responsible reviewers.
- [ ] The FIT runtime is audited, license-compatible, tested against a
      representative corpus, and its provenance/deletion behavior is recorded.
- [ ] The pilot scope is still participant-only and nonmedical.
- [ ] Public Pages remains synthetic/demo-only; any browser-local demo import is
      not a production system of record and exposes/ships no real accepted
      insights, provider credentials/tokens, or raw uploaded health data.
- [ ] A dated GO decision names the accountable product, legal/privacy,
      security, and engineering owners.

Until then, do not add provider credentials, connection configuration, schema
values, FIT acceptance, or unofficial access paths.
