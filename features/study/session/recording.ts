import {
  createInitialLearningStats,
  updateLearningStats,
} from "../domain/engine";
import type {
  CardLearningStats,
  StudyAttempt,
  StudyQuestion,
} from "../domain/types";

export type StatsByQuestion = Record<string, CardLearningStats>;

/** Create the in-memory learning state needed by a study session. */
export function createStatsForQuestions(
  questions: StudyQuestion[],
): StatsByQuestion {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      createInitialLearningStats(question.id, question.studySetId),
    ]),
  );
}

export function getStatsForQuestion(
  statsByQuestion: StatsByQuestion,
  question: StudyQuestion,
): CardLearningStats {
  return (
    statsByQuestion[question.id] ??
    createInitialLearningStats(question.id, question.studySetId)
  );
}

/** Apply one shared attempt to card learning stats without mutating prior state. */
export function applyAttemptToStats(
  statsByQuestion: StatsByQuestion,
  attempt: StudyAttempt,
): StatsByQuestion {
  const currentStats =
    statsByQuestion[attempt.questionId] ??
    createInitialLearningStats(attempt.questionId, attempt.studySetId);

  return {
    ...statsByQuestion,
    [attempt.questionId]: updateLearningStats(currentStats, attempt),
  };
}
