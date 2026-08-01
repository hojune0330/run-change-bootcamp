# GitHub Pages deployment

Status as of 2026-08-01: [PR #1](https://github.com/hojune0330/run-change-bootcamp/pull/1)
was merged into `main`. The first `main` workflow run, [30679484294](https://github.com/hojune0330/run-change-bootcamp/actions/runs/30679484294),
failed during runtime setup because it selected Node.js 22.12.0 while pnpm 11.9.0 requires a newer
Node runtime. [PR #2](https://github.com/hojune0330/run-change-bootcamp/pull/2) is the open draft
remediation: it aligns the project, frozen jsdom dependency, local runtime source, and Pages
workflow. A successful Pages deployment has not been established yet.

Repository: `hojune0330/run-change-bootcamp`

Public URL (deployment status must be confirmed by a successful workflow run):

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

## Deployment status

After PR #2 is reviewed and merged, a new push to `main` (or an intentional manual dispatch) must
complete the `Deploy to GitHub Pages` workflow before the public URL is treated as deployed. The
workflow publishes the `dist` artifact through the existing Pages configuration and exposes the final
URL through the `github-pages` deployment environment.
