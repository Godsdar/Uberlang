# ADR-032: whole-tree overview before detailed exploration

Accepted 2026-10-24 after the owner asked to see every branch first, then choose
where to look more closely. Extends ADR-031's immediate compact result.

## Decision

Open each family in Whole tree view. Reuse the existing D3 layout and typed
relations, include every loaded leaf and its ancestors, and fit both axes into
the available width and a bounded viewport height. Refit when tracing adds forms
or the viewport changes. The overview's height follows the fitted drawing so
wide trees do not leave a large empty area above or below it.

Selecting a form opens the existing detailed view at its reading scale, reveals
that form's source path and centers keyboard focus on it. A native form picker
provides a readable alternative when overview labels become small on phones.
Whole tree returns to all loaded branches, including those folded in detail.
The overview uses the full content width; the selected-form inspector and branch
controls appear in detailed view. Source links and attribution remain visible
under the overview.
Existing navigation, selected path, zoom, evidence, continuation and branch
controls remain available. No nodes or relationships are removed from the family.

Overview is presentation state, not a new saved-tree schema. Saved selections,
detailed zoom, branches and scroll positions keep their version-1 contract;
overview fitting never writes its temporary scale or scroll position into them.
The default applies to restored trees too. Opening a saved overview sends no
lookup. All loaded branches means the current sourced history, not every history
of a homonym or a claim that the dictionary's ancestry is complete.

## Verification

Test that full layouts retain every input node and edge and fit both axes for
narrow, tall and wide viewports. In the browser inspect initial overview,
selection by mouse/keyboard and native picker, return to overview after folding,
responsive refitting, all themes and reduced motion. Verify existing detail
controls and stored discovery validation remain intact.
