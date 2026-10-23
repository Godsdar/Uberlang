# ADR-026: deploy builds without repeating CI

Accepted 2026-10-23 after the owner prioritized faster deployment and suggested
removing CI if needed.

GitHub CI already runs independently of the CLI Vercel deployment and Pages job.
Tests/typechecks were repeated in all three pipelines. Keep the full CI workflow,
add cancellation of superseded runs, and remove tests/typechecks from Vercel's
buildCommand and the Pages workflow. Vercel builds web + gateway; Pages builds
web. No new service, secret or access change is involved.

Local tests and focused browser verification precede publication. CI remains
asynchronous feedback, so a deployment can finish before CI. This trades a
remote pre-deploy gate for speed; build failures still stop a deployment. No
branch protection or repository settings are changed. Actual time saved depends
on dependency/model installation and build caches; no speedup is claimed without
measurement.
