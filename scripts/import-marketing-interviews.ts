import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { convertMarketingInterview, marketingInterviewSources } from "../features/study/import/marketing-interviews";
import { identifyImportDatabase, parseMarketingImportArgs } from "../features/study/import/import-database-safety";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function main() {
  const options = parseMarketingImportArgs(process.argv.slice(2));
  let configuredBy = "process environment";
  for (const envPath of [".env.local", "app/.env.local"]) {
    if (process.env.POSTGRES_URL || !fs.existsSync(path.join(root, envPath))) continue;
    const line = fs.readFileSync(path.join(root, envPath), "utf8").split(/\r?\n/).find(line => /^\s*POSTGRES_URL=/.test(line));
    if (line) { process.env.POSTGRES_URL = line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, ""); configuredBy = envPath; }
  }
  if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not configured");
  const database = identifyImportDatabase(process.env.POSTGRES_URL);
  // Always identify the target before importing the repository or opening any connection.
  console.log("Database target (credentials omitted): " + JSON.stringify({ ...database, configuredBy }));
  if (options.apply && options.confirmedTarget !== database.targetFingerprint) throw new Error("Apply requires --confirm-target matching the displayed database fingerprint");
  const inputs = marketingInterviewSources.map(source => {
    const input = fs.readFileSync(path.join(root, "imports", source[0]), "utf8");
    return { plan: convertMarketingInterview(source, input), sourceSha256: createHash("sha256").update(input).digest("hex") };
  });
  const sets = inputs.map(({ plan, sourceSha256 }) => ({
    title: plan.title, sourceKey: plan.sourceKey, filename: plan.filename, sourceSha256,
    originalItemCount: plan.originalItemCount, flashcardCount: plan.flashcardCount,
    verbatimItemCount: plan.verbatimItemCount, sentenceCounts: plan.sentenceCounts,
    destinationItemCount: plan.items.length, errors: [...plan.errors], warnings: [...plan.warnings],
    status: "not-checked" as string,
  }));
  const errors: string[] = [];
  const totals = {
    sets: sets.length, originalItems: sets.reduce((n, s) => n + s.originalItemCount, 0),
    flashcards: sets.reduce((n, s) => n + s.flashcardCount, 0),
    verbatimItems: sets.reduce((n, s) => n + s.verbatimItemCount, 0),
    destinationItems: sets.reduce((n, s) => n + s.destinationItemCount, 0),
    sentences: sets.reduce((n, s) => n + s.sentenceCounts.reduce((a, b) => a + b, 0), 0),
  };
  if (totals.sets !== 9 || totals.flashcards !== 11 || totals.verbatimItems !== 9 || totals.destinationItems !== 20) errors.push("Converted totals do not match the approved 9-set / 11-flashcard / 9-verbatim-item plan");
  let readOnlyVerified = false;
  let createdSets = 0;
  let alreadyImported = 0;
  let pool: typeof import("../lib/db")["pool"] | undefined;
  try {
    if (!errors.length && !sets.some(s => s.errors.length)) {
      const repository = await import("../lib/study/repository");
      pool = (await import("../lib/db")).pool;
      const client = await pool.connect();
      try {
        await client.query("begin isolation level repeatable read read only");
        const mode = await client.query<{ transaction_read_only: string }>("show transaction_read_only");
        if (mode.rows[0]?.transaction_read_only !== "on") throw new Error("Read-only transaction could not be verified");
        readOnlyVerified = true;
        const actual = await client.query<{ database: string }>("select current_database() as database");
        if (actual.rows[0]?.database !== database.database) throw new Error("Connected database differs from the reported target");
        for (const [index, { plan }] of inputs.entries()) {
          try { sets[index].status = await repository.inspectCreateOnlyStudySetImport(plan, client); }
          catch (error) {
            sets[index].status = "conflict";
            sets[index].errors.push(error instanceof repository.StudySetImportConflict ? error.message : "Database preflight failed; no writes attempted");
          }
        }
        await client.query("rollback");
      } catch (error) { await client.query("rollback"); throw error; }
      finally { client.release(); }
      if (sets.some(s => s.errors.length)) errors.push("Preflight found a conflict or validation failure; the entire batch is blocked");
      if (options.apply && !errors.length) {
        for (const { plan } of inputs) {
          const result = await repository.createOnlyStudySetImport(plan);
          if (result === "created") createdSets++; else alreadyImported++;
        }
      }
    }
  } catch (error) {
    // Do not print driver errors/stacks/connection strings: they can contain secrets.
    errors.push(error instanceof Error && error.name === "StudySetImportConflict" ? error.message : "Database verification/import failed. Raw connection errors are suppressed to protect credentials.");
  } finally { await pool?.end(); }
  for (const [index, { sourceSha256 }] of inputs.entries()) {
    const now = createHash("sha256").update(fs.readFileSync(path.join(root, "imports", sets[index].filename), "utf8")).digest("hex");
    if (now !== sourceSha256) errors.push(`Source changed during execution: ${sets[index].filename}`);
  }
  const report = {
    mode: options.apply ? "apply" : "dry-run", database: { ...database, configuredBy },
    readOnlyPreflightVerified: readOnlyVerified, sets, totals,
    expectedTotals: { sets: 9, flashcards: 11, verbatimItems: 9, destinationItems: 20 },
    errors, sourceFilesUnchanged: !errors.some(e => e.startsWith("Source changed")),
    createdSets, alreadyImported,
    databaseWritesOccurred: options.apply && createdSets > 0,
    confirmation: options.apply ? `${createdSets} sets created; ${alreadyImported} already imported. No existing study items or progress overwritten.` : "DRY RUN ONLY: no database writes occurred. No sets, items, tags, sessions, attempts, or progress were created or modified.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length || sets.some(s => s.errors.length)) process.exitCode = 1;
}
main().catch(() => {
  console.error("Import stopped before completion. Check arguments, POSTGRES_URL, and the nine source files. Raw errors are suppressed to protect credentials.");
  process.exitCode = 1;
});
