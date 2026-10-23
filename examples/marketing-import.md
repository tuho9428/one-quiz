# One-time marketing interview import

Source files are read from `imports/` using an explicit Q09–Q17 manifest. Each file becomes one set. Source JSON files are never rewritten.

Requires Node 24 (the current project environment). No new dependencies are added. The local resolve hook supports built-in TypeScript stripping and the project's `@/` aliases without emitting files.

## Dry run

```powershell
npm.cmd run import:marketing -- --dry-run
```

Dry-run is also the default with no flags. It prints the configured database host, port, database name, environment inference and target fingerprint without username, password, query parameters, or a connection string. Opaque remote databases are classified as unknown and potentially production; `.env.local` does not establish database environment.

All nine files are converted and validated before opening a database connection. The entire preflight runs in a PostgreSQL `REPEATABLE READ READ ONLY` transaction, verifies `transaction_read_only = on` and `current_database()`, then rolls back. It checks source-key and destination-ID collisions and compares stored content for any already imported sets. Any conflict blocks the entire batch before writes. Read-only preflight makes no schema, set, item, tag, session, attempt, or progress changes.

## Conversion

Each original verbatim answer becomes one sentence without sentence splitting, in its original order, with stable IDs such as `q09-s01`. Chunks and memory hooks stay attached to each sentence. The full-answer memory hook combines every sentence hook, and the full answer joins sentence texts in order. All flashcards remain separate; Q11's manager example stays an optional flashcard outside the primary coworker story. The normal portable validator checks every converted item.

Sentence hooks round-trip through the existing JSONB sentence column and export/editor formats. Exact Typing shows the current sentence's hook in sentence exercises and the combined hook in cumulative recall. No migration is required.

## Apply — only after explicit approval

The script supports `--apply --confirm-target=<fingerprint printed by dry-run>`. This is an opt-in write path; the dry run does not execute it. Recheck the database target and obtain approval before invoking it.

Each set and all its items are created in one transaction using shared new-item persistence. An advisory lock serializes cooperating runs for a source key. Matching source key and identical content returns `already-imported` without any inserts, updates, or deletes. Different content, metadata, or ownership is a conflict. Existing progress is excluded from comparison and is never modified. Content comparison ignores generated IDs/timestamps and treats tag order/case as shared database presentation; sentence order, hooks, chunks, answers and item order remain significant. No delete-and-replace synchronization is performed.

Each set commits independently; an error rolls back the entire current set. If an apply run is interrupted after earlier sets committed, rerunning skips those unchanged sets. A read-only preflight checks all sets before an apply run starts; each transactional write checks again for concurrent changes.

## Verification

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build -- --webpack
npm.cmd run import:marketing -- --dry-run
```

Unit tests use mocked database clients for writes and real source fixtures for conversion. The opt-in Exact Typing database integration test is skipped in a normal test run; do not enable it for this dry-run-only workflow.
