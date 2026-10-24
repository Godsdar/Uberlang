# ADR-031: show a word history immediately

Accepted 2026-10-24 after the owner rejected the mandatory Origin 1 / Origin 2
step. Supersedes the initial-entry choice gate in ADR-025/029/030.

## Decision

After an explicit lookup returns, immediately open its first dictionary history
and render its graph. Continue existing bounded background tracing without waiting
for another click. Dictionary ordering is a display default, not a confidence
ranking or automatic word-sense decision. Show the entry's meaning with the word;
record the default as `historyChoice.readerSelected=false` and describe it in the
root's evidence note when multiple histories exist. Preserve revision links.

Place other entry histories in an optional disclosure after the tree, labeled by
meaning. Switching creates a separate discovery and preserves the previous tree
using existing session drafts/saved copies. Never combine unrelated histories.
The loaded alternatives remain available while switching; saving retains the
opened graph and its provenance under the existing version-1 library contract.
No extra lookup is needed to display an already returned alternative. Restored
saved trees remain local; this change does not refresh them automatically.

Intermediate entries with ambiguous continuations still stop that continuation
rather than inventing a relation. Keep their optional alternatives below the tree
and describe the already loaded tree as ready. A mandatory numbered chooser must
not displace the graph. Missing source evidence remains unavailable, even when
that leaves a one-node tree. Expression history keeps its separate prose view.

## Verification

Regression tests cover immediate default opening, independent alternatives,
immutable source responses, explicit versus default provenance, missing histories
and source revisions. Existing cancellation, graph limits, storage and tracing
regressions remain. Inspect a real multi-origin entry on desktop and 390px,
including optional switching, keyboard focus, themes and reduced motion.
