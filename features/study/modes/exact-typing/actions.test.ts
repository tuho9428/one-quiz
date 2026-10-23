import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExactTasks, taskKey } from "./logic";
import type { VerbatimQuestion } from "../../domain/types";

const mocks = vi.hoisted(() => ({ query: vi.fn(), clientQuery: vi.fn(), release: vi.fn(), getSet: vi.fn(), getProgress: vi.fn(), record: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ pool: { query: mocks.query, connect: async () => ({ query: mocks.clientQuery, release: mocks.release }) } }));
vi.mock("@/lib/auth", () => ({ getCurrentUserId: async () => "owner" }));
vi.mock("@/lib/study/repository", () => ({ getStudySetById: mocks.getSet, getStudyProgress: mocks.getProgress, recordStudyAttempt: mocks.record, updateStudyProgress: mocks.update }));
import { getExactProgress, saveExactAttempt } from "./actions";
const question: VerbatimQuestion = { id: "q", studySetId: "set", type: "verbatim", question: "What did you do?", answer: "We tested.", sentences: [{ id: "s", text: "We tested." }] };
const task = buildExactTasks([question])[0];
const input = { setId: "set", task, answer: "we tested", rating: "good" as const, attemptId: "attempt", sessionId: "session", responseTimeMs: 1000 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSet.mockResolvedValue({ id: "set", questions: [question] });
  mocks.getProgress.mockResolvedValue([]);
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.record.mockResolvedValue(undefined);
  mocks.clientQuery.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("select id from study_sessions") ? [{ id: "session" }] : [] }));
});
describe("durable exact typing attempts", () => {
  it.each([
    ["again", "we tested", false], ["hard", "we tested", false],
    ["good", "we tested", true], ["easy", "we tested", true],
    ["good", "we guessed", false], ["easy", "we guessed", false],
  ] as const)("rating %s with %s completes=%s", async (rating, answer, completed) => {
    await saveExactAttempt({ ...input, rating, answer });
    const save = mocks.clientQuery.mock.calls.find(([sql]) => sql.includes("insert into exact_typing_progress"));
    expect(save?.[1][6]).toBe(completed);
    expect(JSON.parse(save?.[1][7]).timesSeen).toBe(1);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ mode: "exact-typing", sentenceId: "s", stage: "copy", rating, outcome: answer === "we tested" ? "correct" : "incorrect" }), expect.anything());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ studyItemId: "q", timesSeen: 1 }), "owner", expect.anything());
    expect(mocks.clientQuery).toHaveBeenCalledWith("commit");
  });
  it("rolls back all writes on a failed attempt save", async () => {
    mocks.record.mockRejectedValueOnce(new Error("Disconnected"));
    await expect(saveExactAttempt(input)).rejects.toThrow("Disconnected");
    expect(mocks.clientQuery).toHaveBeenCalledWith("rollback");
    expect(mocks.clientQuery).not.toHaveBeenCalledWith("commit");
    expect(mocks.release).toHaveBeenCalled();
  });
  it("does not double count an already recorded attempt on retry", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("select id from study_attempts") ? [{ id: "attempt" }] : [] }));
    await saveExactAttempt(input);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects inaccessible sets and stale content before writing", async () => {
    mocks.getSet.mockResolvedValueOnce(null);
    await expect(saveExactAttempt(input)).rejects.toThrow("not accessible");
    await expect(saveExactAttempt({ ...input, task: { ...task, target: "Old text." } })).rejects.toThrow("content has changed");
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("restores owner-scoped stage progress using the content key", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ study_item_id: task.questionId, sentence_id: task.sentenceId, stage: task.stage, target: task.target, completed: true, stats: { timesSeen: 2 } }] });
    expect(await getExactProgress("set")).toEqual({ [taskKey(task)]: { completed: true, stats: { timesSeen: 2 } } });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("owner_id is not distinct from $2"), ["set", "owner"]);
  });
});
