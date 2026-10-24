# English sentence engine evaluation

Status: **spaCy selected for the first live English grammar pilot, 2026-10-16**. No paid hosting or API costs are authorized. This is a measured adapter baseline, not a linguistic accuracy certification.

## Selected engine and evidence

Use a private Python function alongside the Node gateway: **spaCy 3.8.7 + en_core_web_sm 3.8.0**, both MIT. The model is installed during the build from the upstream release wheel; requests never download a model or call a third-party language API. The Node gateway handles browser submissions and deadlines; the Python endpoint requires the server-only bearer credential. Grammar and morphology are live. Meaning and etymology remain separate layers and are not inferred from a dependency tree.

- [Model card and license](https://spacy.io/models/en#en_core_web_sm); exact [model metadata](https://github.com/explosion/spacy-models/blob/master/meta/en_core_web_sm-3.8.0.json).
- Model wheel: **12.2 MiB** download. Resolved Python 3.12 Linux x86_64 dependencies including the model: **271 MiB installed** in a clean target directory. This is below the documented [Vercel Python function 500 MB uncompressed limit](https://vercel.com/docs/functions/runtimes/python). The final deployment bundle must still be checked: Node modules and build outputs must not enter the Python bundle.
- Local measurements on macOS arm64, Python 3.12.14: first import/load/parse **1.70 seconds** on the first measured run; subsequent fresh-process run with filesystem cache **462 ms**. Twenty short sentences: **1.14 ms median** warm parse; peak process RSS approximately **150 MB**. These are developer-machine measurements, not Vercel cold-start or uptime claims.
- **20/20** short corpus cases passed exact source slices and valid dependency-tree checks, including repeated words, contractions, combining marks, astral characters and extra whitespace. A two-sentence input returns **422 MULTIPLE_SENTENCES**. This is structural validation, not 100% grammatical accuracy.
- Labels are **spaCy English / OntoNotes-style**, not UD. Preserve `dobj`, `dative`, `poss`, `relcl` and other native labels; only `ROOT` is serialized as `root`. Head IDs are one-based, with zero for the root. Source offsets are UTF-16, end-exclusive.
- Known quality limits: this small statistical model chooses one interpretation, does not expose calibrated confidence or alternative parses, and can mislabel unusual input (the seedling emoji was tagged PROPN in a measured sentence). All live output carries an uncertainty warning. No claim of reliable semantic interpretation follows from valid heads.

`engine/analyzer.py` is the model adapter. `engine/http_handler.py` is the private HTTP boundary. Exact Python versions are pinned in root `requirements.txt`; `.python-version` selects Python 3.12. Eleven Python tests exercise real parsing, graph rejection, saturation, request validation, authentication and sanitized failures. The semaphore bounds work per process, not globally across serverless instances. Free hosting can pause or throttle when quotas are reached; it provides no application-level SLA.

Reproduce from the repository root with an isolated environment:

```sh
python3.12 -m venv /tmp/lingua-engine
/tmp/lingua-engine/bin/python -m pip install -r requirements.txt
/tmp/lingua-engine/bin/python -m unittest discover -s engine -p 'test_*.py' -v
/tmp/lingua-engine/bin/python -m scripts.engine-benchmark
```

The benchmark uses only public synthetic examples and performs no network requests. Re-run after a model/runtime change and measure the actual deployed function separately.

## Alternatives assessed

**UDPipe hosted API:** a live request on 2026-10-16 returned dependency and morphology output from `english-ewt-ud-2.17-251125`, with code-point TokenRange values. It is technically usable, but its [official service terms](https://lindat.mff.cuni.cz/services/udpipe/api-reference.php) require CC BY-NC-SA model compliance, explicit permission for commercial exploitation, and allow submitted data to improve UFAL systems. These restrictions and the third-party text transfer make it unsuitable as the default for Uberlang. It is not called by the implementation.

**Browser POS libraries:** not selected. POS tagging alone does not meet the product requirement for dependency heads and morphological features. **LLM/cloud APIs:** no paid provider or anonymous paid proxy is enabled. **Stanza:** not benchmarked in this pilot; its packaging and latency remain unverified.

## Candidates

| Candidate | Why compare | Constraints to measure |
|---|---|---|
| Local CPU parser, e.g. spaCy or Stanza | Offline analysis, no submitted text, reproducible version | Model size/license, cold start, packaging, UD mapping, quality |
| Browser/worker parser with an openly licensed downloadable model | Static hosting, user-controlled download, no server | Actual dependency-parser availability, RAM/download, mobile support; not assumed feasible |
| Cloud structured parser or LLM | Explanation and broader coverage | Cost, retention, explicit sending scope, valid offsets/heads, ambiguity, rate limits; no assumed free tier |

A local Python tool can run the comparison; this does not imply shipping a Python backend. Keep provider-specific fields outside the normalized model. Never ship keys to the static web or extension.

## Frozen pilot corpus

Use the three prepared examples plus these cases. Annotate tokens, head relations and expected ambiguity before scoring an engine. These checks are review prompts, not a complete gold dataset.

| Text | What must be examined |
|---|---|
| My mother gives me water. | Subject, object, recipient, present agreement |
| She has been reading the book. | Auxiliary chain, aspect, lexical head |
| The book that I bought yesterday is fascinating. | Relative clause, copula, clause head |
| Did she give him water? | Question auxiliary; subject still she |
| Please give me the book. | Imperative; absent expressed subject |
| I don't think he knows. | Negation scope and embedded clause |
| The book was written by her. | Passive voice and agent |
| I saw her duck. | Competing noun/verb readings; do not force certainty |
| Visiting relatives can be tiring. | Structural ambiguity |
| They saw the man with a telescope. | Attachment ambiguity |
| The water is cold, but the tea is hot. | Coordination and two clauses |
| If it rains, we will stay home. | Conditional clause boundaries |
| The children have two books. | Plural forms and agreement |
| Water, water everywhere. | Repeated occurrences and fragment |
| I'm looking forward to seeing you. | Contraction, multiword expression |
| She gave it up. | Phrasal verb; no fabricated etymology of the phrase |
| Can you open the window? | Form versus possible pragmatic request |
| 🌱 My mother gives me water. | UTF-16 offsets after an astral character |
| Café is a borrowed word. | Combining accent; exact source preservation |
| She reads. He listens. | Separate sentence contexts |

## Common output boundary

Input: document ID, original text, selected UTF-16 `[start,end)`, containing sentence range, language, explicit request ID. Never silently submit the full long document.

Result: engine/model/version, source sentence range, token IDs + original ranges, lemma/POS/features, head/relation, independent statuses for grammar/meaning/translation/etymology, warnings and provenance. Ambiguous interpretations remain separate. Unknown fields are absent, not guessed. Reject invalid/cyclic heads and stale responses before rendering.

## Continuing evaluation

For each candidate record exact package/model versions, hardware, warm/cold latency, peak memory, download size, failures, token/range fidelity, morphology and dependency errors, licensing, and cost per 1,000 sentences if applicable. Evaluate explanations separately from syntactic accuracy. Use a linguistically reviewed reference and document disagreements; fixture resemblance is not evidence of general accuracy.

Minimum adapter gate: 100% valid source slices/head references; no stale results after edits; visible unsupported/error states. Quality and latency thresholds require measured baseline and user review before production claims. If no candidate is usable within $0, retain the labeled concept and local research path instead of disguising a paid dependency.

## Input identification, 2026-10-24

ADR-034 adds tinyld 1.3.4 light in the web client to remove manual sentence language
selection. Regression fixtures cover five languages and mixed-passage offsets;
this is not a broad accuracy evaluation. Low-signal short phrases return unknown.
No grammar engine changes or multilingual grammar coverage are implied.
