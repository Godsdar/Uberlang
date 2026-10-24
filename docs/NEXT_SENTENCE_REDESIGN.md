# Next: complete Sentence / Text / Phrase redesign

Owner note, 2026-10-24: the current sentence/text/phrase experience is overloaded,
including an untidy input field, and needs a complete redesign rather than small
spacing changes. The current implementation task remains the chosen word-tree
mechanic. This document records the next separate stage; it does not claim that
the sentence redesign has shipped.

Proposed direction: one well-composed text input and primary action, then the
passage with selectable occurrences. Show grammatical features, dictionary
meanings, syntax and history on demand. Preserve exact text, occurrence offsets,
original context, evidence and the distinction between live and prepared results.
Keep expression history distinct from individual words' origins. Avoid exposing
all panels, technical explanations and controls simultaneously.

The immediate owner correction is implemented separately in ADR-034: remove the
Text language selector, identify sentence language locally, and never require a
manual language choice to start. The full visual redesign remains next.
