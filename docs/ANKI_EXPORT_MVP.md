# Anki export release candidate

2026-10-19. Isolated branch `release/anki-export-preview`, based directly on
published main `cdafab5262800ba255ca9a2c5ba4a2e4ba432aca`. This candidate contains
no unpublished declutter/refinement commits. It is not deployed.

The existing notebook gains one Anki… action at the selected fragment and each
saved note. A local native dialog edits word, language, context, optional sense
label, answer, deck suggestion and tags, with optional history and card preview.
Sources, uncertainty, reconstruction marks and immutable UTF-16 source evidence
accompany the answer. No dictionary sense is chosen automatically.

Download one UTF-8 TXT with Front, Back and Tags. Import in Anki Desktop 2.1.54+,
choose an existing two-field note type, map those columns, keep HTML off, select
Ignore duplicates and review the target deck before importing. The browser can
only report that a download started; it cannot confirm import or collection
membership. Session duplicate warnings are based on exported front, not a scan of
Anki. Re-download is an explicit action. Cards with different language, context or
sense labels have different fronts; editing the answer keeps the same identity.

No AnkiConnect client, localhost connection, origin permission, add-on/config
mutation, API key entry or CSP expansion is included. The separate full integration
branch has an opt-in mocked AnkiConnect adapter; its installed-version and real
HTTPS-origin behavior remain unverified. Neither branch claims direct AnkiWeb
sync. APKG export/native-mobile adapters remain future work; use Anki desktop import and
its own client sync for mobile.

Release criteria: domain tests, typecheck and web build; real desktop/mobile dialog
inspection, cancel/focus, stale/current and saved-source safety, and actual TXT
format verification. A separate reviewer checks this candidate diff. The native
200% zoom gate on the declutter branch is not claimed as passed or inherited into
this published-main-based candidate; actual browser zoom verification remains an
explicit unperformed accessibility check for the new dialog.

The four radial sectors, editor, original tool layouts, tree controls and existing
reports are unchanged. No user approval is imposed on ordinary source changes;
release depends on technical verification, not a new authorization ritual.

Sources: [Anki text import](https://docs.ankiweb.net/manual/importing/text-files)
and [client-managed sync](https://docs.ankiweb.net/manual/syncing).

## Checks performed for this candidate

- npm test: 45 core/notebook + 34 server tests passed.
- npm run typecheck (node/web/server) and build:web passed.
- Three scenarios execute the actual original-main notebook controller and new
  dialog: text-only hostile preview, original saved occurrence after edit, real
  serialized download and explicit repeated download. Isolated jsdom runtime only:
  `NODE_PATH=/tmp/uberlang-anki-dom/node_modules node scripts/check-anki-export-dom.mjs`.
- Real in-app Chromium: dialog at 1280×900 and 390×844, opening/cancel/Escape/focus
  return, actual TXT download and repeat warning. Narrow dialog client/scroll width
  350 px, page width 390 px. Existing tool/tree controls and report buttons remain.
- The built page retains exactly the original self-only connect-src CSP. No
  direct-connection UI exists. No real Anki service was contacted or configured.
- [Desktop evidence](assets/anki-export/desktop.jpg) and
  [narrow evidence](assets/anki-export/mobile.jpg). These are local captures, not
  proof of deployment or actual browser zoom200.

Independent read-only review of cdafab5..34990bc41d6f9ea6929525e7e7d8fa23fc80b6d0
completed with no actionable findings. The reviewer confirmed this candidate has
no ancestry or source dependency on declutter and recommends its separate release.
The final documentation-only update records that result; executable sources remain
identical to 614ca02. All six theme/size states (Tokyo, Light, Graphite × 1280/390 px)
were also checked in the real in-app browser: page width equals viewport and dialog
scroll/client widths match. No native zoom or Anki connectivity claim is made.
