# UberLang: interaction and analysis design

Marketing clarification, 2026-10-18: **UberLang** explores words, their origins, and connections across languages. Initial lookup and live grammar remain English in both layouts; supported history nodes can cross languages. See [current scope](MARKETING_POSITIONING.md#coverage-by-mode). Historical example descriptions below do not promise equal language coverage.

Accepted direction, 2026-10-13. Visual references: Zen Notes and Monkeytype; Tokyo Night, Light, Graphite. This document describes shipped concept behavior and the next implementation gates separately.

## Product promise

Read a small piece of language, understand how it works, and follow a word's history. The entry point is a sentence or selected occurrence, not an automatic translation of a whole document. English UI. Translation is optional and independent from explanation.

## Layers and evidence

| Layer | Question | Representation | Source requirement |
|---|---|---|---|
| Meaning | What is said here? | Short explanation, explicit alternative readings | Curated / parser-supported / generated labels kept distinct |
| Morphology | What form is this? | Lemma, POS, features | Contextual token analysis, not the dictionary's first POS |
| Syntax | How does it connect? | Dependency arcs + accessible relationship list | Token ID, head ID, relation, original offsets |
| Etymology | Where did this form come from? | Ancestors below; sourced modern relatives above | Entry and relation evidence; reconstruction and omitted stages |
| Translation | How might this be expressed in another language? | Optional disclosure | Provider and context; failure must not hide other layers |

An utterance can be a fragment, question, command, or several sentences. The UI must not pretend these always have one root or a uniquely knowable intent. The current syntax explorer accepts one valid dependency tree. Split future multi-sentence input into sentence contexts; never manufacture a connecting root between sentences.

## Historical explorer — implemented

- Start with the selected English word and two related language branches.
- Each language chip reveals or hides its evidenced lineage. English stays anchored.
- A node click selects its historical form and lights its ancestor path. The inspector links both the entry and available relation evidence.
- “Selected path” isolates that node's ancestry. “Family” returns to the disclosed branches. Removing a branch containing the selected node returns selection to English.
- A dashed edge means omitted historical stages; `*` means reconstruction. Neither conveys certainty or chronology by itself. Vertical distance is layout space, not elapsed time.
- Text keeps a legible size. Wider families scroll; scale buttons support 75–150%, with a reset. On narrow screens the inspector moves below the tree.
- Branch changes reuse stable IDs. Retained nodes move; newly disclosed solid links grow; dashed condensed links fade in so their pattern remains legible. Theme changes do not replay the reveal.
- Buttons work by keyboard; graph regions receive focus and support native scrolling. There is no ARIA tree role without full tree keyboard semantics.

## Syntax explorer — implemented

- Preserve word order horizontally. Connect dependent → head; mark the sentence root.
- Default to the selected word's incoming/outgoing connections; optional full connections provide context. Full morphological details stay in the inspector.
- Clicking a diagram word updates the source-text selection, features, and explanation. Keep keyboard focus on the word.
- Selected expressions highlight their participating tokens and contextual connections, without receiving a fictitious single etymology.
- Keep the complete dependency list in a disclosure for reading and export. Punctuation remains in the data even though the compact diagram omits it.
- Long graphs scroll; do not reduce labels to tiny text. Arc height grows to avoid clipping long dependencies.

## Motion contract

| Trigger | Motion | Limit |
|---|---|---|
| Reveal branch | Node fade/short movement, line growth; existing coordinates interpolate | 320 ms |
| Change syntactic selection | Connection emphasis | 180 ms |
| Change theme | Color tokens update | No scene replay |
| Reduced motion preference | Immediate final state | No simulated movement |

Motion explains a user's action. No looping leaves, camera flights, or delayed access to content. Collapsed nodes currently disappear immediately; refined exit transitions can follow usability evidence.

## Next gates

1. Test the three prepared examples with five volunteer learners: ask them to identify subject/head, explain a verb phrase, find an ancestor, distinguish a reconstruction, and export an insight. Do not prompt them through the task. Record confusion and completion manually; no telemetry or unsolicited outreach.
2. Fix unclear interaction labels before adding more visual decoration. Working target: four of five can complete the core sequence in five minutes without help; this is a proposed acceptance target, not a measured result.
3. Compare sentence engines on the corpus in ENGINE_EVALUATION.md. Add ambiguity, question and command cases. Grammar may explain structure; it must not claim certainty about speaker intention.
4. Implement durable local notebooks with schema version, exact text + UTF-16 occurrences, immutable provenance, restore tests, capacity errors, deletion and export recovery. Session saving is not a substitute.
5. Bring the accepted workspace into the typed React application, reuse providers, then offer live-analysis alpha. Desktop/mobile packaging and paid services follow demonstrated usefulness.

## First-user release boundary

ADR-013/014 supersede the original prepared-only launch boundary. The public
workspace now distinguishes live statistical grammar, grammar-based readings,
explicit sourced lexical lookup and offline prepared examples. Live graphs show
only supported explicit sources/components with separate origins; curated
families can show wider related-language branches. This remains an alpha with
session-only notes and no claim of complete semantics or etymological coverage.

## Night notebook implementation — 2026-10-16

ADR-015 applies the research direction to the existing reading workspace. The
passage stays visible while writing/analysis controls open under **Write or
paste a passage**. Word origins leads the view tabs. Theme tokens support the
same Tokyo Night, Light and Graphite choices.

The tree uses a dotted notebook canvas, serif forms, a highlighted lineage and
a field-note inspector with clickable ancestors and source evidence. Up to
three initial endpoints give a restrained overview; individual branch chips
and Reveal all / Fewer branches control density. SVG edges and nodes enter and
exit within 320 ms; exiting node controls become inert. Reduced motion has no
movement. Changing themes preserves the open branches and selected form.

Historical families grow upward; live dictionary source graphs grow downward
and keep relation labels. Folding all live sources leaves the word visible.
No forms, edges or source claims are added by the redesign. Native horizontal
scrolling keeps wide trees readable; the inspector stacks below on narrow
screens. The legacy Dictionary entry and its saved data remain in place.

## Live continuation — ADR-016

For a live sourced form, the inspector's **Explore deeper** explicitly loads its
own language section from Wiktionary. New source branches animate into the
existing graph. **Fold continuation** hides the selected form's children without
losing their evidence; unfolding reuses loaded data. Short branches remain near
their parent while deeper histories grow downward.

Multiple etymologies require a reader choice; unsupported alternatives remain
visible so omission cannot silently choose a sense. Chosen alternatives,
revision links, unavailable states, components and `form-of` links survive
exports. A path stops on repeated forms, at eight steps, or at 64 graph nodes.
Cancel/selection changes keep already loaded history. Themes and reduced-motion
behavior remain as in ADR-015. Quick sunflower/computer buttons perform real
explicit lookups, not prepared graph matching. Other words use the same path.

## Notebook refinement — 2026-10-18

[ADR-021](decisions/ADR-021-notebook-visual-refinement.md) records the owner's visual refinement, initially reviewed locally. An open page, shorter headings, quieter theme/branch controls and a plain tree canvas replace the earlier outer card, dotted background and halo. The passage precedes example menus. Evidence, partial-history and prepared/live labels remain; the English entry mode and broader cross-language exploration are still explicit. Keyboard skip/focus and native color schemes support access. Graph data, motion limits, source lookups, exports and storage contracts are unchanged. Published on 2026-10-18 at [uberlang.vercel.app](https://uberlang.vercel.app/) from [`9980696`](https://github.com/Godsdar/Uberlang/commit/998069627a95935752a36d57955a8b294a15506a); see the [verified production deployment](https://vercel.com/godsdar/lingua/3AKrThopRgvdc21CnPxRzG1L4oFU). Backend/Rust planning remains separate.
