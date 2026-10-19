# ADR-023: bounded, local Anki deck library

Accepted 2026-10-19 for Anki → Uberlang research.

Use a dedicated browser worker for ZIP/Zstandard/SQLite parsing, text-only fields,
and a separate IndexedDB library. Bundled sql.js WASM requires the narrowly scoped
`wasm-unsafe-eval` script CSP directive; no `unsafe-eval`, external host, or blob
worker is authorized. Assets remain same-origin and load only on file import.

Read both known package generations. Preserve note identity and multiple deck
memberships rather than importing generated cards as duplicate notes. Explicit
mapping/language/selection precede an atomic save. Library persistence is local to
this browser/origin; no server collection, no synchronization or review schedule.

The notebook still handles English initial lookup/grammar. A library record can
also request one supported language's word history via the existing bounded
etymology API. No automatic batch enrichment. Refer to ANKI_IMPORT_MVP.md for
supported formats, resource budgets, omissions and release evidence.
