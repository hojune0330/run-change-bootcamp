# GitHub Pages deployment

Status as of 2026-08-01: [PR #1](https://github.com/hojune0330/run-change-bootcamp/pull/1)
is open from `agent/pages-preview` into `main`. GitHub Pages is already enabled with
`build_type=workflow`, and the `github-pages` deployment environment exists. No first deployment has
run yet, so the public URL is expected to return 404 while the PR is still draft. Marking PR #1 ready
and merging it into `main` produces the first `main` push and triggers the deployment workflow; no
post-merge Pages source-selection step is required.

Repository: `hojune0330/run-change-bootcamp`

Public URL (currently 404 until the first deployment succeeds):

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

## Deployment gate

Before uploading `dist`, `.github/workflows/deploy-pages.yml` runs the normal Vitest suite, the
serialized deployment-build suite, type and lint checks, a Pages build, deterministic Playwright
Chromium installation, and `pnpm test:e2e:pages:artifact`. The browser gate has no conditional skips
and verifies the Pages base path, the `/record` direct route, PWA registration and scope, emitted
metadata, compression and representation validators, and traversal/base-path rejection.

The PWA manifest, service-worker registration, icon URLs, service-worker scope, and navigation
fallback are emitted below `/run-change-bootcamp/`. No runtime or deployment secrets are required.

## First deployment

After PR #1 is marked ready and merged, the resulting push to `main` runs `Deploy to GitHub Pages`.
The workflow publishes the `dist` artifact through the existing Pages configuration and exposes the
final URL through the `github-pages` deployment environment. A manual dispatch remains available for
later redeployments.
