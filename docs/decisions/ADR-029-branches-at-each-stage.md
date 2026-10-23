# ADR-029: relatives at each sourced stage and a visible PIE summary

Accepted 2026-10-23. Extends ADR-027/028 following the owner's request to see
branches throughout the history and the PIE root without scrolling through the tree.

## Decision

Trace the main source paths first. Within the same 24-entry request budget, check
intermediate forms whose own entries were skipped by a multi-stage citation.
Reuse results, propagate cancellation, and never recursively crawl lateral branches.
Preview at most two new relatives per checked stage, retaining the 64-form/eight-step
limits. A different dictionary history pauses for the reader; it is never selected
by order. Existing chosen histories remain separate. Each stage initially displays
up to two directly attached relatives; the branch picker and inspector expose more.
Saved discoveries still require an explicit Continue roots & relatives action.

Display sourced PIE forms above the scrollable tree. Distinguish conventional root
notation (trailing hyphen) from affixes (leading hyphen) and other reconstructed
forms. Exclude lateral branches from this ancestry summary. Preserve the exact
spelling and evidence links; do not infer a gloss or invent a PIE connection.

Present dictionary Etymology N as Origin N with a short explanation and its
meaning summary. The numbering identifies separate histories, not chronological
steps, certainty scores or automatic sense disambiguation. Source labels and IDs
remain unchanged in stored evidence.

## Consequences

Intermediate checks can take additional sequential requests or pause on another
meaning. No relatives in the supported entry does not establish that none exist.
The main chain remains visible while related forms load. Existing local libraries
and original Anki collections are unaffected; no schema migration or new provider.
