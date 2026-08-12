import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadLocalEnv() {
  if (process.env.POSTGRES_URL) return;
  const envPaths = [path.join(root, ".env.local"), path.join(root, "app", ".env.local")];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) process.env[match[1]] ??= match[2].trim().replace(/^['"]|['"]$/g, "");
    }
    if (process.env.POSTGRES_URL) return;
  }
}

loadLocalEnv();
if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is required");

const { parsePortableStudyJson } = await import("../features/study/import/portable.ts");
const importName = process.argv[2] ?? "javascript";
const importConfig = {
  javascript: {
    dataFile: "javascript-typescript-interview-prep.json",
    setId: "javascript-typescript-interview-prep",
    title: "JavaScript & TypeScript Interview Prep",
    description: "Focused interview practice covering JavaScript scope, closures, functions, collections, immutability, asynchronous execution, the event loop, and TypeScript types.",
    sourceKey: "javascript-typescript-interview-prep-v1",
  },
  resume: {
    dataFile: "walmart-iris-interview-prep.json",
    setId: "walmart-iris-interview-prep",
    title: "Walmart IRIS Project Interview Prep",
    description: "Interview practice covering Walmart MP-IRIS modules, frontend ownership, React architecture, testing, CI/CD, production troubleshooting, and distributed teamwork.",
    sourceKey: "walmart-iris-interview-prep-v1",
  },
};
const config = importConfig[importName];
if (!config) throw new Error(`Unknown import: ${importName}. Choose javascript or resume.`);
const dataPath = path.join(root, "data", config.dataFile);
const parsed = parsePortableStudyJson(fs.readFileSync(dataPath, "utf8"));
if (parsed.syntaxError || parsed.errors.length > 0) {
  throw new Error(JSON.stringify({ syntaxError: parsed.syntaxError, errors: parsed.errors }, null, 2));
}

function sourceKeyForItem(item) {
  return createHash("sha256").update(JSON.stringify({
    type: item.type,
    question: item.question.trim(),
    answer: item.answer.trim(),
    choices: item.choices ?? [],
    codeSnippet: item.codeSnippet ?? "",
  })).digest("hex");
}

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
const { setId, title, description, sourceKey } = config;

try {
  await client.connect();
  await client.query("set statement_timeout = '30s'");
  await client.query("begin");
  await client.query(
    `insert into study_sets (id, owner_id, title, description, source_key)
     values ($1, $2, $3, $4, $5)
     on conflict (source_key) do update set title = excluded.title, description = excluded.description, updated_at = now()`,
    [setId, null, title, description, sourceKey],
  );

  let tagsAssociated = 0;
  let imported = 0;
  let updated = 0;

  for (const [position, item] of parsed.validItems.entries()) {
    console.log(`Importing item ${position + 1}/${parsed.validItems.length}`);
    const result = await client.query(
      `insert into study_items (id, study_set_id, type, task, question, answer, explanation, code_snippet, language, position, source_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (study_set_id, source_key) do update set
         type = excluded.type,
         task = excluded.task,
         question = excluded.question,
         answer = excluded.answer,
         explanation = excluded.explanation,
         code_snippet = excluded.code_snippet,
         language = excluded.language,
         position = excluded.position,
         updated_at = now()
       returning id, (xmax = 0) as inserted`,
      [randomUUID(), setId, item.type, item.task ?? "explain-behavior", item.question, item.answer, item.explanation ?? null, item.codeSnippet ?? null, item.language ?? null, position, sourceKeyForItem(item)],
    );
    const itemId = result.rows[0].id;
    imported += 1;
    if (!result.rows[0].inserted) updated += 1;

    await client.query("delete from study_item_options where study_item_id = $1", [itemId]);
    for (const [optionPosition, optionText] of (item.choices ?? []).entries()) {
      await client.query(
        `insert into study_item_options (id, study_item_id, option_text, position, is_correct)
         values ($1, $2, $3, $4, $5)`,
        [randomUUID(), itemId, optionText, optionPosition, optionText === item.answer],
      );
    }

    await client.query("delete from study_item_tags where study_item_id = $1", [itemId]);
    for (const tagName of item.tags) {
      const normalizedName = tagName.trim().toLocaleLowerCase();
      if (!normalizedName) continue;
      const tag = await client.query(
        `insert into tags (id, name, normalized_name) values ($1, $2, $3)
         on conflict (normalized_name) do update set name = tags.name
         returning id`,
        [randomUUID(), tagName.trim(), normalizedName],
      );
      tagsAssociated += 1;
      await client.query("insert into study_item_tags (study_item_id, tag_id) values ($1, $2) on conflict do nothing", [itemId, tag.rows[0].id]);
    }
  }

  await client.query("commit");
  const counts = await client.query("select type, count(*)::int as count from study_items where study_set_id = $1 group by type order by type", [setId]);
  const tags = await client.query(`
    select count(distinct t.id)::int as count
    from tags t join study_item_tags sit on sit.tag_id = t.id
    join study_items si on si.id = sit.study_item_id
    where si.study_set_id = $1`, [setId]);

  console.log(title);
  console.log("Study set: created/reused");
  console.log(`Questions imported: ${imported}`);
  console.log(`Questions updated on this run: ${updated}`);
  for (const row of counts.rows) console.log(`${row.type}: ${row.count}`);
  console.log(`Tags associated: ${tagsAssociated}`);
  console.log(`Unique tags created/reused: ${tags.rows[0].count}`);
  console.log("Errors: 0");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
