# Uberlang positioning and language coverage

Current marketing guidance, 18 October 2026. Use this document for new product descriptions and drafts. Earlier launch drafts, screenshots and published posts record their own dates; they are not a current feature checklist.

## Current research entry — 23 October 2026

ADR-025 supersedes the entry/storage restrictions in the historical coverage
matrix below. The primary screen is now direct word-history search with a
supported-language picker; `/api/etymology` still requires evidence in that
language section. A missing branch is a valid result. Grammar/meaning remain
English-only. Saved discoveries retain loaded trees, view state, notes and marks
in this browser, with JSON backup/restore. Context notes remain session-only.

Passage selections and imported Anki words lead into this same research journey.
Comparison shows common loaded forms, never automatically claims ancestry.
Language interests star available branches. No learning benefit, complete
coverage, account sync or automatic recommendations is claimed.

## Name and promise

The visible name is **Uberlang**, with only U uppercase and lowercase l, following the owner's latest instruction. Keep the L logo. The repository remains `Godsdar/Uberlang`, the demo is https://uberlang.vercel.app/, and existing package, API, DOM and storage identifiers stay compatible. This spelling update supersedes the intermediate uppercase-L branding instruction; historical ADRs and published material retain their original wording.

**Explore words, their origins, and connections across languages.**

Uberlang is for independent language learners and people curious about language. The reason to return is an interesting discovery and a clearer connection to what they are reading. The tree is central to the experience and the product's visual identity. Grammar and dictionary meanings help maintain context; they are not the whole product.

The owner's reference to Nietzsche's Übermensch is inspiration. “Exploring beyond your own language boundaries” is a proposed brand interpretation, not a philosophical definition or a promise of learning results. Do not claim superiority over other people, faster learning or proven educational effectiveness. Name/trademark availability remains unverified.

## Coverage by mode

Reading and Study are two layouts of the same workspace, not different language engines.

| Mode | What the current implementation supports | What the copy must not imply |
|---|---|---|
| Start from a passage or selected word | The live grammar request and initial dictionary lookup use English. The editor accepts up to 6000 UTF-16 units; grammar submits a selected sentence of up to 50 words / 500 units. | Arbitrary Spanish, French, Russian or Polish input receives the same grammar or dictionary treatment. |
| Follow a live history | Explore deeper requests a selected form and its language. The allowlist includes Spanish, French, Russian, Polish, German, Dutch, Swedish and historical/reconstructed languages, among others. A supported entry and parsable evidence must exist, and the form must be reachable in a live sourced graph. | A free-form language picker, a complete family, or tested end-to-end coverage for every listed language. |
| Open a prepared family | Curated water/mother examples contain English, German, Dutch, Swedish, Russian and other historical forms; water also includes Polish. These are prepared examples with cited sources. | A branch chip or prepared form proves live lookup or grammar support for that language. |
| Understand a sentence | Statistical English grammar and a grammar-based reading; initial word lookup supplies alternative English dictionary senses. | Automatic contextual sense selection, complete semantics, or certainty about intent. |
| Translate | Prepared English → Russian examples in the notebook. Earlier local Electron/extension translation prototypes are separate surfaces. | A live multilingual translator in the published notebook. |
| Keep an insight | Session notes and Markdown/JSON/HTML export preserve loaded evidence. | A persistent notebook or automatic transfer of old collections across domains. |

The dictionary source is the **English-language edition of Wiktionary**. That edition contains entries and language sections for many languages. Source edition and language of the inspected word are different concepts. English remains a real restriction of the current initial lookup and sentence-analysis mode.

Implementation evidence: `server/src/schemas.ts` fixes initial analysis/lexicon requests to `en`; `web/concept/concept.js` constructs those requests; `src/shared/etymology.ts` defines allowed history targets; `server/src/lexicon.ts` selects the requested history language section; `web/concept/components/explorers.tsx` expands selected sourced nodes; `src/data/reading-fixtures.mjs` defines prepared families. These are capability boundaries, not measured source coverage or linguistic accuracy.

The audit supplied for this task reported production English computer lookup and a Russian вода́ branch, prepared Polish/German branches and Dutch/Swedish controls. Those observations are examples, not evidence that all modes work in every language. This local copy review does not revalidate the live deployment.

## Reusable presentation copy

**Short description:** Uberlang is a space for curious language learners to explore words, their origins, and connections across languages.

**Try it now:** Start with an English word or passage. Look up alternative dictionary meanings, then follow the cited forms into other languages where supported. Or open a prepared word family. English sentence grammar is available on request; sources and histories can be incomplete.

**Source disclosure:** Word histories use the English-language edition of Wiktionary. Keep source and revision links, reconstruction markers and CC BY-SA attribution. A word part, an inflected form, a borrowing and an inherited ancestor are different relations. Unknown or uncertain history must remain visible rather than filled in.

**Feedback question:** What connection did you discover, and where did the evidence or the next step become unclear?

Do not advertise “English words only” as the whole product, “any language,” “complete ancestry,” or automatic understanding of every sentence. Do not label prepared examples as live results. A short or unavailable branch is a valid outcome. User-supplied passages are submitted only through the explicit actions described in the interface; do not claim all processing stays local.

## Marketing strategy for the next useful step

Keep the umbrella audience multilingual. A first ten-person pilot is a research choice: include English readers for the current entry mode and learners of other languages for cross-language discovery through supported branches. Record the learner's study languages separately from the mode actually tested. Do not invite someone to paste a non-English passage with a promise of full analysis.

Test one discovery, one source, one unavailable continuation and export. Ask whether the reader understands the difference between a prepared family, a live source lookup and English grammar. Record confusion and voluntary return as observations or self-report; no fabricated users, learning gains, retention or engagement metrics. Spend $0 and use manual, consented feedback rather than adding telemetry.

The existing [Reddit comment](https://www.reddit.com/r/languagelearning/comments/1wx76az/comment/ph97qap/) was published on 17 October 2026. Preserve its record and text; this correction does not edit it or authorize another post. Respect the recorded six-month resource-thread rule: no repeat announcement before 17 April 2027. No outreach, replies, account changes, spending, push, publication or deployment is included in this local update. Preparing a draft is separate from sending it.

Before any later approved announcement, check the actual deployment and channel rules again, choose a reproducible example and state that mode's limits. The owner's app development remains separate from marketing work. A general non-English initial lookup or grammar mode is an implementation gap to discuss with the owner, not a feature added by changing labels.

## Related project documents

[Owner brief](OWNER_BRIEF_2026-10-16.md) · [Implementation playbook](MODEL_PLAYBOOK.md) · [Workspace scope](CONCEPT.md) · [Launch history](LAUNCH_STRATEGY.md). The legacy web shell has already been retired (ADR-017); retain compatibility links, the roots backup and existing data.

## Explicit input language (unreleased, 2026-10-19)

The notebook can declare other input languages to report unavailable grammar.
Only English has an installed grammar model; this control does not add language
coverage. A conservative Latin-letter gate is not language detection. New text
examples have no prepared answers. Structure readings are rule-derived; dictionary
senses remain alternatives and live translation is unavailable in the notebook.
