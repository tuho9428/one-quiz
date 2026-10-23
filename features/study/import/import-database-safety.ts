import { createHash } from "node:crypto";

export interface SafeDatabaseTarget {
  host: string;
  port: string;
  database: string;
  environment: "local" | "preview" | "development" | "production" | "unknown remote";
  evidence: string;
  targetFingerprint: string;
}
export function identifyImportDatabase(connectionString: string): SafeDatabaseTarget {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error("POSTGRES_URL is not a valid database URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("POSTGRES_URL must use postgres or postgresql");
  const host = url.hostname;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!host || !database) throw new Error("POSTGRES_URL must explicitly identify a host and database");
  const identity = `${host}:${url.port || "5432"}/${database}`;
  let environment: SafeDatabaseTarget["environment"] = "unknown remote";
  let evidence = "Remote host has no reliable environment label. Treat as potentially production; .env.local does not prove a development database.";
  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) { environment = "local"; evidence = "Loopback host."; }
  else {
    const label = `${host} ${database}`;
    if (/(^|[._\s-])(prod|production)($|[._\s-])/i.test(label)) { environment = "production"; evidence = "Production label in host/database name; inferred, not independently verified."; }
    else if (/(^|[._\s-])(preview|staging|stage)($|[._\s-])/i.test(label)) { environment = "preview"; evidence = "Preview/staging label in host/database name; inferred, not independently verified."; }
    else if (/(^|[._\s-])(dev|development|test)($|[._\s-])/i.test(label)) { environment = "development"; evidence = "Development/test label in host/database name; inferred, not independently verified."; }
  }
  return { host, port: url.port || "5432", database, environment, evidence, targetFingerprint: createHash("sha256").update(identity).digest("hex").slice(0, 16) };
}
export function parseMarketingImportArgs(args: string[]): { apply: boolean; confirmedTarget?: string } {
  if (args.some(arg => arg !== "--dry-run" && arg !== "--apply" && !arg.startsWith("--confirm-target="))) throw new Error("Unknown argument. Use --dry-run or --apply --confirm-target=<fingerprint>");
  if (args.includes("--apply") && args.includes("--dry-run")) throw new Error("Choose either --apply or --dry-run");
  if (new Set(args).size !== args.length || args.filter(arg => arg.startsWith("--confirm-target=")).length > 1) throw new Error("Duplicate arguments are not allowed");
  return { apply: args.includes("--apply"), confirmedTarget: args.find(arg => arg.startsWith("--confirm-target="))?.slice("--confirm-target=".length) };
}
