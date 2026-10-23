import { describe, expect, it } from "vitest";
import { identifyImportDatabase, parseMarketingImportArgs } from "./import-database-safety";
describe("import database identification and command guards", () => {
  it.each([
    ["localhost", "quiz", "local"], ["127.0.0.1", "quiz", "local"], ["[::1]", "quiz", "local"],
    ["db.example.com", "quiz_prod", "production"], ["db.example.com", "quiz_preview", "preview"],
    ["dev-db.example.com", "quiz", "development"], ["ep-anonymous.neon.tech", "neondb", "unknown remote"],
  ])("classifies %s/%s as %s without credentials", (host, db, expected) => {
    const report = identifyImportDatabase(`postgresql://secret-user:secret-password@${host}:5432/${db}?sslmode=require&token=hidden-token`);
    expect(report.environment).toBe(expected);
    expect(report.database).toBe(db);
    for (const secret of ["secret-user", "secret-password", "hidden-token", "postgresql://"]) expect(JSON.stringify(report)).not.toContain(secret);
  });
  it("does not infer development from an opaque remote database", () => {
    expect(identifyImportDatabase("postgres://user:pass@db.example.com/quiz").evidence).toContain("potentially production");
  });
  it("fingerprints the target independently of credentials", () => {
    expect(identifyImportDatabase("postgres://a:b@localhost/quiz").targetFingerprint).toBe(identifyImportDatabase("postgres://c:d@localhost:5432/quiz").targetFingerprint);
    expect(identifyImportDatabase("postgres://a:b@localhost/quiz2").targetFingerprint).not.toBe(identifyImportDatabase("postgres://a:b@localhost/quiz").targetFingerprint);
  });
  it.each(["not a url", "https://example.com/db", "postgres://localhost/"])("rejects invalid targets", input => {
    expect(() => identifyImportDatabase(input)).toThrow();
  });
  it("defaults to dry-run and requires an explicit apply flag", () => {
    expect(parseMarketingImportArgs([]).apply).toBe(false);
    expect(parseMarketingImportArgs(["--dry-run"]).apply).toBe(false);
    expect(parseMarketingImportArgs(["--apply", "--confirm-target=abc"])).toEqual({ apply: true, confirmedTarget: "abc" });
  });
  it.each([["--apply", "--dry-run"], ["--force"], ["--dry-run", "--dry-run"], ["--confirm-target=a", "--confirm-target=b"]])("rejects ambiguous/unknown flags: %j", (...args) => {
    expect(() => parseMarketingImportArgs(args)).toThrow();
  });
});
