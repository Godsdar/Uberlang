# ADR-036: compact word research as the product focus

Accepted 2026-10-25 after the owner rejected promotional headings, repeated
service copy and a product that tries to do everything at once.

## Decision

The primary purpose is researching word origins and connections. Use a compact,
functional English interface. Word entry starts with the exact placeholder
“Enter a word”, the dictionary language and Explore. Remove promotional intros,
decorative empty states and repeated instructions from both entry modes.
Examples and lookup/privacy details are closed disclosures. Sentence or text
keeps its empty composer, automatic language identification, Reading / Structure
and word-history handoff (ADR-034/035), without a decorative headline.

Keep sourced history, readable primary paths, branch disclosure, minimap and
whole-tree controls (ADR-033). Tree gestures get optional help rather than
repeated on-screen instructions. Keep real failures, material limitations,
relation types, reconstruction and omitted-stage labels, source attribution and
prepared/live provenance. Notes and cards become an optional disclosure; saving,
backup, comparison, imported decks and all storage contracts remain intact.

The current DESIGN.md supersedes earlier marketing and broad-roadmap priorities
where they conflict. Preserve the original draft in docs/history instead of
presenting its S1–S25 statuses as current implementation. Historical ADRs remain;
this narrows the presentation of ADR-025's research journey and ADR-035, without
replacing their data, privacy or interaction contracts.

## Alternatives and consequences

Keeping slogans with shorter copy would retain the unwanted marketing layer.
Removing context, grammar, notes or Anki would discard useful supporting tools
and risk existing work. Use progressive disclosure and direct labels instead.
Discovery of advanced controls now takes an extra action; their affordances and
keyboard access remain visible. No provider, data migration or dependency change.

## Verification

Inspect 390px and desktop, all three themes, keyboard focus, prepared and live
word lookup, branch disclosure, pan/zoom, whole tree and saved discovery resume.
Check Sentence / Text examples, Structure selection and edit invalidation.
Run the repository gates and docker build --target ci before publishing to the
existing Godsdar/Uberlang repository and lingua Vercel project.
