# ADR-021: Refine the notebook presentation around reading and evidence

## Status
Accepted for the owner's design refinement, 2026-10-18. Initially reviewed locally;
published on 2026-10-18 from [`9980696`](https://github.com/Godsdar/Uberlang/commit/998069627a95935752a36d57955a8b294a15506a)
in the [verified production deployment](https://vercel.com/godsdar/lingua/3AKrThopRgvdc21CnPxRzG1L4oFU)
at [uberlang.vercel.app](https://uberlang.vercel.app/).
Refines the visual treatment of ADR-015; data, routes, source evidence and the
graphics/interaction stack remain unchanged.

## Context
The owner requested a more deliberate, less generic interface. The starting
390 px render placed the passage at approximately 741 px and the tree at
1271 px, after repeated introductory copy and example controls. A rounded outer
frame, dotted gradient canvas and a broad lineage halo competed with the forms.
These are composition findings, not evidence of the tool or person who authored
the interface. The request does not authorize hiding provenance or claiming
human-only creation.

## Decision
- Present an open notebook page with a modest serif heading, restrained control
  typography, plain separators and an explicit selected form.
- Put the passage ahead of example menus; retain the composer, all examples,
  Reading/Study layouts and all three themes.
- Remove the outer card, dotted/gradient tree background and decorative halo.
  Keep the real graph curves, selected path, reconstruction/omitted-stage legend,
  source inspector, relation types, unfolding, scale and native graph scrolling.
- Replace repeated slogans with factual headings. Keep the multilingual product
  promise, English entry-mode restriction, prepared/live distinctions, model
  caveats, partial histories, revision links and CC BY-SA.
- Add a keyboard skip link and visible form focus; honor reduced motion, use
  native color schemes and keep touch targets usable. No new fonts, assets,
  libraries, features or network providers.

## Alternatives Considered
- A wholesale renderer/frontend rewrite: unnecessary for this composition change.
- Remove evidence labels to make the interface cleaner: rejected; they explain
  the data and its limits.
- Add decorative illustrations, effects or a new design system: unnecessary;
  the language forms and their relationships are the distinctive material.

## Consequences
The local 390 px render moves the passage to about 512 px and the tree to 1128 px.
Larger graphs still scroll horizontally; the inspector stacks below on mobile.
The local review preceded publication. The deployed visual refinement is not a
claim of authorship or measured proof of usability. Rust backend planning is recorded
separately in RUST_BACKEND_ROADMAP.md and does not change this implementation.
