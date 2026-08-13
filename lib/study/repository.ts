import { createHash } from "node:crypto";

import type {
  AttemptOutcome,
  CardLearningStats,
  DebugCodeQuestion,
  StudyAttempt,
  StudyMode,
  StudyQuestion,
  StudySet,
} from "@/features/study/domain/types";
import type { NormalizedPortableStudyItem, PortableStudyItem } from "@/features/study/import/portable";
import { selectContinueStudying, type ContinueStudyingCandidate } from "../../features/study/dashboard/continue";
import { pool } from "../db";
import { getCurrentUserId } from "../auth";

export interface StudySetRecord extends StudySet {
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  questions: StudyQuestion[];
}

export interface ImportSummary {
  imported: number;
  tagsCreatedOrReused: number;
  setId: string;
}

export interface StudyProgressUpdate {
  studyItemId: string;
  masteryScore: number;
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  consecutiveSuccesses: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewInterval: number;
  lastResult: AttemptOutcome | "skipped" | null;
}

export interface StudyItemRow {
  id: string;
  study_set_id: string;
  type: StudyQuestion["type"];
  task: DebugCodeQuestion["task"];
  question: string;
  answer: string;
  explanation: string | null;
  code_snippet: string | null;
  language: string | null;
  position: number;
  options: Array<{ text: string; isCorrect: boolean }>;
  tags: string[];
}

interface StudySetRow {
  id: string;
  owner_id: string | null;
  title: string;
  description: string;
  created_at: Date | string;
  updated_at: Date | string;
  items: StudyItemRow[];
}

function viewerOwner(ownerId: string | null): { sql: string; params: string[] } {
  return ownerId
    ? { sql: "ss.owner_id = $2", params: [ownerId] }
    : { sql: "ss.owner_id is null", params: [] };
}

export function mapStudyItemRowToQuestion(row: StudyItemRow): StudyQuestion {
  const base = {
    id: row.id,
    studySetId: row.study_set_id,
    concepts: row.tags,
  };

  switch (row.type) {
    case "flashcard":
      return { ...base, type: "flashcard", prompt: row.question, answer: row.answer, explanation: row.explanation ?? undefined, choices: row.options.map((option) => option.text), codeSnippet: row.code_snippet ?? undefined, language: row.code_snippet ? row.language ?? "text" : undefined, task: row.code_snippet ? row.task : undefined };
    case "write":
      return { ...base, type: "write", question: row.question, expectedAnswer: row.answer, importantKeywords: row.tags, explanation: row.explanation ?? undefined, choices: row.options.map((option) => option.text), codeSnippet: row.code_snippet ?? undefined, language: row.code_snippet ? row.language ?? "text" : undefined, task: row.code_snippet ? row.task : undefined };
    case "multiple-choice": {
      const correct = row.options.find((option) => option.isCorrect)?.text ?? row.answer;
      return { ...base, type: "multiple-choice", question: row.question, correctAnswer: correct, distractors: row.options.filter((option) => !option.isCorrect).map((option) => option.text), explanation: row.explanation ?? undefined, codeSnippet: row.code_snippet ?? undefined, language: row.code_snippet ? row.language ?? "text" : undefined, task: row.code_snippet ? row.task : undefined };
    }
    case "debug-code":
      return { ...base, type: "debug-code", task: row.task, problemStatement: row.question, language: row.language ?? "text", codeSnippet: row.code_snippet ?? "", expectedExplanation: row.answer, choices: row.options.map((option) => option.text) };
  }
}

function mapSetRow(row: StudySetRow): StudySetRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    questions: row.items.sort((left, right) => left.position - right.position).map(mapStudyItemRowToQuestion),
  };
}

const studySetSelect = `
  select
    ss.id,
    ss.owner_id,
    ss.title,
    ss.description,
    ss.created_at,
    ss.updated_at,
    coalesce((
      select json_agg(json_build_object(
        'id', si.id,
        'study_set_id', si.study_set_id,
        'type', si.type,
        'task', si.task,
        'question', si.question,
        'answer', si.answer,
        'explanation', si.explanation,
        'code_snippet', si.code_snippet,
        'language', si.language,
        'position', si.position,
        'options', coalesce((
          select json_agg(json_build_object('text', sio.option_text, 'isCorrect', sio.is_correct) order by sio.position)
          from study_item_options sio where sio.study_item_id = si.id
        ), '[]'::json),
        'tags', coalesce((
          select json_agg(t.name order by t.normalized_name)
          from study_item_tags sit join tags t on t.id = sit.tag_id where sit.study_item_id = si.id
        ), '[]'::json)
      ) order by si.position)
      from study_items si where si.study_set_id = ss.id
    ), '[]'::json) as items
  from study_sets ss
`;

export async function getStudySetById(
  studySetId: string,
  ownerId?: string | null,
): Promise<StudySetRecord | null> {
  const predicate = viewerOwner(ownerId === undefined ? await getCurrentUserId() : ownerId);
  const result = await pool.query<StudySetRow>(
    `${studySetSelect} where ss.id = $1 and ${predicate.sql}`,
    [studySetId, ...predicate.params],
  );
  const row = result.rows[0];
  return row ? mapSetRow(row) : null;
}

export async function getStudySets(ownerId?: string | null): Promise<StudySetRecord[]> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const predicate = resolvedOwnerId ? "ss.owner_id = $1" : "ss.owner_id is null";
  const result = await pool.query<StudySetRow>(`${studySetSelect} where ${predicate} order by ss.updated_at desc`, resolvedOwnerId ? [resolvedOwnerId] : []);
  return result.rows.map(mapSetRow);
}

interface ContinueStudyingRow {
  study_set_id: string;
  study_set_title: string;
  session_id: string | null;
  mode: string | null;
  activity_at: Date | string | null;
  completed_items: number;
  total_items: number;
  incomplete: boolean;
}

/**
 * Finds real study activity for the current owner. Set creation/update time is
 * intentionally absent from this query so imported content cannot masquerade
 * as something the learner recently studied.
 */
export async function getContinueStudyingForUser(
  ownerId?: string | null,
): Promise<ContinueStudyingCandidate | null> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const setOwnerPredicate = resolvedOwnerId ? "ss.owner_id = $1" : "ss.owner_id is null";
  const sessionSetOwnerPredicate = resolvedOwnerId ? "session_set.owner_id = $1" : "session_set.owner_id is null";
  const progressOwnerPredicate = resolvedOwnerId ? "sp.owner_id = $1" : "sp.owner_id is null";
  const result = await pool.query<ContinueStudyingRow>(
    `with incomplete_sessions as (
       select
         ss.study_set_id,
         ss.id as session_id,
         ss.mode,
         greatest(ss.started_at, coalesce(max(sa.created_at), ss.started_at)) as activity_at,
         count(distinct sa.study_item_id)::int as completed_items,
         (select count(*)::int from study_items total_items where total_items.study_set_id = ss.study_set_id) as total_items,
         true as incomplete
       from study_sessions ss
       join study_sets session_set on session_set.id = ss.study_set_id
       left join study_attempts sa on sa.session_id = ss.id
       where ss.completed_at is null and ${sessionSetOwnerPredicate}
       group by ss.study_set_id, ss.id, ss.mode, ss.started_at
     ),
     activity as (
       select
         ss.study_set_id,
         null::text as session_id,
         ss.mode,
         greatest(ss.started_at, coalesce(ss.completed_at, ss.started_at)) as activity_at,
         0::int as completed_items,
         (select count(*)::int from study_items total_items where total_items.study_set_id = ss.study_set_id) as total_items,
         false as incomplete
       from study_sessions ss
       where ${setOwnerPredicate}

       union all

       select
         ss.study_set_id,
         null::text as session_id,
         sa.mode,
         sa.created_at as activity_at,
         0::int as completed_items,
         (select count(*)::int from study_items total_items where total_items.study_set_id = ss.study_set_id) as total_items,
         false as incomplete
       from study_attempts sa
       join study_sessions ss on ss.id = sa.session_id
       where ${setOwnerPredicate}

       union all

       select
         si.study_set_id,
         null::text as session_id,
         null::text as mode,
         sp.last_reviewed_at as activity_at,
         0::int as completed_items,
         (select count(*)::int from study_items total_items where total_items.study_set_id = si.study_set_id) as total_items,
         false as incomplete
       from study_progress sp
       join study_items si on si.id = sp.study_item_id
       join study_sets ss on ss.id = si.study_set_id
       where sp.last_reviewed_at is not null
         and ${progressOwnerPredicate}
         and ${setOwnerPredicate}
     )
     select
       activity_rows.study_set_id,
       study_sets.title as study_set_title,
       activity_rows.session_id,
       activity_rows.mode,
       activity_rows.activity_at,
       activity_rows.completed_items,
       activity_rows.total_items,
       activity_rows.incomplete
     from (
       select study_set_id, session_id, mode, activity_at, completed_items, total_items, incomplete from incomplete_sessions
       union all
       select study_set_id, session_id, mode, activity_at, completed_items, total_items, incomplete from activity
     ) activity_rows
     join study_sets on study_sets.id = activity_rows.study_set_id
     order by activity_rows.incomplete desc, activity_rows.activity_at desc nulls last`,
    resolvedOwnerId ? [resolvedOwnerId] : [],
  );

  const candidates = result.rows.flatMap((row): ContinueStudyingCandidate[] => {
    if (!row.activity_at) return [];
    return [{
      studySetId: row.study_set_id,
      studySetTitle: row.study_set_title,
      sessionId: row.incomplete ? row.session_id : null,
      mode: row.mode,
      lastStudiedAt: new Date(row.activity_at).toISOString(),
      completedItems: row.completed_items,
      totalItems: row.total_items,
      incomplete: row.incomplete,
      resumable: false,
    }];
  });

  return selectContinueStudying(candidates);
}

export interface EnsureStudySetInput {
  id: string;
  title: string;
  description: string;
  sourceKey: string;
  ownerId?: string | null;
}

export async function ensureStudySet(input: EnsureStudySetInput): Promise<StudySetRecord> {
  const ownerId = input.ownerId ?? await getCurrentUserId();
  const result = await pool.query<{ id: string }>(
    `insert into study_sets (id, owner_id, title, description, source_key)
     values ($1, $2, $3, $4, $5)
     on conflict (source_key) do update set title = excluded.title, description = excluded.description, updated_at = now()
     returning id`,
    [input.id, ownerId, input.title, input.description, input.sourceKey],
  );
  const set = await getStudySetById(result.rows[0].id, ownerId);
  if (!set) throw new Error("Study set was created but could not be loaded");
  return set;
}

export function sourceKeyForItem(item: NormalizedPortableStudyItem): string {
  const canonical = JSON.stringify({
    type: item.type,
    question: item.question.trim(),
    answer: item.answer.trim(),
    choices: item.choices ?? [],
    codeSnippet: item.codeSnippet ?? "",
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function importStudyItems(
  studySetId: string,
  items: NormalizedPortableStudyItem[],
  ownerId?: string | null,
): Promise<ImportSummary> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const set = await getStudySetById(studySetId, resolvedOwnerId);
  if (!set) throw new Error("Study set not found or not accessible");

  const client = await pool.connect();
  let tagsCreatedOrReused = 0;
  try {
    await client.query("begin");
    for (const [position, item] of items.entries()) {
      const sourceKey = sourceKeyForItem(item);
      const itemResult = await client.query<{ id: string }>(
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
         returning id`,
        [
          globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${position}`,
          studySetId,
          item.type,
          item.task ?? "explain-behavior",
          item.question,
          item.answer,
          item.explanation ?? null,
          item.codeSnippet ?? null,
          item.language ?? null,
          position,
          sourceKey,
        ],
      );
      const itemId = itemResult.rows[0].id;

      await client.query("delete from study_item_options where study_item_id = $1", [itemId]);
      if (item.choices && item.choices.length > 0) {
        for (const [optionPosition, optionText] of (item.choices ?? []).entries()) {
          await client.query(
            `insert into study_item_options (id, study_item_id, option_text, position, is_correct)
             values ($1, $2, $3, $4, $5)`,
            [globalThis.crypto?.randomUUID?.() ?? `option-${Date.now()}-${optionPosition}`, itemId, optionText, optionPosition, optionText === item.answer],
          );
        }
      }

      await client.query("delete from study_item_tags where study_item_id = $1", [itemId]);
      for (const tagName of item.tags) {
        const normalizedName = tagName.trim().toLocaleLowerCase();
        if (!normalizedName) continue;
        const tagResult = await client.query<{ id: string }>(
          `insert into tags (id, name, normalized_name) values ($1, $2, $3)
           on conflict (normalized_name) do update set name = tags.name
           returning id`,
          [globalThis.crypto?.randomUUID?.() ?? `tag-${Date.now()}`, tagName.trim(), normalizedName],
        );
        tagsCreatedOrReused += 1;
        await client.query(
          "insert into study_item_tags (study_item_id, tag_id) values ($1, $2) on conflict do nothing",
          [itemId, tagResult.rows[0].id],
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { imported: items.length, tagsCreatedOrReused, setId: studySetId };
}

export async function exportStudySet(studySetId: string): Promise<PortableStudyItem[]> {
  const set = await getStudySetById(studySetId);
  if (!set) throw new Error("Study set not found or not accessible");
  return set.questions.map((question) => {
    switch (question.type) {
      case "flashcard":
        return { type: "flashcard", question: question.prompt, answer: question.answer, explanation: question.explanation, tags: question.concepts, choices: question.choices };
      case "write":
        return { type: "write", question: question.question, answer: question.expectedAnswer, explanation: question.explanation, tags: question.concepts, choices: question.choices };
      case "multiple-choice":
        return { type: "multiple_choice", question: question.question, answer: question.correctAnswer, explanation: question.explanation, choices: [question.correctAnswer, ...question.distractors], tags: question.concepts };
      case "debug-code":
        return { type: "debug_code", question: question.problemStatement, answer: question.expectedExplanation, codeSnippet: question.codeSnippet, language: question.language, task: question.task, tags: question.concepts, choices: question.choices };
    }
  });
}

export async function createStudySession(input: { id: string; studySetId: string; mode: StudyMode }): Promise<void> {
  const ownerId = await getCurrentUserId();
  await pool.query("insert into study_sessions (id, owner_id, study_set_id, mode) values ($1, $2, $3, $4)", [input.id, ownerId, input.studySetId, input.mode]);
}

export async function recordStudyAttempt(attempt: StudyAttempt & { sessionId: string }): Promise<void> {
  await pool.query(
    `insert into study_attempts (id, session_id, study_item_id, mode, user_answer, score, result, response_time_ms, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [attempt.id, attempt.sessionId, attempt.questionId, attempt.mode, attempt.userAnswer, attempt.score ?? null, attempt.skipped ? "skipped" : attempt.outcome, attempt.responseTimeMs ?? null, attempt.timestamp],
  );
}

function progressId(studyItemId: string, ownerId: string | null): string {
  return `${ownerId ?? "anonymous"}:${studyItemId}`;
}

function mapProgressRow(row: {
  study_item_id: string;
  mastery_score: number;
  times_seen: number;
  times_correct: number;
  times_incorrect: number;
  consecutive_successes: number;
  last_reviewed_at: Date | string | null;
  next_review_at: Date | string | null;
  review_interval: number;
  last_result: AttemptOutcome | "skipped" | null;
  study_set_id: string;
}): CardLearningStats {
  return {
    questionId: row.study_item_id,
    studySetId: row.study_set_id,
    timesSeen: row.times_seen,
    timesCorrect: row.times_correct,
    timesIncorrect: row.times_incorrect,
    mastery: row.mastery_score,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : null,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at).toISOString() : null,
    reviewInterval: row.review_interval,
    consecutiveSuccesses: row.consecutive_successes,
  };
}

export async function updateStudyProgress(
  update: StudyProgressUpdate,
  ownerId?: string | null,
): Promise<void> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  await pool.query(
    `insert into study_progress (id, owner_id, study_item_id, mastery_score, times_seen, times_correct, times_incorrect, consecutive_successes, last_reviewed_at, next_review_at, review_interval, last_result)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (id) do update set
       mastery_score = excluded.mastery_score,
       times_seen = excluded.times_seen,
       times_correct = excluded.times_correct,
       times_incorrect = excluded.times_incorrect,
       consecutive_successes = excluded.consecutive_successes,
       last_reviewed_at = excluded.last_reviewed_at,
       next_review_at = excluded.next_review_at,
       review_interval = excluded.review_interval,
       last_result = excluded.last_result`,
    [progressId(update.studyItemId, resolvedOwnerId), resolvedOwnerId, update.studyItemId, update.masteryScore, update.timesSeen, update.timesCorrect, update.timesIncorrect, update.consecutiveSuccesses, update.lastReviewedAt, update.nextReviewAt, update.reviewInterval, update.lastResult],
  );
}

export async function getStudyProgress(
  studySetId: string,
  ownerId?: string | null,
): Promise<CardLearningStats[]> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const result = await pool.query(`
    select sp.*, si.study_set_id
    from study_progress sp
    join study_items si on si.id = sp.study_item_id
    where si.study_set_id = $1 and ${resolvedOwnerId ? "sp.owner_id = $2" : "sp.owner_id is null"}
    order by si.position
  `, resolvedOwnerId ? [studySetId, resolvedOwnerId] : [studySetId]);
  return result.rows.map(mapProgressRow);
}

export async function getDueItems(
  studySetId: string,
  ownerId?: string | null,
): Promise<StudyQuestion[]> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const result = await pool.query<{ id: string }>(`
    select si.id
    from study_items si
    left join study_progress sp on sp.study_item_id = si.id and ${resolvedOwnerId ? "sp.owner_id = $2" : "sp.owner_id is null"}
    where si.study_set_id = $1 and (sp.next_review_at is null or sp.next_review_at <= now())
    order by si.position
  `, resolvedOwnerId ? [studySetId, resolvedOwnerId] : [studySetId]);
  const set = await getStudySetById(studySetId, resolvedOwnerId);
  if (!set) return [];
  const dueIds = new Set(result.rows.map((row) => row.id));
  return set.questions.filter((question) => dueIds.has(question.id));
}

export async function getWeakItems(
  studySetId: string,
  ownerId?: string | null,
): Promise<StudyQuestion[]> {
  const resolvedOwnerId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  const result = await pool.query<{ id: string }>(`
    select si.id
    from study_items si
    left join study_progress sp on sp.study_item_id = si.id and ${resolvedOwnerId ? "sp.owner_id = $2" : "sp.owner_id is null"}
    where si.study_set_id = $1 and coalesce(sp.mastery_score, 0) < 40
    order by coalesce(sp.mastery_score, 0), si.position
  `, resolvedOwnerId ? [studySetId, resolvedOwnerId] : [studySetId]);
  const set = await getStudySetById(studySetId, resolvedOwnerId);
  if (!set) return [];
  const weakIds = new Set(result.rows.map((row) => row.id));
  return set.questions.filter((question) => weakIds.has(question.id));
}

export async function finishStudySession(
  sessionId: string,
  completedAt: string,
  durationMs: number,
  score: number | null,
): Promise<void> {
  await pool.query(
    "update study_sessions set completed_at = $2, duration_ms = $3, score = $4 where id = $1",
    [sessionId, completedAt, durationMs, score],
  );
}
