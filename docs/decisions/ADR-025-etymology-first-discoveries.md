# ADR-025: etymology research is the primary workspace

Accepted 2026-10-23, following the owner's direction to make etymology the core
journey throughout Uberlang. Supersedes the radial launcher as the initial screen
and the English-only entry restriction for **word history** in ADR-024. English
sentence grammar and dictionary meanings retain their existing contracts.

## Decision

The root page opens a word/language search and the research workspace. Its
allowlist and explicit requests reuse `/api/etymology`; this adds no provider,
model, credential or inferred ancestry. Multiple etymologies require an explicit
choice. Prepared families remain available offline and clearly labeled.

Passages and imported Anki notes lead to the same workspace. Opening an imported
word prefills it locally; the subsequent Explore action submits only word and
language. Reading, grammar, session notes and the Tools menu remain supporting
surfaces in the existing shell. Electron/extension and old root backups remain.

Reuse FamilyExplorer (React, D3 hierarchy, Motion), with a serializable view:
selected form, visible endpoints, path mode, scale, scroll and navigation history.
Expansion retains typed relations, revisions, reader choices and cycle limits.
A selected form can explicitly start a new word lookup. No automatic crawling.

Save discovery is explicit. Thereafter edits to that saved discovery persist in
a versioned, bounded localStorage library (`uberlang.explorations.v1`), separate
from imported Anki notes and `lingua.roots.v1`. Store at most 30 discoveries and
2 million UTF-16 units, with graph validation and stale-tab checks before writes.
Write failure must remain visible and must not claim success. Persist notes,
known/curious marks and language interests, plus optional original local context.
Library/current-tree JSON backups preserve evidence. Restore previews the count
and adds copies; unreadable storage requires explicit replacement from a backup.
There is no account, sync or telemetry. Clearing browser data loses local saves.

Comparison lists common dictionary forms in two loaded trees and links their
separate evidence. It does **not** assert a common ancestor or merge homonyms,
components or inflections. Language interests only star existing branches.

## Consequences

The one useful loop is word → sourced tree → further form → saved discovery →
resume. All supported word-history languages have a direct entry, but allowlist
membership is not a coverage/accuracy guarantee. Session reading notes remain
session-only; saved discoveries are a different, durable artifact.

JSON backup is portable across origins; there is no implicit migration of old
notes, roots, or Anki data. localStorage bounds fit the current small research
library; a larger collection should move to an explicitly versioned IndexedDB
schema. The conflict check prevents known stale-tab overwrites, not collaborative
editing. Saved source snapshots are not silently refreshed from the network.
