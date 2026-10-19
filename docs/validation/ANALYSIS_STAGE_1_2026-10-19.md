# Analysis stage 1 validation — 2026-10-19

Branch: `feat/honest-text-analysis`, based on published main `87b10bd`.
Specification: [arbitrary text analysis](../specs/ARBITRARY_TEXT_ANALYSIS.md).
Unpublished: this report is local validation, not a production deployment claim.

## Automated checks

- Node 26.9.0 host: `npm test` (50 core/domain + 36 server tests), typecheck,
  web/Electron/extension/server/gateway builds.
- Node 24 container: `docker build --target ci` includes tests, typecheck, all
  builds and smoke. No image published.
- `npm run smoke:server`: production auth/startup, exact prepared analysis,
  translation opt-in, graceful SIGTERM and real HTTP disconnect cancellation.
- `NODE_PATH=/tmp/uberlang-anki-dom/node_modules node scripts/check-analysis-dom.mjs`
  tests the real notebook controller with jsdom: no automatic submission,
  undeclared/unsupported/mixed-script rejection, edit/undo invalidation,
  Anki language, unavailable service, late response after language change.
- Existing `check-anki-export-dom.mjs`: 3 scenarios pass. Its harness now injects
  the controller's new domain dependencies.
- `src/data/analysis-corpus.json`: 19 public synthetic cases shared by browser,
  Node and Python. One deliberately misdeclared Spanish case records the lack
  of Latin-script language detection; it is not claimed as English accuracy.
- `git diff --check` passes.

- Python 3.12.14, spaCy 3.8.7, en_core_web_sm 3.8.0:
  `.venv/bin/python -m unittest engine.test_analyzer engine.test_http_handler -v`
  passes all 14 tests with the installed real model. This includes the existing
  20-sentence offset/tree corpus and the 19 shared language-boundary cases.
- Real-model segmentation declined `🌱 The gardener opened the gate.` as
  `MULTIPLE_SENTENCES`. The shared corpus records that model outcome separately
  from input-boundary acceptance; no forced tree or fabricated result replaces it.
- Local [benchmark JSON](analysis-benchmark-2026-10-19.json): cold 674.649 ms,
  warm median 1.464 ms, max RSS 145,178,624 bytes on macOS arm64, 20 valid samples.
  These are local observations, not production latency guarantees.
- [Live HTTP evidence](analysis-live-http-2026-10-19.json), using the same Node
  public adapter and Python HTTP worker as the browser: new English sentence 200
  with live grammar and echoed language; Russian declared `ru` 422
  `UNSUPPORTED_LANGUAGE`; Russian or mixed Cyrillic declared `en` 422
  `UNSUPPORTED_SCRIPT`; private worker without a credential 401.

Integrity/offset checks do not establish POS/dependency or semantic accuracy.

## Independent review

Separate read-only reviewer `/root/analysis_review`, same task environment,
compared main + staged/unstaged diff. Three findings were fixed and rechecked:

1. Controller harness omitted new imports after stripping import lines.
2. Edit→undo could restore old context/tokens (and dereference a cleared live
   result). Input invalidation now re-resolves with the cleared declaration.
3. Anki draft hardcoded English despite the new declared note language. A minimal
   backwards-compatible `note.language ?? 'en'` bridge preserves the declaration.

Reviewer ran 15 targeted domain/API checks, 6 Anki checks, both DOM harnesses,
independent prepared/live edit→undo tests and diff whitespace checks. Final
result: no blocking findings. The actual Anki importer branch was not modified.

## Real browser evidence

Chrome via native CUA, isolated tab `127.0.0.1:5175`. No browser connector was
available, so inspection used native accessibility, keyboard controls and Chrome
DevTools responsive mode. The tests use only public synthetic sentences.

- Own text loaded by URL requires an explicit language; no request on load.
- `Мама читает книгу.` with English is rejected as unsupported script before send.
- With Russian it shows no installed model; Analyze says text was not sent.
- Editing clears declaration and old results. No POS/Live label for Russian.
- Loading “A new sentence” is local and explicitly says no prepared answer exists.
- 390 px responsive viewport: language selector/actions wrap; Light and Tokyo
  Night full-page captures inspected, Graphite also checked in the browser.
- Native keyboard selection operates the language selector.
- Real local worker: “The curious otter carried a silver spoon across the garden.”
  produces live grammar, including `otter` NOUN and `carried` VERB/root. Understand
  shows a rule-based subject/object reading, its limitations and “Translation
  unavailable · no live translation is provided.” The model and language warnings
  are visible under About this analysis. Desktop layout was visually inspected.

[Light, Russian unavailable, 390 px](../assets/analysis/unsupported-390.png)
[Tokyo Night, Russian unavailable, 390 px](../assets/analysis/unsupported-tokyo-390.png)

Screenshots are Chrome page captures, DPR 2 (780 pixels wide), not generated
mockups. Browser extensions emitted their own unload warnings; these are outside
Uberlang code. No screenshot includes private user text or credentials.
The first local live attempt returned 403 because the development adapter's
allowlist defaults to port 5173. Setting its existing `LINGUA_PUBLIC_ORIGIN` to
the test origin `http://127.0.0.1:5175` fixed the setup; the successful UI/HTTP
checks above used that exact origin. No persistent configuration was changed.
An additional saved live-page screenshot was not obtained: native CUA became
unavailable (`noWindowsAvailable`) after the live result was inspected. The
two responsive screenshots and synthetic live HTTP evidence are retained.

## Integration and rollout

No push, PR or deployment. Integrator must preserve language state and the tiny
Anki note-language bridge when resolving `concept.js`, README and `anki.ts`.
ADR-023 may need renumbering if the parallel branch adds an ADR first.
Node gateway and Python worker must deploy together: private requests now require
`language`; client response validation also requires the echoed language. Retain
`87b10bd` deployment for rollback. Re-run integrated checks before publication.

The app's messaging tool could not resolve parent thread
`01a13f91-dd1b-76a1-8573-c40c535bb00c` (`thread not found`, including durable host).
No message was delivered by that tool; the platform returns the final task report.
