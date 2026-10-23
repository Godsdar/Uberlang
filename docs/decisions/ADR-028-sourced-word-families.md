# ADR-028: revision-backed word families and Russian source gaps

Accepted 2026-10-23, following the owner's request to repair Russian research and
make related-language development part of the main tree. Extends ADR-016/025/027.

## Decision

The history response can carry a bounded tree of explicitly cited stages, not
only a star of immediate sources. Accept sequential `from` inheritance templates
and balanced modern etymon annotations, preserving nested components and form-of
relations. Never flatten a chain into siblings or infer a missing intermediary.
The separate English lexical endpoint retains its immediate-source contract.

Add typed lateral `cognate` and `related` links and outward `descendant`,
`descendant-borrowed` and `derivative` links. Parse supported, certain list
citations only. Preserve list nesting; an unsupported named stage blocks its
subtree. A language-only grouping does not assert a lexical intermediary.
Alternative etymologies remain separate and require a reader choice.

Automatic tracing follows source paths only. It may inspect a PIE word's
components rather than stopping before its cited root. A reconstructed root
ending in a hyphen is an automatic endpoint; relatives remain available on
request. This is a lookup stopping rule, not a claim that all such strings are
linguistic roots. No lateral family crawl runs automatically. The same explicit
entry endpoint loads relatives; repeated attachment deduplicates existing edges.
A compact branch disclosure and a few language branches keep the tree readable.
Solid paths trace sources; dashed lateral/outward paths carry relationship labels.

Retain the shared serialized transport, cancellation, 24-request run limit,
64-form exploration limit, eight-step continuation limit and revision cache.
A page contributes at most 18 selected forms in normal family sections; unsupported
formats and larger families are partial. Loading a branch requires a new explicit
action, and missing evidence is never filled by spelling similarity.

For Russian entries lacking an English-edition etymology, permit one Russian
Wiktionary entry and one referenced `Шаблон:этимология:*` page through the same
transport and a separate bounded cache. The narrowly supported template form
must explicitly cite a Proto-Slavic term. Link both entry and template revisions;
show derivational origin with omitted intermediate stages. This does not infer
prefixes, or treat a template's name as an etymological parent. Unsupported Russian
prose remains unavailable. No paid provider or new credential is involved.

## Observed evidence

- `брать`, English revision 91215062: Old East Slavic `бьрати` → Proto-Slavic
  `*bьràti` → Proto-Balto-Slavic `*bírāˀtei` → PIE `*bʰéreti`. The separate
  `бьрати` entry has only Old Church Slavonic, so an immediate-source-only crawl
  incorrectly stopped. The original revision already establishes the chain.
- PIE `*bʰéreti`, revision 93428420: components `*bʰer-` and `*-eti`, with cited
  Balto-Slavic, Germanic, Hellenic, Indo-Iranian and Italic descendant branches.
- `исследовать`: English revision 79904349 has no etymology. Russian revision
  13633642 points to the shared template revision 11760808 citing `*slědъ`.
  Intermediate derivation is not specified and remains visibly condensed.
- Proto-Balto-Slavic `*slaidús`, revision 92311895: a modern nested annotation
  explicitly gives the PIE formation and its components `*h₃sleydʰ-`, `*-us`.

All excerpts and adaptations retain Wiktionary CC BY-SA 4.0 attribution.

## Deck workflow

My decks explains file import, origin-local storage and lack of Anki connection.
Numbered example fields are recognized. Spanish/English note-type names can
suggest a language, reviewed independently for each type; a populated field in
that type's sample guides mapping of mixed text exports. Search ignores accents.
A note's research word is editable without mutating the imported note. Context
and the original answer/deck/tags travel locally into a discovery; only the
original form prefills that answer for Anki export. Historical forms do not
inherit the original answer. Export remains a reviewed text file, not collection
mutation, membership verification, direct AnkiWeb import or synchronization.

The owner's real Spanish export was inspected privately (243 notes: 241 Spanish
Voc, 2 English Voc). No personal cards or collection are repository fixtures.
