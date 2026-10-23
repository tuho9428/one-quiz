# Exact Typing

Import `examples/exact-typing.json` from the study set's JSON importer. The array includes a complete interview answer and a normal semicolon-separated flashcard. The importer also accepts a single item object.

Choose **Exact Typing** on the study set, or select verbatim items and choose it in Study selected. Other study modes can still use a verbatim item's question and full answer through the existing adapters.

Each sentence progresses through Copy, Fill Gaps (type the whole sentence), First-Letter Cues, and Exact Sentence. After all sentences, Cumulative Recall asks for sentence 1, then 1–2, and so on. Copy displays optional chunks. Correct answers rated Good or Easy advance; Again, Hard, and wrong answers repeat. Learned exercises can be reviewed from the expandable list.

Memory hooks appear during Copy and Fill Gaps. Show hint reveals them during later stages. An incorrect answer automatically reveals the hook and target. Grading ignores capitalization, punctuation and whitespace while requiring exact words in order. Word feedback distinguishes correct, missing, extra, and replaced words.

## Content and persistence

Verbatim items require question, answer and a non-empty sentences array. Each sentence needs a unique, stable id and text; chunks and memoryHook are optional. Joined sentence texts must match the complete answer after normalization. Tags use the existing format. Import/export and item editing preserve all metadata.

Apply `npm.cmd run migrate` before running the updated app. Migration 002 adds verbatim metadata, sentence/stage/rating attempt fields, and an owner-scoped progress table. No existing progress is replaced. Progress uses the existing shared attempt writer, learning stats, aggregate item progress, scheduler, and sessions. Each sentence/stage and cumulative prefix has independent stats. Content-sensitive keys invalidate exercises when their target changes; the database stores a SHA-256 key so long answers do not exceed PostgreSQL index limits. Saves are transactional and retries reuse attempt IDs to prevent double counting. Resume is automatic from the first unfinished exercise.

Authentication follows the existing repository boundary, which currently returns an anonymous owner. The same anonymous-user behavior as the rest of the app applies.

## Verification

```powershell
npm.cmd run migrate
npm.cmd run test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build -- --webpack
$env:EXACT_TYPING_DB_TEST='1'
npm.cmd run test -- features/study/modes/exact-typing/database.test.ts
Remove-Item Env:EXACT_TYPING_DB_TEST
```

The database integration test is opt-in. It imports a uniquely named fixture, checks export, exercises every stage and cumulative prefix, checks retry deduplication and resume, and deletes its fixture. It leaves shared tags untouched.
