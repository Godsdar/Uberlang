# ADR-037: research canvas and real request feedback

Accepted 2026-10-25 after the owner chose “tree immediately + selected-form card”
from two alternatives, following separate research agents' evidence documents.

## Context

ADR-036 removed promotional copy but left library management, navigation and
form actions competing with the result. The selected form's gloss followed its
actions, and ancestry progress lived below a tall map. A static “Analyzing…”
message did not make the waiting experience useful.

Evidence and limitations are recorded in
[reading and dictionary research](../research/2026-10-25-research-reading-and-dictionaries.md)
and [graph and waiting research](../research/2026-10-25-research-graphs-and-waiting.md).
These identify transferable patterns, not a proven causal link to market growth.

## Decision

Keep a compact search above a research canvas. Library opens a separate workspace;
hiding the current discovery does not unmount its tree. Put Save beside the
result heading. The map and selected-form evidence have distinct surfaces.
Show form, language, available gloss, relation and sources before actions.
On narrow screens, the form card follows the map, ahead of advanced map controls.
Keep explicit links between map and card; preserve keyboard focus and gestures.

Move whole-map branch management and PIE summaries into Map details & branches.
Keep Main history / Whole tree, zoom, local branch controls and relationship
labels readily available. This changes presentation from ADR-033/036, not source
semantics, ancestry, local-storage formats or selected occurrence offsets.

Initial word lookup shows its actual target, language, elapsed time and Cancel.
Keep the previous tree interactive and independently titled. Show ancestry's
current requested form and actual available-node count above the map; never
count progress callbacks as completed requests (they fire before and after load).
Ready forms render immediately. Stop retains accumulated evidence, and Find more
forms resumes explicitly. No automatic network request when opening saved trees.

Analyze opens the exact local sentence immediately. This is readable input, not
partial model output. The analysis endpoint delivers one JSON response, so no
internal model stages or completion percentage are claimed. Keep already valid
analysis of unchanged text while refreshing, with a distinct status. Cancel,
error and timeout leave readable text and an explicit Retry. Editing or selecting
a different context invalidates the pending request. Timer text is outside the
live region and disappears when the request ends. No looping loading animation,
fake percentage, deliberate delay, new provider or streaming protocol is added.

## Alternatives and consequences

An article-first result would make the tree secondary and add a step before
exploring connections; the owner chose the canvas. A separate full-screen graph
would require more navigation to change words or open the library. Merely changing
loading text or adding a spinner would leave the waiting experience unchanged.

Optional controls take another click. Evidence and material limitations remain
available, while space is allocated to the current object. This is a tested
implementation hypothesis, not a user-study result; assess it on actual research
tasks with the owner. Provider latency itself is unchanged.

## Verification

Repository tests, typecheck, all builds, gateway build, server smoke and
`docker build --target ci .`. Browser: 390 px and desktop, all three themes,
keyboard and reduced motion; real dictionary lookup and partial trees, branches,
whole-tree/zoom, saved library, immediate sentence preview, cancellation/retry,
provider error, prepared grammar, Structure and edit invalidation. Production
verification follows publication to the existing lingua project only.
