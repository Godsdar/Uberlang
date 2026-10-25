# Reference-driven interface verification — 2026-10-25

Implementation: ADR-038. Research was completed by a separate agent and read
before implementation. Existing user edits to DESIGN.md, MODEL_PLAYBOOK.md and
the reference catalog were preserved. Production was inspected as a baseline;
the changed application was checked locally. No deployment or push was performed.

## Automated checks

- npm test: 97 domain/core and 44 server tests passed.
- npm run typecheck: passed.
- Desktop, extension, web, server and public gateway builds: passed.
- npm run smoke:server: passed, including disconnected-client cancellation.
- docker build --target ci .: passed on the completed code.
- git diff --check: passed.

Existing large-chunk and Node module-type warnings remain. No dependency added.

## Browser checks

Real in-app browser, 1280 × 720/800 and 390 × 844; Graphite, Light and Tokyo Night.
At 1280 px the map panel begins at 316 px (canvas at 360), compared with the
research baseline around 464 px for the map panel. Controls retain 44 px targets.
At 390 px document scrollWidth equals innerWidth: no horizontal page overflow.

- Prepared water: opened branches at *watar, selected Wasser, read its German
  gloss, omitted stages and both source links. Mobile details and Back to tree work.
- Whole tree and zoom work; desktop overview occupies all 1216 px of its workspace.
- Live-source saved tree: Fold/Unfold continuation works without network loading.
- Map drag moved scrollTop to 203; Main history restored the primary route.
- Keyboard Tab reaches the map with a visible solid focus outline. Reduced-motion
  emulation was enabled during prepared branch selection and whole-tree navigation.
- Library opens separately and returns to the mounted tree. Backup/import controls
  remain. Existing decks remain accessible via Tools; no import/delete was executed.
- Tools shows five labelled choices; My decks opens its existing dialog. Header
  mode navigation exits Tools. The decorative radial selector and duplicate guide
  are gone, with no tool functionality removed.
- Held initial lookup: target word/language, elapsed and Cancel visible; cancellation
  retains the prepared tree. A real retry shows the local service error and Retry.
- Held ancestry continuation: 31 forms, Reading бьрати and elapsed visible. Stop
  retained all 31 forms and offered Find more forms.
- Held grammar: original sentence is readable immediately. Cancel offers Retry
  analysis; real retry reports service unavailability. Editing hides stale output.
- Prepared grammar: Structure works; selecting water at offset 19 shows direct
  object and its head gives. Both entry modes stay accessible in the compact header.

Interception was used only for deliberate pending-state checks and then cleared.
Local live lookup/grammar services returned unavailable; successful new live data
was not verified in this run. Prepared and previously saved sourced trees were
used for visual/interaction checks. No claim of provider improvement or measured
user-success improvement is made.

## Evidence

User-facing files are in this chat's outputs directory: research.md,
desktop-graphite.png, desktop-light.png, mobile-tokyo.png, mobile-details.png,
and references/ (Primer, Linear documentation and baseline Uberlang screenshots).
