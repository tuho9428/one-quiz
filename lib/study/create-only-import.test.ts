import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateOnlyStudySetImport } from "./repository";
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("../db", () => ({ pool: { query: mocks.query, connect: async () => ({ query: mocks.query, release: mocks.release }) } }));
import { createOnlyStudySetImport, inspectCreateOnlyStudySetImport } from "./repository";

const input: CreateOnlyStudySetImport = {
  id: "marketing-interview-q09", sourceKey: "marketing-interview-q09-q17:q09", title: "Marketing Interview Q09", description: "Practice", ownerId: null,
  items: [
    { type: "flashcard", question: "Q9: Steps?", answer: "Compare; test", tags: ["Q09", "Verbatim"] },
    { type: "verbatim", question: "Q9: Answer?", answer: "I compared. We tested.", tags: ["Q09"], memoryHook: "Compare; test", sentences: [{ id: "q09-s01", text: "I compared.", chunks: ["I compared"], memoryHook: "Compare" }, { id: "q09-s02", text: "We tested.", chunks: ["We tested"], memoryHook: "Test" }] },
  ],
};
function stored() {
  return {
    id: input.id, source_key: input.sourceKey, owner_id: null, title: input.title, description: input.description, created_at: "2026-01-01", updated_at: "2026-01-01",
    items: input.items.map((item, position) => ({ id: `existing-${position}`, study_set_id: input.id, type: item.type, task: "explain-behavior", question: item.question, answer: item.answer, explanation: item.explanation ?? null, memory_hook: item.memoryHook ?? null, sentences: item.sentences ?? [], code_snippet: null, language: null, position, options: [], tags: [...item.tags].reverse() })),
  };
}
const mutations = () => mocks.query.mock.calls.filter(([sql]) => /^\s*(insert|update|delete|alter|create|drop)\b/i.test(sql));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("insert into tags") ? [{ id: "tag-id" }] : [] }));
});
describe("create-only transactional imports", () => {
  it("preflights absent sets with SELECT only", async () => {
    expect(await inspectCreateOnlyStudySetImport(input)).toBe("create");
    expect(mutations()).toEqual([]);
  });
  it("returns already imported and performs zero mutations when content matches", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("from study_sets ss") ? [stored()] : [] }));
    expect(await createOnlyStudySetImport(input)).toBe("already-imported");
    expect(mutations()).toEqual([]);
    expect(mocks.query).toHaveBeenCalledWith("commit");
  });
  it.each(["answer", "chunks", "hook", "title", "order", "owner", "extra item", "source key", "sentence order"])("stops on changed %s without modifying anything", async field => {
    const row = stored();
    if (field === "answer") row.items[0].answer = "Changed";
    if (field === "chunks") row.items[1].sentences = [{ ...row.items[1].sentences[0], chunks: ["changed"] }, row.items[1].sentences[1]];
    if (field === "hook") row.items[1].sentences = [{ ...row.items[1].sentences[0], memoryHook: "Changed" }, row.items[1].sentences[1]];
    if (field === "title") row.title = "Changed";
    if (field === "order") row.items[0].position = 3;
    if (field === "owner") Object.assign(row, { owner_id: "other-owner" });
    if (field === "extra item") row.items.push({ ...row.items[0], id: "extra", position: 4 });
    if (field === "source key") row.source_key = "different-source";
    if (field === "sentence order") { row.items[1].sentences = [...row.items[1].sentences].reverse(); row.items[1].answer = row.items[1].sentences.map(s => s.text).join(" "); }
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("from study_sets ss") ? [row] : [] }));
    await expect(createOnlyStudySetImport(input)).rejects.toThrow(field === "owner" || field === "source key" ? "Import conflict" : "stored content differs");
    expect(mutations()).toEqual([]);
    expect(mocks.query).toHaveBeenCalledWith("rollback");
  });
  it("creates a set and all items within one transaction and never touches progress", async () => {
    expect(await createOnlyStudySetImport(input)).toBe("created");
    const calls = mocks.query.mock.calls.map(([sql]) => sql as string);
    expect(calls[0]).toBe("begin");
    expect(calls.at(-1)).toBe("commit");
    expect(calls.filter(sql => sql.startsWith("insert into study_sets"))).toHaveLength(1);
    expect(calls.filter(sql => sql.includes("insert into study_items"))).toHaveLength(2);
    expect(calls.some(sql => /study_progress|study_attempts|study_sessions|exact_typing_progress/.test(sql))).toBe(false);
    expect(calls.findIndex(sql => sql.includes("pg_advisory_xact_lock"))).toBeLessThan(calls.findIndex(sql => sql.includes("from study_sets ss")));
    expect(mocks.release).toHaveBeenCalled();
  });
  it("rolls back the entire set if an item or its metadata fails", async () => {
    let count = 0;
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("insert into study_items") && ++count === 2) throw new Error("item failed");
      return { rows: sql.includes("insert into tags") ? [{ id: "tag-id" }] : [] };
    });
    await expect(createOnlyStudySetImport(input)).rejects.toThrow("item failed");
    expect(mocks.query).toHaveBeenCalledWith("rollback");
    expect(mocks.query).not.toHaveBeenCalledWith("commit");
    expect(mocks.release).toHaveBeenCalled();
  });
  it("does not append duplicate items on a second successful run", async () => {
    let exists = false;
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("insert into study_sets")) exists = true;
      return { rows: sql.includes("from study_sets ss") && exists ? [stored()] : sql.includes("insert into tags") ? [{ id: "tag-id" }] : [] };
    });
    expect(await createOnlyStudySetImport(input)).toBe("created");
    const writes = mutations().length;
    expect(await createOnlyStudySetImport(input)).toBe("already-imported");
    expect(mutations()).toHaveLength(writes);
  });
  it("rejects invalid or duplicate planned items before starting a transaction", async () => {
    await expect(createOnlyStudySetImport({ ...input, items: [input.items[0], input.items[0]] })).rejects.toThrow("duplicate");
    await expect(createOnlyStudySetImport({ ...input, items: [{ ...input.items[1], sentences: [] }] })).rejects.toThrow("invalid");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
