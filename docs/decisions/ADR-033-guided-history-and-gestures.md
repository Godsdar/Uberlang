# ADR-033: a readable history, expandable branches and a persistent map

Accepted 2026-10-24. Supersedes ADR-032's default fitted overview after the owner
found its labels too small and chose primary history + branches + minimap.

## Decision

Open new sourced trees on their evidenced source paths. Keep lateral relatives
collapsed behind a +count at the relevant stage; choosing a form reveals that
branch and centers its readable label. Prepared trees initially show the selected
word's ancestry. A restored discovery includes its selected form. The source
model and all loaded relatives are preserved. Whole tree remains available.

Use Pointer Events for one-pointer pan and two-pointer pinch, anchored at the
moving midpoint. The gesture applies only to the tree canvas; the surrounding
page keeps its ordinary scrolling and browser zoom. Pointer cancellation and
transitions from two fingers to one rebase the gesture. A drag/pinch suppresses
its synthetic click so it does not accidentally select a word. Buttons provide
zoom and reset without requiring gestures. Continuous gesture zoom is transient;
version-1 backups keep their existing zoom values and source graph contract.

A small map always shows the complete loaded graph. It highlights the forms
currently visible and the selected form. It is not an exact viewport rectangle:
the focused tree is laid out differently from the full tree. Pressing the map
fits the whole tree. Browser resizing refits the overview. Language/era grouping
remains a proposal, not an implemented hierarchy or inferred chronology.

## Return journey

Explore later explicitly saves the current discovery and marks the selected form
using the existing curious mark. On return, Continue exploring lists those saved
forms and restores the exact selection, context and source evidence without a
network request. Failed storage writes do not mark an item as saved. Existing
notes, unknown/corrupt backups and cross-tab conflict checks remain in force.
This is a retention hypothesis, not a measured improvement. No telemetry,
notifications, streaks or fabricated related-word suggestions are added.

## Verification

Test pinch anchoring and bounds, pointer geometry, immutable source graphs and
save/resume validation. Browser checks cover the primary path, branch disclosure,
mouse drag without accidental selection, zoom/reset, mini-map, responsive layout,
keyboard focus, themes, reduced motion and resuming a saved form in a fresh tab.
The available in-app browser cannot dispatch multi-touch input; do not claim a
physical-phone pinch test from those checks.
