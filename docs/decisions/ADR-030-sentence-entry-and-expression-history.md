# ADR-030: visible sentence entry and whole-expression history

Accepted 2026-10-24 following the owner's request to remove horizontal separators
and make complete sentences a primary way into research. Extends ADR-023/025.

## Decision

Expose Word or expression and Sentence or text as peer entry modes. Keep their
working state mounted when switching. Sentence input opens immediately; edits
invalidate computed evidence, refresh local reading tokens and clear the declared
language. Network analysis remains explicit, including Cmd/Ctrl+Enter. A longer
passage has sentence navigation using exact UTF-16 ranges and the existing
single-sentence gateway limits. It is not silently truncated or batch submitted.

Show every non-punctuation occurrence's lemma, POS, morphology, relation and head
position beside the syntax graph. Identical words remain different occurrences.
Dictionary meanings are explicit per-word lookups, with alternatives and revisions;
no contextual sense is chosen automatically. Word research uses a contextual
English lemma where supplied, retaining the exact original passage locally.

For a selected multiword expression, offer a distinct whole-entry history lookup.
Use the existing bounded etymology endpoint and source cache. Preserve a complete
supported dictionary etymology paragraph in optional `family.historyText` (maximum
3000 characters), including uncertainty. Unsupported markup leaves it unavailable;
never salvage text in a way that drops a qualification. Prose creates no graph
edges. Separate origins still require a choice. Expression lookup does not start
automatic ancestry crawling; cited word relationships, if any, remain available.
A missing expression entry never falls back to combining its words' origins.

The optional text is validated at network and saved-library boundaries and travels
with the source revision and attribution in existing JSON backups. Version-1
libraries without this field remain valid. No new data source, model, storage key,
service or credential is introduced. English remains the only live grammar model.
The parser and lexical coverage are partial, not a complete semantic analysis.

Remove decorative horizontal rules from active web sections, source summaries,
imports, reports and selection underlines. Use spacing and selected-control fills.
Preserve syntax/ancestry edges, focus outlines and form-control boundaries.

## Verification

Domain regressions cover repeated sentence/word positions, dependency heads,
lemma versus whole-expression lookup, source-context preservation, uncertain
expression prose, unsupported markup, absent entries and separate histories.
Visual verification covers desktop/390px, all three themes, keyboard navigation,
reduced motion, syntax selection and branch disclosure. Existing release gates
remain unchanged.
