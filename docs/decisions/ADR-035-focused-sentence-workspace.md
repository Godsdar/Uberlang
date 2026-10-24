# ADR-035: focused Sentence / Text workspace

Accepted 2026-10-24 after the owner requested a complete visual redesign,
especially on phones, and removal of service-text overload.

## Flow

Start with an empty composer and one Analyze action. Examples and capability /
privacy details are optional disclosures. Do not show an empty result, duplicate
passage, unavailable-feature warnings, or technical input limits on entry.
Keep the language-coverage hint brief; language identification stays automatic.

A completed result collapses the composer to Edit text. The passage is displayed
one sentence at a time, retaining absolute UTF-16 offsets into the original text.
Reading shows the sentence reading or the selected word's role. Structure is an
explicit tab; it centers an individually selected word on narrow screens. Word
history opens the main word explorer from a selected word, preserving any loaded
family and its source attribution. It is not duplicated as a third result tab.

Full morphology, every-word details, model evidence, example translations, phrase
selection and note/export tools remain available through disclosures. Do not
show absent translations or explanations as decorative empty panels. Examples
remain visibly prepared; model output is labeled analyzed and detailed warnings
remain accessible. Do not imply a grammar-based reading resolves all meanings.

Edits immediately hide previous results and exports, invalidate requests, and
keep already-saved notes attached to their original text. Notes remain session
only and explicitly offer export. Existing dictionary, Anki and word-tree data
contracts are unchanged. The input and result share theme tokens, keyboard
controls and 44px touch targets; no extra animation system or network service.

## Validation

Regression test the visible sentence window with repeated sentences and exact
absolute offsets. Check empty input, prepared and live results, word selection,
structure selection, sentence switching, unsupported language, failure/retry,
editing invalidation, saved-note exports, and local note preservation. Inspect
390px and desktop layouts, all themes and reduced motion. Run the repository CI
container gate before publishing to the existing lingua project.
