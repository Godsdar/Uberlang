# Production verification — 2026-10-25

User explicitly requested publication and live search/analysis verification.

- Source commit: `6751aaa` on `feat/etymology-first`, pushed to Godsdar/Uberlang.
- Vercel project: `lingua`, `prj_6CugFU5BXKdKEUl0HHPr3gqx1x6g`.
- New deployment: `dpl_8ovxt9MutUU8YYPMespg8c3gk6va`, Ready.
- Deployment URL: https://lingua-dn28h0ql0-godsdar.vercel.app
- Production alias confirmed: https://uberlang.vercel.app
- Previous rollback target: `dpl_2KxZvwYtkB2bCw6knUGzvvriKV1x`.

The previous turn's 141 tests, typecheck, all builds, server smoke and Docker CI
passed on the application code. Only documentation changed before publication.
Vercel rebuilt the web assets and gateway and packaged the existing Python worker.
No provider configuration, credentials, storage or dependency changes were made.

## Live checks

Direct same-origin HTTP checks and real-browser submissions both passed.

1. `POST /api/etymology`, English `sunflower`: HTTP 200 in 1.23 s on the direct
   check, one history with five source nodes and Wiktionary revision 93739281.
   The browser displayed sunflower, sun and flower with component relations,
   five available forms, source attribution and a separate-history pause for sun.
   That pause is ambiguity handling, not a provider failure or a complete-family claim.
2. `POST /api/analysis`, new non-fixture sentence:
   `A curious traveler noticed ancient words near the river.` HTTP 200 in 2.86 s.
   Grammar status `live`, engine `spaCy`, model `en_core_web_sm` 3.8.0, spaCy 3.8.7,
   ten tokens. The meaning layer is live grammar-based reading; etymology remains
   unavailable in this response until explicit dictionary lookup.
3. Browser shows `English · analyzed`; selecting traveler at UTF-16 offset 10
   shows a noun, subject of noticed. Structure renders the live dependencies.
4. Private `/api/engine` rejects unauthenticated input with 401. A foreign-origin
   analysis request is rejected with 403. No credential was exposed.
5. New compact header and Tools presentation are served by production. The
   390 px viewport has document scrollWidth 390; no page-level horizontal overflow.

These are point-in-time checks with a small number of public test inputs, not
an uptime/load claim. Existing build dependency/chunk warnings were not remediated
as part of this UI release.

## Separate product direction

DESIGN.md section 12, «Геймефикация», records the owner's retention direction and
stages: research, design alternatives, bounded prototype, user check, implementation.
A separate chat «Uberlang — Геймефикация» was created for its research/design stage:
`01a1728e-9ba7-71b2-99c8-aa7ce017ed9f`. This release adds no game mechanics.
