"use server";

import { createHash } from "node:crypto";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getStudySetById, getStudyProgress, recordStudyAttempt, updateStudyProgress } from "@/lib/study/repository";
import { createInitialLearningStats, createStudyAttemptFromGrade, updateLearningStats } from "../../domain/engine";
import type { FlashcardRating } from "../../domain/types";
import { buildExactTasks, gradeExactText, taskKey, type ExactProgressMap, type ExactTask, type ExactProgress } from "./logic";

function progressId(owner: string | null, key: string): string {
  return createHash("sha256").update(JSON.stringify([owner, key])).digest("hex");
}

export async function getExactProgress(setId: string): Promise<ExactProgressMap> {
  const owner = await getCurrentUserId();
  if (!await getStudySetById(setId, owner)) throw new Error("Study set not accessible");
  const rows = await pool.query<{ study_item_id: string; sentence_id: string; stage: ExactTask["stage"]; target: string; completed: boolean; stats: ExactProgress["stats"] }>(
    `select ep.study_item_id, ep.sentence_id, ep.stage, ep.target, ep.completed, ep.stats from exact_typing_progress ep join study_items si on si.id = ep.study_item_id
     where si.study_set_id = $1 and ep.owner_id is not distinct from $2`, [setId, owner]);
  return Object.fromEntries(rows.rows.map(row => [taskKey({ questionId: row.study_item_id, sentenceId: row.sentence_id, stage: row.stage, target: row.target, sentenceNumber: 0 }), { completed: row.completed, stats: row.stats }]));
}

export async function saveExactAttempt(input: { setId: string; task: ExactTask; answer: string; rating: FlashcardRating; attemptId: string; sessionId: string; responseTimeMs: number }): Promise<ExactProgressMap> {
  const owner = await getCurrentUserId();
  const set = await getStudySetById(input.setId, owner);
  if (!set) throw new Error("Study set not accessible");
  if (!["again", "hard", "good", "easy"].includes(input.rating) || !input.answer.trim() || input.answer.length > 20000 || !Number.isFinite(input.responseTimeMs) || input.responseTimeMs < 0 || !input.attemptId || !input.sessionId) throw new Error("Invalid attempt");
  const questions = set.questions.filter(q => q.type === "verbatim");
  const tasks = buildExactTasks(questions);
  const task = tasks.find(task => taskKey(task) === taskKey(input.task));
  const question = questions.find(q => q.id === task?.questionId);
  if (!task || !question) throw new Error("Exercise content has changed. Reload to continue.");
  const key = taskKey(task);
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Serialize updates to sentence stats and aggregate item stats across tabs.
    await client.query("select id from study_items where id = $1 for update", [question.id]);
    const existingAttempt = await client.query("select id from study_attempts where id = $1", [input.attemptId]);
    if (!existingAttempt.rows.length) {
      const prior = await client.query<{ stats: ExactProgress["stats"]; completed: boolean }>("select stats, completed from exact_typing_progress where id = $1 and owner_id is not distinct from $2", [progressId(owner, key), owner]);
      const timestamp = new Date().toISOString();
      const attempt = { ...createStudyAttemptFromGrade({ id: input.attemptId, question, mode: "exact-typing", userAnswer: input.answer, grade: gradeExactText(task.target, input.answer), grader: "deterministic", timestamp, responseTimeMs: input.responseTimeMs }), rating: input.rating, sentenceId: task.sentenceId, stage: task.stage };
      const stats = updateLearningStats(prior.rows[0]?.stats ?? createInitialLearningStats(question.id, set.id), attempt);
      const completed = attempt.outcome === "correct" && (input.rating === "good" || input.rating === "easy");
      await client.query(`insert into study_sessions (id, owner_id, study_set_id, mode) values ($1, $2, $3, 'exact-typing') on conflict (id) do nothing`, [input.sessionId, owner, set.id]);
      const session = await client.query("select id from study_sessions where id = $1 and study_set_id = $2 and owner_id is not distinct from $3 and mode = 'exact-typing'", [input.sessionId, set.id, owner]);
      if (!session.rows.length) throw new Error("Session not accessible");
      await recordStudyAttempt({ ...attempt, sessionId: input.sessionId }, client);
      await client.query(`insert into exact_typing_progress (id, owner_id, study_item_id, sentence_id, stage, target, completed, stats)
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (id) do update set completed = excluded.completed, stats = excluded.stats, updated_at = now()`,
        [progressId(owner, key), owner, question.id, task.sentenceId, task.stage, task.target, completed, JSON.stringify(stats)]);
      const aggregate = (await getStudyProgress(set.id, owner)).find(s => s.questionId === question.id) ?? createInitialLearningStats(question.id, set.id);
      const next = updateLearningStats(aggregate, attempt);
      await updateStudyProgress({ studyItemId: question.id, masteryScore: next.mastery, timesSeen: next.timesSeen, timesCorrect: next.timesCorrect, timesIncorrect: next.timesIncorrect, consecutiveSuccesses: next.consecutiveSuccesses, lastReviewedAt: next.lastReviewedAt, nextReviewAt: next.nextReviewAt, reviewInterval: next.reviewInterval, lastResult: attempt.outcome }, owner, client);
      await client.query("update study_sessions set completed_at = $2, duration_ms = (extract(epoch from ($2::timestamptz - started_at)) * 1000)::int where id = $1", [input.sessionId, timestamp]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
  return getExactProgress(set.id);
}
