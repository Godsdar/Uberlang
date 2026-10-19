# Integrated Anki import and honest analysis validation

Date: 2026-10-19. Integration branch: `release/anki-import-and-analysis`.
Base: main `b0c3cea4abf41431b698fde68d00add88552dee9`.
Sources: analysis `9d7acbe`, local importer `2129456`.
Implementation tested/reviewed: `fef7514`. Source branches remain intact.
The unpublished declutter/AnkiConnect commit `574d222` is excluded.

## Integration

The imported English note sets its declared language, clears pending/stale analysis,
and opens locally. Spanish/Latin notes cannot enter the English-only notebook.
Only an explicit analysis action sends the selected sentence and language; source
metadata, answers and other notes are excluded. ADR-024 names the local importer;
ADR-023 retains the explicit analysis-language decision.

## Automated validation

- `npm test`: 62 core/domain and 36 server tests pass (98 total).
- `npm run typecheck` and web, desktop, extension, server and gateway builds pass.
- Real pinned Python/spaCy model: 14 analyzer/HTTP tests pass.
- DOM analysis/import/export harnesses pass, including import language replacement,
  no automatic requests, exact request content, saved-note immutability, unsupported
  language rejection and late-response invalidation. Export covers three scenarios.
- `npm run smoke:server` and Docker `ci` target pass.
- Independent read-only Astra High reviewer `/root/release_review` examined the
  combined change and final integration-test delta; no blocking findings.

## Real local browser validation

Firefox private window; production Vite build; local public gateway and real Python
worker. Private deck testing used a separate origin from synthetic live analysis.

- Native Anki text exports: 361 notes from English and 255 from Spanish; 616 notes
  visible in the local library. Exports do contain mixed-language note types, so
  language was assigned per note type rather than inferred from a deck name.
- Real text parser, preview, mapping, import and IndexedDB persistence were exercised.
  Duplicate-skip checks retained counts. Spanish note opening in the English
  notebook is disabled. Original Anki notes, scheduling and settings were not edited.
- Latin was absent from the current profile and available export search; its real
  deck remains untested. A Latin `.apkg` or text export is needed for that check.
- Synthetic modern APKG (Zstandard/schema 18), 25 notes/two types: worker parsing,
  explicit language mapping, review and save succeeded under production CSP.
- Imported synthetic English example opens locally with a request explanation;
  explicit Analyze returns live English grammar from the local spaCy worker.
- Unseen sentence `The curious otter carried a silver spoon across the garden.`
  returns otter=NOUN and carried=VERB/root. Editing clears the language and results.
- `Мама читает книгу.` declared Russian is rejected with no installed model and
  explicit text-not-sent status; no false Live grammar label.
- Desktop and 390px responsive layouts visually inspected, including My decks.

Private exports stayed outside the repository and deployment tree. No private text
was submitted to external analysis/lookup or retained in public evidence. This
report contains only aggregate private-deck results; synthetic sentences are public.

## Release boundaries

Grammar remains English only; language is user-declared, with conservative script
checks, not automatic language detection. Rule-based sentence reading is not
contextual sense resolution. No new translation model/API was added. Local Anki
import does not transfer media or scheduling and is not Anki synchronization.

Node gateway and Python worker must be published together. Prior production rollback
deployment: `dpl_G78cb6y79iuFbWcTjAFcLtjrmvQ7` (lingua-gs3t39ey7-godsdar.vercel.app).
CI and deployment IDs are recorded in the release handoff after publication.
