# Deployment

## Vercel

Production notebook: https://uberlang.vercel.app/
The branded domain is attached to the existing `lingua` project (same project ID).
The former `lingua-lac.vercel.app` address remains available for compatibility.
Old `/concept/` and `/concept/index.html` links redirect to the notebook.

`vercel.json` installs with `npm ci` and builds the web
app plus Node gateway. It deploys static `web/dist`, public analysis/lexicon/health
functions and the private Python model. No paid inference service is used.
GitHub CI checks tests, types, all surfaces, the Python model and Docker images.

To publish using your own Vercel account:

```sh
vercel link
vercel deploy --prod
```

The current project is published through the CLI; this does not imply that every
GitHub push automatically publishes to Vercel. Connecting a Git integration is a
separate configuration step. Do not commit `.vercel/`, `.env*`, or access tokens.

## GitHub Pages

Mirror: https://godsdar.github.io/Uberlang/
The repository is named `Godsdar/Uberlang`; use that capitalization in Pages paths.
The Pages workflow builds and uploads the web app. Tests/types run in independent GitHub CI.

The notebook entry is `web/index.html`; `web/concept/index.html` builds only a compatibility redirect. The old browser adapter and its React/MUI bundle have been removed. Vercel and Pages do not repeat CI tests/types (ADR-026). Run local checks before publishing; asynchronous CI may finish after deployment.
Relative assets work on Vercel’s root and the Pages repository prefix.

## Verification

Check `/`, `/index.html`, `/concept/`, `/concept/index.html`, `?q=` links, favicon, theme selection, Reading/Study switching, and a
report download. Verify a saved discovery restores its selected node, branches, zoom and notes after reload, plus JSON backup/restore. Context session notes remain temporary.

## Service backend

Run the authenticated `/v1` API locally or use the separate `server` Docker target;
see [BACKEND_RUNBOOK.md](BACKEND_RUNBOOK.md). Vercel uses fixed public gateway
routes instead of exposing the whole service API. Never set `LINGUA_API_KEY` as
a public Vite variable. The Docker server image requires a separate Python worker.

## Live analysis rollout (2026-10-16)

ADR-013/014 define the Vercel rollout: `/api/analysis`
and `/api/lexicon` (Node), `/api/engine` (private Python), and `/api/health` deploy with the web app.
GitHub Pages remains static, with prepared examples; its live-analysis request
will show a clear unavailable state because Pages does not execute these functions.
See BACKEND_RUNBOOK.md for credentials, local setup, boundaries and rollback.
