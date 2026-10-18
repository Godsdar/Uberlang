# ADR-022: Radial tools with preserved notebook context

Date: 2026-10-18
Status: accepted for the owner-authorized web refinement

## Problem

The notebook exposed appearance, examples and several analysis layers at once.
Switching analysis views unmounted explorers, losing selected branches, zoom and
tree focus. Reading and Study also initialized separate drafts and notes despite
being presented as two layouts of the same workspace.

## Decision

Use a translucent circular sector entry around the current word/context. Four icon-only
sectors open existing functions: Word histories, Understand, Sentence structure,
and Study notes. Use your own text opens the existing editor. Open notebook and
the keyboard skip link remain direct paths. Tools reopens the entry in place.
Selecting a tool never starts a provider request. Original plain-outline icons
represent histories, an open book, sentence dependencies and a notebook. The
owner explicitly requested removal of decorative sparkles and promotional
headings. Names and mode limits appear outside the wheel on hover or keyboard
focus; an optional Tool guide provides labeled buttons on touch screens.
All sector buttons retain accessible names and descriptions.

The annular wheel unfolds with a brief, staggered transform/opacity transition.
Each native button is clipped to a quarter-annulus; the entire visible sector
is its hit target. Desktop and mobile both retain a circular wheel, with the
selected word in its center. This supersedes the initially published orbit of
separate cards and mobile grid, following the owner's explicit correction.
On fine-pointer hover, only the active sector scales to 1.035 and rotates 1°
over 260 ms. Reduced motion disables that transform, unfolding and workspace
transition. Reduced
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
- Sector correction: real-browser bounds are 284 × 284 at a 320 px viewport and
  354 × 354 at 390 px. Clicking blank sector space outside its label opens that
  tool. Focus highlights the wedge and outlines its label. Mobile icons are 38 px; optional guide labels are 16 px and descriptions 14 px.
  Scope stays visible below the wheel. Long query text at 320 px
  keeps an 85 × 85 center, truncates visually without changing the stored text,
  and cannot intercept sector taps.
- Icon refinement: real-browser hover settled at scale 1.035 / rotation 1°;
  keyboard focus revealed the correct description and Enter opened Understand.
  Escape restored Tools focus. The mobile Tool guide opened Study notes; 320 px
  remained free of horizontal page overflow. Reduced motion disables hover travel.

The first deployment (`cd24559`) was verified on production: sunflower lookup,
sun's separate etymology choice, continuation to Middle English sonne, and live
spaCy grammar. The live expanded tree survived tool switching. The production
`/concept/?q=water%20water#lingua-concept` redirect also preserved input/hash.
The sector correction changes only presentation; its deployment is verified
separately. Prepared examples are never presented as live checks.

## Scope and remaining work

This is the first integration stage. The existing result content remains intact;
further density reductions should be evaluated in small changes with linguistic
evidence and discoverability preserved. No new language engine or live translator
is implied by the toolkit metaphor.
