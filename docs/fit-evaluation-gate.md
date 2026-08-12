# FIT decoder evaluation gate

**Decision (2026-08-12): CLOSED for production.** This repository may retain
evaluation evidence, but it must not accept or decode FIT bytes in the browser.
`parseFit()` remains an explicit rejection with
`fit_binary_requires_audited_decoder` until the runtime, license, and security
review gates below are closed.

## What is proven

The isolated execution record at
`.omo/ulw-research/20260811-garmin-interop/verify-fit-sdk.md` pins the official
Garmin FIT Python SDK **21.212.0** at source SHA
`42039653c2737132ef08ad483d492ab2e639d217`. It used the source-tree fixture
`tests/fits/ActivityDevFields.fit` only; no employee file, credential, or
product-worktree file was used.

This change is intentionally docs-only: the execution evidence already exists,
while a committed harness would need to fetch or redistribute an SDK/fixture
whose repository license is not yet cleared. The note therefore records the
auditable contract without adding a dependency, binary, or inert duplicate.

The valid-fixture observation was:

- `Decoder(stream).is_fit()` -> `True`;
- `check_integrity()` -> `True`;
- reset/recreate the stream **after** integrity checking, then decode;
- `record_mesgs=3,601`, `activity_mesgs=1`, decoder errors `0`.

`check_integrity()` consumes the stream to EOF. A decode without the reset is
therefore an evaluation failure (the observed message-group count is `0`), not
evidence that a valid file has no metrics.

## Required evaluation vectors

These vectors are the minimum future, non-user-fixture harness contract. A
rejected vector produces no metrics or review draft:

| Vector | Required observation |
| --- | --- |
| Valid FIT | FIT header and integrity pass; only the post-reset decode may report read counts. |
| Bad CRC / CRC-invalid FIT | Integrity fails; no metrics. |
| Truncated FIT | Header/integrity or decode fails; no metrics. |
| Non-FIT bytes | `is_fit()` fails; no metrics. |
| Reset after integrity | The harness resets/recreates the stream before `read()`; omission is a failure. |

User data and binary fixtures are never committed. The source fixture's
distribution permission and every future fixture checksum must be reviewed
before adding it to a controlled evaluation corpus.

## License and re-entry gate

The **repository license status for the pinned SDK is unresolved**. Technical
success is not permission to ship or redistribute the decoder. Until written
license compatibility/audit approval, representative-fixture review, and a
security/privacy review are attached to a named owner, the decoder gate stays
closed. There is no production FIT acceptance, browser import, raw-byte
storage, automatic SDK download, user-file execution, or Pages exposure.

Any future non-production harness must be inert unless both
`FIT_EVALUATION_LICENSE_APPROVED=1` and an explicit local, non-user fixture path
are supplied. With either input absent it may only report the closed gate; it
must never fetch or execute the SDK, discover fixtures, or touch browser code.
Re-entry additionally requires the five vectors above to pass in an isolated
runtime and a dated written GO decision from engineering, security, and legal.

## Boundary checks

The current product rejection remains covered by
`src/data/imports/importers.test.ts`. Re-run that focused test and confirm the
boundary with:

```text
pnpm exec vitest run src/data/imports/importers.test.ts
rg -n "parseFit|fit_binary_requires_audited_decoder" src/data/imports
```

Official references: [pinned SDK source](https://github.com/garmin/fit-python-sdk/tree/42039653c2737132ef08ad483d492ab2e639d217), [decoder implementation](https://github.com/garmin/fit-python-sdk/blob/42039653c2737132ef08ad483d492ab2e639d217/garmin_fit_sdk/decoder.py), and [Garmin integrity guidance](https://developer.garmin.com/fit/cookbook/isfit-checkintegrity-read/).
