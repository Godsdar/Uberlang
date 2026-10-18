# ADR-022: Radial tools with preserved notebook context

Date: 2026-10-18
Status: accepted for the owner-authorized web refinement

## Problem

The notebook exposed appearance, examples and several analysis layers at once.
Switching analysis views unmounted explorers, losing selected branches, zoom and
tree focus. Reading and Study also initialized separate drafts and notes despite
being presented as two layouts of the same workspace.

## Decision

Use a translucent radial entry around the current word/context. Four labeled
actions open existing functions: Word histories, Understand, Sentence structure,
and Study notes. Use your own text opens the existing editor. Open notebook and
the keyboard skip link remain direct paths. Tools reopens the entry in place.
Selecting a tool never starts a provider request.

The desktop orbit unfolds with a brief, staggered transform/opacity transition.
Narrow screens use a two-column set of touch targets with the word above it.
Reduced motion disables the unfolding and workspace transition. Reduced
transparency and unsupported backdrop filtering use an opaque surface. Themes
continue to supply all product colors. No graphics/provider dependencies change.

Reading and Study now change the layout of one mounted workspace. They share
the draft, UTF-16 selection, loaded evidence, notes and graph state. A small typed
panel store keeps the three mounted analysis views while their context remains
valid. Changing text, occurrence or evidence expires hidden views; the active
renderer still performs its previous syntax-aware updates. Opening/closing Tools
only hides the workspace and never invokes its content renderer. A hidden tree
does not get re-laid out by the controller's resize observer.

Appearance contains the existing themes and layout choices. Examples and session
notes use native disclosure. Sources, uncertainty, prepared/live/unavailable
labels and reconstruction marks stay beside the result. Existing `/concept/`
redirects, query/hash preservation, roots backups and report exports remain.
`?q=` and hash links bypass entry; text links open the editor without submission.

## Capability boundaries

Initial lookup and grammar remain English. Word histories can follow supported
forms across languages. Understand retains alternative dictionary senses and
grammar-based readings, without automatic contextual sense selection. Translation
remains prepared English → Russian. Notes remain session-only. No backend or
provider changes, accounts, telemetry, new data storage or network hosts.

## Verification

- Three new panel-store regressions cover state retention, repeated occurrences,
  edited text, replaced evidence and in-place sourced-history continuation.
- `npm test`: 39 core/domain tests and 34 server tests pass.
- Typecheck; Electron, extension, web, server and gateway builds pass. Server
  startup/auth/analysis/translation/shutdown and socket-cancellation smoke pass.
  Build the gateway before smoke: the deployment adapter imports that output.
- Independent read-only diff review found no blocking bug. Its concerns about
  narrow header fit, retained tree state and saved-note exports were checked.
- Real browser: Tokyo Night, Light and Graphite at desktop and mobile widths;
  320 px narrow entry and 390 px mobile; 1280 px desktop. No horizontal page
  overflow observed at 320 px. Tree canvases retain intentional internal scroll.
- Selected Wasser, enabled Dutch branch and 125% zoom survive Tools → Grammar →
  origins. The selected form and saved note survive Reading/Study switching.
- `/concept/?q=water%20water#lingua-concept` preserves the text/hash and bypasses
  entry. Network observation showed no API submission on that navigation.
- Saving the second `water` then editing the draft retains the original document
  and `[6,11)` range in JSON; stale analysis and saving the edited draft remain
  blocked. Keyboard Tab/Enter/Escape retain visible focus and return to Tools.
- Browser-emulated reduced motion reports no launcher CSS animation. Screenshots
  use that preference to record stable states, not intermediate unfolding frames.

Local preview does not provide a live parser. Production verification is recorded
separately after deployment; prepared examples are never presented as live checks.

## Scope and remaining work

This is the first integration stage. The existing result content remains intact;
further density reductions should be evaluated in small changes with linguistic
evidence and discoverability preserved. No new language engine or live translator
is implied by the toolkit metaphor.
