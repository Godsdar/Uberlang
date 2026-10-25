# ADR-038: flat research workspace and explicit tool navigation

Accepted 2026-10-25 for the owner's request to remove generic, decorative UI.

## Context

The reference audit found the map beginning around 464 px at 1280 × 720.
Separate rows for brand, modes, form labels, search help, result and status left
little room for the history. Rounded map, inspector and status surfaces repeated
boundaries already expressed by position. Tools hid its labels behind hover on a
large radial selector and repeated them in a guide.

Evidence and access limits: [interface reference audit](../research/2026-10-25-interface-reference-audit.md).
Primer supports distinct selection/focus and local disclosure; Carbon supports
spacing/alignment and optional icons; Linear's documented UI places controls
with their content. These are design references, not evidence of improved metrics.

## Decision

Keep ADR-037's tree plus selected-form evidence. Move the two entry modes into
the application header, wrapping onto a second row on narrow screens. Keep
accessible labels for the compact word/language controls and the exact placeholder
`Enter a word`. Search remains explicit.

Use a flat map and inspector separated by one rule. Reserve the strongest state
for selection; use quiet metadata and a serif for the forms. Put view and zoom
controls together above the map. Display actual trace counts and current requests
in a compact line, retaining elapsed time, Stop, errors and partial data.

Replace the radial Tools selector with a visible text list. Retain word histories,
sentence reading, structure, session notes, imported decks and return navigation.
The header's Sentence or text remains the direct route to entering text. Remove
hover-only descriptions, duplicate guide and ornamental entrance motion.

## Consequences

A narrow screen stacks the inspector after the map, retaining the explicit
Selected form / Back to tree navigation. The full overview uses the map's entire
width. Sources, omitted stages, reconstruction notation and CC BY-SA remain.
No provider, domain model, storage key, relationship or saved-data migration changes.

Verification is recorded in [the browser report](../validation/UX_REFERENCE_REDESIGN_2026-10-25.md).
