# GitHub Pages deployment

## Current public deployment

The public seeded preview is deployed from `main` at source SHA [`51cc142`](https://github.com/hojune0330/run-change-bootcamp/commit/51cc142ea8174ec4e8a9f488f607549ec52d3d35) (`51cc142ea8174ec4e8a9f488f607549ec52d3d35`). The successful [Pages run 31398439150](https://github.com/hojune0330/run-change-bootcamp/actions/runs/31398439150) produced that deployment. The current `agent/athlete-time-resume` branch is an unpublished local branch and is not represented by the public preview.

Historical status as of 2026-08-01: [PR #1](https://github.com/hojune0330/run-change-bootcamp/pull/1)
merged the Pages workflow. Its first `main` run,
[30679484294](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30679484294),
failed during runtime setup because it selected Node.js 22.12.0 while pnpm 11.9.0 requires a
newer Node runtime. [PR #2](https://github.com/hojune0330/run-change-bootcamp/pull/2) merged the
Node runtime and frozen-jsdom remediation; its Pages run
[30684336169](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30684336169)
succeeded. [PR #3](https://github.com/hojune0330/run-change-bootcamp/pull/3) merged the CJK
200% zoom fix at commit `19120516acdbe8ed5fe92a2f7001a42f5c4389be`; its Pages run
[30688513967](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30688513967)
also succeeded (build job [91338916652](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30688513967/job/91338916652),
deploy job [91339065601](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30688513967/job/91339065601)).
Deployment `5702409847` has successful status `16217793869`.

Repository: `hojune0330/run-change-bootcamp`

The public seeded preview is deployed at:

`https://hojune0330.github.io/run-change-bootcamp/`

## Command contracts

The default build and preview are a matched Pages pair:

```bash
pnpm build          # Pages artifact in dist
pnpm preview        # previews dist at /run-change-bootcamp/
pnpm test:e2e       # rebuilds dist, then runs all E2E against the Pages static server
```

The explicit local pair uses a separate ignored directory, so it cannot overwrite the Pages artifact:

```bash
pnpm build:local    # root-based artifact in .artifacts/local-preview
pnpm preview:local  # previews .artifacts/local-preview at /
pnpm test:e2e:local # rebuilds the local artifact, then runs non-Pages E2E
```

For static-host fidelity, run `pnpm build` followed by `pnpm serve:pages`. That server returns the
generated `404.html` with an actual 404 status for the supported direct route
`/run-change-bootcamp/record`, matching GitHub Pages while still allowing the client router to mount.
`/record/abc` is not a supported application route.

## GitHub Pages SPA semantics

`GET /run-change-bootcamp/record` returns HTTP 404 with the generated custom fallback, whose body
contains the same SPA shell as the root document. In a fresh unauthenticated browser context that
shell renders the session chooser. After selecting and persisting a participant session, navigating
to the direct route or hard-reloading it renders the record UI; the direct-route HTTP status remains
404. `/run-change-bootcamp/record/abc` remains unsupported and must not be treated as an SPA route.

## Deployment gate

Before uploading `dist`, `.github/workflows/deploy-pages.yml` runs the normal Vitest suite, the
serialized deployment-build suite, type and lint checks, a Pages build, deterministic Playwright
Chromium installation, and `pnpm test:e2e:pages:artifact`. The browser gate has no conditional skips
and verifies the Pages base path, the `/record` direct route, PWA registration and scope, emitted
metadata, compression and representation validators, and traversal/base-path rejection.

The PWA manifest, service-worker registration, icon URLs, service-worker scope, and navigation
fallback are emitted below `/run-change-bootcamp/`. No runtime or deployment secrets are required.

## Deployment status

The `Deploy to GitHub Pages` workflow publishes the `dist` artifact through the existing Pages
configuration and exposes the final URL through the `github-pages` deployment environment. Future
changes, including the unpublished local branch, still need the same workflow gate before they
replace the public preview. Hosted Supabase, real accounts, and real participant data are not
operational as part of this deployment.
