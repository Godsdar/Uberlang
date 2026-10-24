# Sentence / Text redesign — implemented 2026-10-24

The owner requested removal of visual overload, technical paragraphs and the
untidy input. ADR-035 implements the full reading flow redesign. ADR-034 already
removed manual language selection.

The entry now has a blank, bounded composer and one Analyze action. Ready results
collapse the composer and show one sentence of the original passage. Reading
opens a short explanation or selected-word card; Structure opens the dependency
diagram. Morphology, full word details, evidence, translation, phrase tools and
export are disclosed on demand. Edits hide stale results immediately. Existing
source, occurrence and saved-note contracts remain intact.

Language/era grouping of etymology trees remains a separate proposal.
