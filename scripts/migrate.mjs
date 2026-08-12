import fs from "node:fs";
import path from "node:path";
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
      if (!match) continue;
      process.env[match[1]] ??= match[2].trim().replace(/^['"]|['"]$/g, "");
    }
    if (process.env.POSTGRES_URL) return;
  }
}

loadLocalEnv();

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is required. Add it to .env.local, app/.env.local, or the environment.");
}

const migrationsDir = path.join(root, "db", "migrations");
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });

try {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedResult = await client.query("select filename from schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  for (const filename of migrations) {
    if (applied.has(filename)) {
      console.log(`Skipped ${filename}`);
      continue;
    }

    await client.query("begin");
    try {
      await client.query(fs.readFileSync(path.join(migrationsDir, filename), "utf8"));
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
