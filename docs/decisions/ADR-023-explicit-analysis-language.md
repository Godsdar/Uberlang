# ADR-023: Explicit language and bounded text analysis

Date: 2026-10-19. Status: accepted for the first implementation stage; unreleased.

The notebook formerly sent every text as English and the worker did not receive
language. Statistical English predictions on Russian text therefore appeared as
Live grammar. Retain the existing spaCy architecture, but require declared language
at all boundaries, reject unsupported languages/scripts before inference, echo
language/model provenance, and label structure reading separately from meaning.

Only English has an installed grammar model. Script validation is conservative,
not language identification: Latin-script foreign text incorrectly declared as
English remains a documented limitation. User-edited text requires a language
choice. No new model, provider, host, key, telemetry or private-text storage.

See [requirements, acceptance corpus and staged multilingual/context design](../specs/ARBITRARY_TEXT_ANALYSIS.md).
The Anki import branch remains independent; integration precedes publication.
