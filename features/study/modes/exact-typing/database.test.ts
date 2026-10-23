import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildExactTasks, selectExactTask, taskKey } from "./logic";
import { parsePortableStudyJson } from "../../import/portable";

// Opt-in integration test creates and deletes only its own uniquely named fixture.
describe.skipIf(process.env.EXACT_TYPING_DB_TEST !== "1")("Exact Typing database integration", () => {
  it("round-trips import/export and resumes all sentence stages after durable saves", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    for (const envPath of [".env.local", "app/.env.local"]) {
      if (!process.env.POSTGRES_URL && existsSync(envPath)) {
        const line = readFileSync(envPath, "utf8").split(/\r?\n/).find(line => line.startsWith("POSTGRES_URL="));
        if (line) process.env.POSTGRES_URL = line.slice("POSTGRES_URL=".length).trim().replace(/^['"]|['"]$/g, "");
      }
    }
    const repo = await import("@/lib/study/repository");
    const actions = await import("./actions");
    const { pool } = await import("@/lib/db");
    const id = `exact-typing-test-${randomUUID()}`;
    const item = { type: "verbatim", question: "How did you migrate?", answer: "I compared components. We tested.", memoryHook: "Compare; test", sentences: [{ id: "s1", text: "I compared components.", chunks: ["I compared", "components"] }, { id: "s2", text: "We tested." }], tags: ["Verbatim"] };
    try {
      await repo.ensureStudySet({ id, title: "Exact Typing integration fixture", description: "Temporary test fixture", sourceKey: id });
      await repo.importStudyItems(id, parsePortableStudyJson(JSON.stringify(item)).validItems);
      const set = await repo.getStudySetById(id);
      const questions = set!.questions.filter(q => q.type === "verbatim");
      expect(questions).toHaveLength(1);
      expect(JSON.parse(JSON.stringify(await repo.exportStudySet(id)))).toEqual([item]);
      const tasks = buildExactTasks(questions);
      const sessionId = randomUUID();
      for (const task of tasks) {
        const attemptId = randomUUID();
        const input = { setId: id, task, answer: task.target.toUpperCase(), rating: "good" as const, attemptId, sessionId, responseTimeMs: 1000 };
        const saved = await actions.saveExactAttempt(input);
        expect(saved[taskKey(task)].completed).toBe(true);
        await actions.saveExactAttempt(input); // Retry must not count twice.
        expect((await actions.getExactProgress(id))[taskKey(task)].stats.timesSeen).toBe(1);
      }
      const restored = await actions.getExactProgress(id);
      expect(selectExactTask(tasks, restored)).toBeUndefined();
      expect((await repo.getStudyProgress(id))[0].timesSeen).toBe(tasks.length);
      const attempts = await pool.query("select sentence_id, stage, rating from study_attempts where session_id = $1", [sessionId]);
      expect(attempts.rows).toHaveLength(tasks.length);
      expect(attempts.rows.at(-1)).toMatchObject({ sentence_id: "s2", stage: "cumulative", rating: "good" });
    } finally {
      await repo.deleteStudySet(id);
      // Imported tags may preexist; leave shared tags untouched.
      await pool.end();
    }
  }, 60000);
});
