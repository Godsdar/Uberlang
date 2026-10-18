# Reading concept

Current product promise: **Explore words, their origins, and connections across languages.** Reading and Study are layouts of the same workspace. Initial dictionary lookup and live grammar are English; sourced history continuation uses the selected form’s supported language section in the English-language edition of Wiktionary. Prepared multilingual families stay distinct from live results. See [coverage by mode](MARKETING_POSITIONING.md#coverage-by-mode).

Night notebook is the only web interface at `/` (`web/index.html`).
`/concept/` and `/concept/index.html` redirect to the home page with query/hash
preserved, including under GitHub Pages' repository prefix (ADR-017).
Prepared examples work offline; live features use the same-origin Node gateway
and private Python model. No paid inference service is required.

## Files

- `web/index.html`: shell, layout picker, asset loading, and CSP.
- `web/concept/index.html`, `redirect.ts`: compatibility redirect only.
- `roots-backup.ts`: local download of an existing saved-root payload without migration or deletion.
- `concept.css`: product-scoped presentation and theme tokens.
- `concept.js`: prepared-result display, session notes,
  serialization, downloads, and workspace switching.
- `fixtures.mjs`: three handcrafted sentence analyses and two curated families.
- `domain/*.ts`: pure graph validation/layout, occurrence resolution, and report document scoping.
- `components/explorers.tsx`: typed React family and dependency explorers using D3 and Motion.
- `favicon.svg`: the owner-selected L and leaf mark.

There are no external scripts, fonts or analytics. The CSP permits same-origin
API calls. Editing cancels requests and invalidates previous results. Prepared
examples remain clearly labeled and separate from live model and lexical data.

## Scope and limits

The English editor accepts up to 6000 UTF-16 units. Above 50 words the concept
starts with no selected fragment; choose a word or highlight an expression.
Analyze sentence submits only the selected sentence (50 words / 500 UTF-16 units)
to the grammar engine. A separate explicit word lookup retrieves dictionary
senses and supported historical sources for new headwords. An expression has
contextual grammar, not a fabricated single-word ancestry. The curated `water`
and `mother` families remain available offline.

Notes are independent snapshots within each workspace and exist only in memory. Theme and view preferences are stored locally; source text is not.
Reloading clears them. Export first to keep a report. JSON contains full source
documents and ranges; exports therefore contain text supplied by the user.
HTML and Markdown include note context. Text is escaped in HTML reports, and
missing data retains its unavailable status.

Markdown, JSON, and HTML can be downloaded. The HTML preview includes a static
family diagram and contextual dependency table. At narrow preview widths a
subset of branches is drawn; the full family remains in the source table.
Standalone reports use a table fallback on small screens. PDF export,
production printing, drag/pinch navigation, and durable storage are not shipped.
The family explorer supports per-language branch disclosure, selected-path focus,
75–150% scale, and native scrolling. Motion transitions respect reduced motion.
The syntax explorer highlights the selected word or expression and preserves
the full relationship list. See [interaction design](TREE_AND_ANALYSIS_DESIGN.md).

## Provenance

Sentence fixtures are manually written demonstrations using UD-style POS and
dependency labels. They are not outputs of a validated NLP engine. Russian
translations represent possible readings, not uniquely determined meanings.

Families were curated from English Wiktionary on 2026-10-11. Each node includes
an entry URL; `edgeSource` records relation evidence. `condensed` and `skipped`
identify omitted stages: a parent can mean a condensed lineage rather than one
direct historical step. Reconstructed forms retain `*`. Available consulted
revision IDs remain in each family's sources.

Attribution: English Wiktionary contributors, **CC BY-SA 4.0**.
[License](https://creativecommons.org/licenses/by-sa/4.0/).
The concept adapts entries into curated graph representations; exported reports
preserve attribution, sources, and condensed-path information.

## Integration

The direction is recorded in [ADR-010](decisions/ADR-010-reading-concept.md).
Continue moving the remaining editor/report controller into typed application services and React components after
agreeing on the workflow and sentence-analysis contract. Reuse shared domain
types and provider adapters; do not turn fixture matching into a live parser.

The interaction design is recorded in ADR-011; ADR-013/014 define current live
features. Local Vite development omits CSP to allow its refresh runtime. JSON
exports include only source documents referenced by exported notes.

Prepared data now lives in `src/data/reading-fixtures.mjs`; the web fixture file re-exports it. The backend shares these examples (ADR-012).

## Live grammar alpha — 2026-10-16

The explicit Analyze sentence action now requests real spaCy grammar through the
same-origin Node gateway. Only the containing sentence is sent, not the whole
long document. Editing cancels/invalidate results; errors do not impersonate a
prepared analysis. Notes/reports retain live model provenance independently from
prepared meaning and sourced etymology. Three local examples still work without
an API. Full semantic interpretation and durable notes remain future work. ADR-014 adds
a grammar-based sentence reading and explicit free lexical lookup. Dictionary
senses are alternatives; grammatical roles do not identify an intended sense.
Historical graphs preserve separate origins and only supported source relations.
