# ADR-034: automatic language identification for sentence input

Accepted 2026-10-24. The owner rejects a manual Text language step in Sentence /
Text. Remove that dropdown and its instructions. The word-history language
picker remains separate: dictionary homographs still need a target language.

Identify sentence input locally with pinned tinyld 1.3.4 light (MIT, no runtime
network or transitive dependencies; about 68 KiB browser model before bundling).
The larger normal model did not improve the short ambiguous examples checked,
so avoid its roughly 793 KiB cost. This is heuristic identification, not a
calibrated confidence score or a language-accuracy claim. Fewer than 10 letters,
one-word input, low scores or close rankings return unknown. A longer phrase is
the recovery; no manual dropdown returns. Short phrases and mixed-language text
can remain ambiguous or be misclassified.

Detect the complete sentence selected for explicit analysis, not the whole
multi-sentence passage or an isolated selected word. Keep original UTF-16 offsets.
Selection for word research uses its surrounding sentence. Input editing still
invalidates live grammar and dictionary results. Unsupported or unknown language
blocks English grammar submission. Detection never sends text; explicit Analyze
sentence continues to submit only that sentence. The backend remains a validated
English-only API, so its languageDetection capability remains false. Shared
warnings no longer claim the user declared English.

Regression checks cover English, Russian, French, Spanish, German, ambiguous
short text, per-sentence detection in a mixed passage, exact offsets, and rejection
before submission. Browser verification covers absence of the dropdown, editing
invalidation and English/non-English submission paths. This removes a control;
it does not claim the full Sentence/Text redesign is complete.
