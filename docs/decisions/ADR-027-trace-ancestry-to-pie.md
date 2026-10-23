# ADR-027: follow cited ancestry toward Proto-Indo-European

Accepted 2026-10-23 following the owner's request that exploring a word show its
etymology through PIE. Supersedes ADR-025's prohibition on automatic crawling
**after an explicit Explore action**. Merely opening saved data remains local.

## Decision

After the reader chooses an initial etymology, the research tree sequentially
follows its supported dictionary targets. Existing `/api/etymology`, source
parser, revision evidence and typed relationships remain authoritative. Stop at
PIE on each branch. Other language origins, unavailable evidence, cycles and
unsupported targets remain visible endpoints, never invented connections to PIE.
Components and inflections retain their labels; following their histories does
not turn them into inheritance edges. Separate etymologies pause tracing for a
reader choice; alternatives are never automatically merged or disambiguated.

Keep the growing tree usable, preserve successful steps on Stop or failure, and
allow explicit continuation. Abort requests when the explorer is replaced or
unmounted; ignore late responses. Deduplicate identical lookups within one run,
retain the server's existing throttling/cache, and cap each run at 24 requests.
The existing 64-node and eight-step path limits still apply. Each request times
out after 15 seconds. No new provider, credential or storage schema is needed.

Saved discoveries and prepared examples open without network requests. Tracing
saved sourced trees requires Continue tracing roots. The search disclosure says
Explore sends the word and its cited roots; passages and notes stay local.

## Consequences

A supported path now reaches PIE without repetitive per-node clicks. Reaching PIE
on one branch does not mean every branch is complete. An interrupted or bounded
run remains partial. Conservative parsing may stop where Wiktionary prose has
more information than the supported structured evidence; the source stays linked.
The feature promises evidence-following, not universal PIE ancestry or exhaustive
coverage of every historical stage.
