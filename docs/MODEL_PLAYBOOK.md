# UberLang implementation playbook

For bounded coding tasks, including Sol at medium reasoning. Read this after AGENTS.md. Applies to the entire repository. Follow the user's current request; ask only when a real product decision is missing.

## Start every task

1. Run `git status --short --branch`. Preserve unrelated edits. Identify the current checkout and remote before publishing.
2. Read the relevant entry below, the target files, and nearby tests. Treat old planning documents as historical unless a current ADR accepts their proposal.
3. State the observable result in one sentence. Choose one small change that produces it. Do not rewrite the whole product.

## Product rules

- Working product name: **UberLang** (U and L uppercase; latest owner instruction 2026-10-18). Read the [brand brief](OWNER_BRIEF_2026-10-16.md#бренд-для-дальнейшей-работы). The repository is Godsdar/Uberlang (owner-authorized rename). The demo is https://uberlang.vercel.app/ on Vercel project lingua (owner-authorized domain). Other technical identifiers remain Lingua; do not rename code, accounts or stored data for branding. English UI. Minimal Zen Notes / Monkeytype direction; themes through CSS tokens.
- Positioning: explore words, their origins, and connections across languages. [Coverage by mode](MARKETING_POSITIONING.md#coverage-by-mode) governs claims: initial lookup/grammar are English; sourced history continuation can cross supported languages; prepared branches stay labeled.
- $0 operation. No paid infrastructure/API, accounts, analytics, desktop signing, or mobile release as a shortcut. The local Node backend is authorized by ADR-012; ADR-013 authorizes the free stateless Vercel analysis rollout.
- `/` is Night notebook. `/concept/` redirects to `/` (ADR-017). The notebook combines prepared examples with explicit live English grammar analysis. Grammar-based sentence readings and explicit Wiktionary lookup support new text (ADR-014); curated examples remain labeled.
- Repeated words are separate occurrences. Keep exact text and UTF-16 `[start,end)` offsets. Editing invalidates old results.
- Syntax, morphology, meaning, translation and etymology are distinct layers. Never infer ancestry from similar spelling, meaning, translation, or nearby nodes.
- Preserve sources, reconstruction `*`, omitted stages and CC BY-SA attribution in UI and reports.

## Find the correct place

| Task | Start here | Check |
|---|---|---|
| Theme, spacing, responsive appearance | `web/concept/concept.css` | Three themes, 390 px + desktop, keyboard focus |
| Tree/syntax interaction, animation | `web/concept/components/explorers.tsx` | Stable IDs, selected path, focus, reduced motion |
| Layout, dependency heads, selection offsets | `web/concept/domain/graphs.ts`, `selection.ts` | `npm test`, `npm run typecheck` |
| Prepared examples | `src/data/reading-fixtures.mjs` (web re-export) | Source evidence, exact text slices, graph validity |
| Editor, session notes, reports | `web/concept/concept.js` | Stale results, immutable saved notes, escaped HTML |
| Live dictionary/translation | `src/core/`, `src/shared/types.ts` | Tests + all three builds |
| Lexical definitions and historical sources | `server/src/lexicon.ts`, `src/core/wiktionary.ts`, `web/concept/domain/lexicon.ts` | Separate senses/origins, cited revisions, no invented edges, bounded lookup |
| Statistical language model | `engine/`, `requirements.txt`, `docs/ENGINE_EVALUATION.md` | Python unittest suite, source slices, native labels, no inferred semantics |
| API contracts, auth, resilience | `server/src/`, `docs/BACKEND_ARCHITECTURE.md` | `npm run test:server`, `typecheck:server`, `build:server`, `smoke:server` |
| Build/deployment | `web/vite.config.ts`, `.github/workflows/`, `vercel.json` | Both entry URLs, relative assets, production CSP |

New domain behavior goes into typed modules. Keep colors/spacing out of domain data. Do not add business rules to SVG coordinates, event handlers or CSS. Use existing D3 hierarchy + React + Motion; no second graph library.

## Implement safely

1. Reproduce the relevant behavior using existing examples.
2. For a logic fix, add a regression that fails for the actual bug (wrong occurrence, invented edge, stale output). Do not test implementation details or snapshot arbitrary styling.
3. Make the smallest cohesive patch. Reuse types and adapters. Do not convert fixture matching into guessed analysis.
4. Inspect unknown external data before traversal. Missing parents, cycles, invalid ranges and provider failures must not become plausible-looking results.
5. Keep ready UI interactive. No random animation, fake progress, looping motion, or waiting before showing existing data. Respect reduced motion explicitly in Motion.
6. If the task needs a parser/provider choice, consult ENGINE_EVALUATION.md and report evidence. Do not choose an engine just because an API demo returns fluent text.

## Finish

- `npm test`
- `npm run typecheck`
- `npm run build:web`
- Also `npm run build && npm run build:ext` for shared core/contracts or build architecture changes.
- For backend changes: `npm run build:server && npm run smoke:server`; verify production authentication, cancellation, malformed inputs, no private logs and graceful shutdown. Use injected providers in tests; never spend API credits.
- For visual changes: inspect desktop + narrow viewport, all themes, branch expand/collapse, syntax selection, keyboard focus and reduced motion. Use a real browser; a successful build is not visual verification.
- For notes/export: edit after analysis; old data must not export as new analysis. Save two occurrences; verify ranges and source text in JSON. Download HTML and retain evidence/attribution.
- `git diff --check`; update affected docs and a new ADR when a decision changes. Never delete old ADRs.
- Publish only within the user's authorization; target **Godsdar/Uberlang** and Vercel **lingua**. Never touch AURA or another Vercel project. No force pushes or unrelated dependency upgrades.
- Final response: changed behavior, checks actually run, remaining limits, demo/files. Do not claim production readiness, live parsing, durable notes or a successful deployment without evidence.

## Read for the current direction

`docs/TREE_AND_ANALYSIS_DESIGN.md` → `docs/decisions/ADR-011-progressive-language-exploration.md` → `docs/CONCEPT.md`. Use `docs/reviews/2026-10-13-architecture.md` for remaining risks, and `docs/PRODUCT_SPEC.md` for the wider roadmap. Historical Atlas styling applies to the dictionary, not the reading concept.

## Owner clarification 2026-10-16

Read [the owner brief](OWNER_BRIEF_2026-10-16.md) for the working name UberLang, brand direction and clarified product priority: self-directed language learners, curiosity, and a coherent tree aesthetic. It takes precedence over older grammar-first framing. The legacy Dictionary web shell was retired by the owner’s later request (ADR-017); do not restore it. Existing implementation and privacy rules still apply.
