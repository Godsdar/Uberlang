# Etymology-first research validation

Date: 2026-10-23. Base main: b7672e2. Branch: feat/etymology-first.

## Implemented journey

Word/language → explicit sourced lookup → separate etymology choice if needed →
select/expand/fold/navigate → save → resume after reload. Passages and Anki notes
enter the same research workspace; grammar remains in supporting Read in context.
A selected sourced or prepared form can explicitly start a new word lookup.

Local discovery storage retains graph evidence, selected form, visible branches,
zoom, scroll, Back/Forward navigation, note, interest marks and optional context.
JSON backups restore as copies after preview. Storage failures and stale-tab
conflicts remain visible; corrupt/unknown data is not automatically replaced.

## Automated checks

- 104 Node tests (68 core/domain + 36 server), including 6 new discovery tests:
  immutable view/notes restoration, expanded revision evidence, rejected corrupt
  graphs/URLs, quota and stale-tab protection, conservative comparisons, and the
  selected historical form's language in an Anki card.
- Typecheck; web, Electron, extension, server and gateway builds.
- API smoke and real socket cancellation test.
- Docker `ci` target (tests, types and all surfaces).
- Five React/jsdom research integration scenarios via `check-research-dom.mjs`:
  explicit save, restore without network, unreadable stored payload preserved,
  stale-tab write refused, Anki word prefill local and late response cancelled.
- Existing analysis, Anki import and Anki export DOM controller checks pass.
  Run those optional scripts with NODE_PATH pointing to a disposable jsdom install;
  no new runtime dependency was introduced.

## Browser verification

Built production assets served locally with their production CSP and the real
public gateway. In-app browser, desktop 1280×900 and narrow 390×844:

- Prepared water family: selected Wasser, note, curious mark and 125% scale
  survive reload. Back/Forward navigation also survives reload.
- Real English computer lookup; compute expands to French computer. Saved
  expanded graph, selected French form and context survive reload.
- Anki dialog from that selected form has language `fr`, with original discovery
  context. No automatic definition/answer is fabricated.
- JSON download and file-picker restore preview add a new copy without replacing
  the original saved discovery.
- A synthetic two-note TSV passes worker parsing, mapping, language declaration,
  review and local import. Explore this word prefills the main workspace;
  explicit Explore retrieves computer's history and keeps its original context.
- Comparing computer and water reports no shared loaded form, explicitly without
  claiming the words are unrelated. No inferred linking edge.
- Tokyo Night, Light and Graphite inspected. Mobile has focusable jumps between
  the chosen form's inspector and its bounded scrollable tree. Keyboard Enter
  selects a form. Reduced-motion emulation exercises fold/unfold without motion.
- Lookup failure leaves the current tree intact. No personal Anki data was used.

## Boundaries

Only selected word/language goes to Wiktionary. All listed history languages are
allowlisted targets, not certified coverage. Other-language grammar and live
translation were not added. Comparison supplies evidence leads, not an automatic
common-ancestor verdict. Saved discoveries are local, bounded and separate from
session reading notes; cloud sync and learning-outcome claims are absent.

## Deployment change

Vercel and Pages no longer repeat tests/typechecks; full GitHub CI runs separately
and cancels superseded runs. Local checks precede this release. No repository
protection, secret or paid service was changed. No measured speedup claimed.
