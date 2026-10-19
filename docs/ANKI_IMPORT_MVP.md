# Anki → Uberlang: local deck import

Implementation specification, 2026-10-19. Base: published `87b10bd`.
This work is isolated from the unpublished AnkiConnect/declutter branch.
Implemented on `feat/anki-local-import`; publication is coordinated separately
with the parent task. [Verification record](reviews/2026-10-19-anki-import.md).

## Observable workflow

A quiet **My decks** action opens a local library. Import a user-selected `.apkg`,
`.txt` or `.tsv`; inspect counts and warnings before saving. Map word, example and
answer separately for each note type, choose a language explicitly, filter by
original deck/tag/text and select notes. Render at most 20 rows per page. No import
or network analysis occurs merely because a file was chosen.

One Anki note becomes one library record, even with multiple reverse/cloze cards.
Keep note GUID/type, source filename, every sanitized field, all deck memberships
(including `Parent::Child`) and tags. Use original deck for filtered cards (`odid`).
Language and mapping are user decisions; do not infer them from deck names.

Store in an independent, versioned IndexedDB database; never alter existing roots,
preferences or study notes. Save a batch atomically. Report quota/unavailable
storage errors without a success claim. A repeated GUID in the same language is a
duplicate; without GUID use all normalized fields and type, independent of filename.
Skip is the default. Explicit update replaces the matching library record, without
changing Anki. Review counts before committing. Allow removal of one library item.

Open one English example/word in the notebook without submitting it; invalidate
old results, retain source provenance, and require Analyze sentence / Look up word.
For other supported history languages offer an explicit single-word history
request through the existing API, with choices and source attribution. English
syntax remains English-only. Unsupported languages may be stored but do not gain
invented analysis. Editing/importing never makes the entire deck a network payload.

## Format and safety contract

- Legacy ZIP `collection.anki2` / `collection.anki21` with SQLite schema 11.
- Modern protobuf `meta` version 3 + Zstandard `collection.anki21b`, schema 18.
  Read normalized notetypes/fields/decks, not the old compatibility placeholder.
- Reject unknown versions, inconsistent schema, encryption, ZIP64, unsafe paths,
  duplicate filenames, corrupt archives, invalid UTF-8 and malformed tables.
- TXT/TSV: quoted multiline fields and Anki headers including separator, HTML,
  columns, deck, tags, note type and GUID columns. Unsupported headers are shown;
  inconsistent field counts are rejected, never silently truncated.
- Bounded worker: 32 MiB input/SQLite, 5,000 archive entries, 128 MiB declared
  total expanded ZIP size, 200:1 ZIP ratio, 10,000 notes, 50,000 cards, 64 fields,
  32,000 characters per field, 8 million total text characters. Stream inflation
  and Zstandard output under limits; limit Zstandard window before allocation.
  Terminate worker after 20 seconds or cancellation. No filesystem extraction.
  The persistent library additionally caps serialized records at 16 million
  characters / 10,000 notes, with transaction rollback if exceeded.
- Parse HTML as inert text without DOM attachment; strip scripts/styles/embedded
  objects/remote media, retain cloze answer text with a warning. No template JS,
  rendered card HTML, tracking requests, audio, images, scheduling or review log.
  Explain these omissions before import, including media-only/empty mapped notes.
- SQLite runs in a bundled, same-origin WASM worker with fixed read-only queries;
  reject views/virtual tables for required tables. No extensions or schema scripts.
- Test only generated synthetic fixtures. Do not read personal Anki collections or
  change Anki settings. No AnkiConnect/localhost client.

## Acceptance

Synthetic legacy and modern packages, multiple note types, nested/filtered decks,
reverse cards, tags, Unicode/cloze/HTML, TSV roundtrip, duplicates and updates,
archive bombs/traversal/corruption and malformed SQLite. Storage rollback and
stale-result/privacy regressions. Tests, typecheck, all required builds; actual
browser QA of file selection, mapping, cancellation, persistence, keyboard focus,
all themes at desktop/390 px and reduced motion. Record actual limits and evidence.
Small commits; coordinate main publication with the parent task.

## Primary sources checked

- [Anki export manual](https://docs.ankiweb.net/manual/exporting)
- [Anki text headers and quoting](https://docs.ankiweb.net/manual/importing/text-files)
- Anki source inspected at `56a79f3b93b934a553460b2941ccf9323fd6b201`:
  [package metadata](https://github.com/ankitects/anki/blob/56a79f3b93b934a553460b2941ccf9323fd6b201/rslib/src/import_export/package/meta.rs),
  [protobuf](https://github.com/ankitects/anki/blob/56a79f3b93b934a553460b2941ccf9323fd6b201/proto/anki/import_export.proto),
  [schema 11](https://github.com/ankitects/anki/blob/56a79f3b93b934a553460b2941ccf9323fd6b201/rslib/src/storage/schema11.sql),
  [normalized schema](https://github.com/ankitects/anki/blob/56a79f3b93b934a553460b2941ccf9323fd6b201/rslib/src/storage/upgrades/schema15_upgrade.sql).

The importer is an independent reader of these data formats, not copied Anki code.

## Explicit compatibility boundaries

`.colpkg`, raw databases, ZIP64, encrypted archives, unknown package/schema
versions, Zstandard dictionaries/multiple frames and non-UTF-8 text are unsupported.
Only ZIP stored/deflate entries are accepted. ZIP CRC is checked on extracted
entries; the Zstandard library does not independently validate frame checksums.
Numeric media entries are counted and bounded from ZIP metadata but left unopened.
The file is an import snapshot, not a live view of the Anki collection.

All source fields are preserved as sanitized text; original HTML, card-specific
template rendering and cloze scheduling semantics are intentionally not preserved.
No actual personal collection or installed Anki app was used for validation.
Browser QA used Chromium; Safari/Firefox and real exported packages from every
Anki release are not certified by these synthetic fixtures.
