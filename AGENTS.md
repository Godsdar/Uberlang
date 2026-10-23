# AGENTS.md

Living list of non-discoverable landmines and workflow rules. `README.md` covers
commands; `docs/` covers product and architecture intent. If something can be
learned by reading the repo, it does not belong here.

## Required implementation guide

Read [docs/MODEL_PLAYBOOK.md](docs/MODEL_PLAYBOOK.md) before changes. It applies to all models, including Sol medium, and gives task routing, product invariants, checks and release limits. For the reading UX, ADR-011 and TREE_AND_ANALYSIS_DESIGN.md are the current direction.

## Product name

The visible brand is **Uberlang** (only U uppercase, lowercase l; latest owner instruction, 2026-10-18). Use it in UI, page titles,
README and new exports. The logo/favicon letter is **L**, by owner choice.
The repository is **Godsdar/Uberlang** by explicit owner request.
Production demo: **https://uberlang.vercel.app/**, attached to the existing Vercel
project **lingua** (same project ID). The former lingua-lac domain is a compatibility
alias. Package/API/storage identifiers remain Lingua/lingua; do not migrate them
for branding. See the owner brief and [current marketing/language coverage](docs/MARKETING_POSITIONING.md); multilingual histories do not imply multilingual initial lookup or grammar.

## Current research entry (ADR-025)

Etymology research is the primary `/` experience. `web/concept/components/research-workspace.tsx`
uses the existing etymology endpoint for explicit word/language lookup. Context
reading, English grammar and Anki support that journey. Saved discovery storage
is `uberlang.explorations.v1`; never clear or overwrite corrupt/unknown data.
Keep the separate session-note, imported-deck and old roots contracts intact.
Vercel/Pages build without duplicate CI checks (ADR-026); CI remains independent.
Explicit research Explore traces cited roots toward PIE (ADR-027), pausing for
alternative etymologies and preserving partial evidence. Saved trees stay local
until Continue tracing roots; never fabricate a PIE connection.

## Current web entry (ADR-017)

Night notebook is the sole published web UI at `/` (`web/index.html`). The old
Dictionary browser adapter is deleted. `/concept/` is a query/hash-preserving
redirect, including on Pages. This supersedes older playbook route descriptions
and the brief's deferred-removal plan: the owner explicitly requested removal.
Do not reintroduce the old web shell. Electron/extension are earlier local
prototypes retained for compatibility; their renderer/core/IPC are not disposable
web-only code. Never clear `lingua.roots.v1`; existing web collections have a
verbatim local JSON backup action in the notebook.

## Scope & routing

- One shared core (`src/core/`) feeds three surfaces: Electron (`src/main`,
  `src/preload`, `src/renderer`), the Chrome MV3 extension (`extension/`), and the
  static web app (`web/`). **A change in `src/core/` affects all three** — verify
  them all before finishing:
  `npm run typecheck && npm run build && npm run build:ext && npm run build:web && npm run build:server`.
- Product/UX intent lives in `docs/DESIGN.md`, `docs/POSITIONING.md`,
  `docs/GRAPHICS.md`. Record architectural decisions as new ADRs in
  `docs/decisions/` (`ADR-00N-*.md`, sequential; never delete old ones).

## Non-discoverable commands

- Tests use Node’s built-in runner (`npm test`); Node 24+ is required for the
  TypeScript tests. The gate is tests, `npm run typecheck`, all four builds, and `npm run smoke:server`.
- Validate the container pipeline locally with `docker build --target ci .`
  (typecheck + all builds inside the image).

## Landmines / do-not-touch

- **`src/core/**` must stay browser-compatible.** It is imported by the web app
  and the MV3 extension, so it may use only web APIs (`fetch`, `URLSearchParams`,
  `AbortController`); read env defensively (`typeof process !== 'undefined'`).
  No `fs`, `path`, `child_process`.
- **Translation goes through `src/core/providers.ts` only.** Do NOT reintroduce
  unofficial Google Translate endpoints (`translate.googleapis.com`,
  `clients5.google.com`) — removed on purpose (ADR-003). Default is MyMemory;
  DeepL / LibreTranslate are opt-in via `DEEPL_API_KEY` / `LIBRETRANSLATE_URL`.
- **Never ship provider keys in client code.** The web and extension bundles are
  public; `DEEPL_API_KEY` / `LIBRETRANSLATE_URL` must stay server-side (desktop env
  or a proxy). The opt-in Node backend is in `server/` (ADR-012 supersedes ADR-009).
  Its service credential must never enter a browser bundle.
- **Wiktionary requests must stay batched and throttled** (`src/core/wiktionary.ts`:
  `queryBatch`, `getLexicons`, the scheduler). Do not add parallel per-word fetches
  or bypass the min-gap/429 handling — Wikimedia rate-limits hard.
- **IPC contract is `src/shared/types.ts`** (`TranslateRequest`, `AnalyzeRequest`,
  `LinguaApi`, `IPC`). Change it once, then update main, preload, and renderer together.
- **Adding a new network host** (data source) requires updating CSP `connect-src` in
  `src/renderer/index.html`, `web/index.html`, and `extension/public/manifest.json`
  (+ `host_permissions` in the manifest), or requests are silently blocked.
- **Graphics stack is fixed (ADR-007):** `d3-hierarchy` layout + React-rendered SVG
  + `motion` + `modern-screenshot`. Do not introduce PixiJS/ECharts/Three/Konva for
  the tree, and never let heavy renderers enter the extension popup bundle (MV3).
- **Existing application visual language (ADR-008 / `docs/GRAPHICS.md`):** "Linguist's Atlas" —
  `ultramarine` = shared ancestor, `gold` = the single "aha" accent. Do not
  reintroduce the generic cream `#f4f1ea` + terracotta `#c2410c` theme.
- **TypeScript 7:** `baseUrl` was removed — `tsconfig` `paths` must use relative
  targets (`./src/...`). The typecheck scripts pass `--composite false` on purpose.

- The separate reading concept uses theme tokens and prepared data (ADR-010).
  Prepared examples remain labeled. Explicit live analysis uses spaCy through the
  same-origin Node gateway (ADR-013); ADR-014 adds a clearly labeled grammar-based
  reading plus explicit Wiktionary lexical lookup. Never call grammar output
  proof of word sense or speaker intent.

## Data & privacy (non-negotiable)

- Etymology/POS/translations come from English Wiktionary under **CC BY-SA** — keep
  the attribution in the UI; never scrape Etymonline.
- No accounts or product telemetry. Input remains local until explicit analysis; API analysis must
  be an explicit submission of selected context. Translation is opt-in on the API.
  Never log user text, query values, credentials, or raw upstream errors.

## Backend guardrails (ADR-012)

- Read `docs/BACKEND_ARCHITECTURE.md` and `docs/BACKEND_RUNBOOK.md`.
- HTTP/auth/limits belong in `server/`, not browser-compatible `src/core/`.
- Propagate cancellation through every provider and fallback; retain bounded concurrency.
- Prepared analysis must remain marked `prepared`; unsupported text is `unavailable`.
- ADR-013 authorizes the public stateless /api/analysis gateway on Vercel Hobby.
  Never deploy an anonymous paid-provider proxy or expose the service key to clients.

- Python worker `engine/` requires pinned requirements/model, `python -m unittest
  engine.test_analyzer engine.test_http_handler -v`; Node tests use injected engines.
- Do not expose `/api/engine` without its service credential. Only selected sentence
  context is submitted. spaCy labels are not Universal Dependencies. Unknown meaning
  and etymology remain unavailable when unsupported; never fabricate sources or ancestry.
- Live lexical graphs preserve separate etymology groups and typed source relations.
  They are not complete families; never connect cognates as ancestors or silently
  select a dictionary sense. Keep revision evidence and CC BY-SA in exports.

- `light-my-request` is pinned to 6.6.0 because Vercel rejects its newer
  CJS-to-ESM cookie import (ADR-013). API tests reproduce the runtime flag;
  do not remove the override based only on local Node success.

## Gotchas

- Share-card canvas (`ShareCard.tsx`): `await document.fonts.ready` before drawing,
  and reset `ctx.textAlign` at the start of every draw (the context is reused).
- Etymology is rendered by `src/renderer/src/components/EtymologyTree.tsx` (SVG +
  `motion`, laid out with `d3-hierarchy`). The tree model is built in
  `src/core/etymologyTree.ts` (`buildEtymologyTree`). Animation must be `motion`
  (ADR-007), not GSAP or canvas renderers.
