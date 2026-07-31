# GitHub Pages preview

Status: workflow and artifact support are implemented locally. The repository has
not been deployed, pushed, or enabled in GitHub Pages from this workspace.

Repository: `hojune0330/run-change-bootcamp`

Expected public URL after the first successful workflow run:

`https://hojune0330.github.io/run-change-bootcamp/`

Local development (`pnpm dev`, `pnpm preview`, and `pnpm build:local`) stays at the
origin root. The Pages artifact (`pnpm build`, or `pnpm preview:pages` against that
artifact) uses `/run-change-bootcamp/` as its base. The generated `404.html` is a
copy of the built `index.html`, so GitHub Pages can serve the SPA shell for a direct
route such as `/run-change-bootcamp/record`. The client strips the repository base
before resolving routes and prefixes internal links when it updates history.

The PWA manifest, service-worker registration, icon URLs, service-worker scope, and
navigation fallback are all emitted below the same repository base. No runtime or
deployment secrets are required.

## Enablement step (GitHub owner action)

In the public repository, open **Settings → Pages**, select **GitHub Actions** as the
source, and save. The `Deploy to GitHub Pages` workflow then runs on `main` pushes or
manual dispatch. GitHub will expose the final URL through the deployment environment.
