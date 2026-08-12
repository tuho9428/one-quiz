import { scoreTextAnswer, normalizeAnswer } from "../grading/text-scoring";
import { deterministicDebugCodeGrader } from "../grading/debug-code-grader";
import { scheduleReview } from "../scheduling/scheduler";
import type {
  AttemptOutcome,
  CardLearningStats,
  FlashcardQuestion,
  FlashcardRating,
  GradeResult,
  StudyAttempt,
  StudyQuestion,
} from "./types";

export { normalizeAnswer } from "../grading/text-scoring";

const MAX_SCORE = 100;
function clampScore(score: number): number {
  return Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
}

export function gradeFlashcardRating(rating: FlashcardRating): GradeResult {
  switch (rating) {
    case "again":
      return { outcome: "incorrect", score: 0 };
    case "hard":
      return { outcome: "partial", score: 45 };
    case "good":
      return { outcome: "correct", score: 80 };
    case "easy":
      return { outcome: "correct", score: 100 };
  }
}

export { scoreTextAnswer } from "../grading/text-scoring";

export function gradeQuestion(
  question: StudyQuestion,
  userAnswer: string,
): GradeResult {
  switch (question.type) {
    case "flashcard":
      return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer)
        ? { outcome: "correct", score: MAX_SCORE }
        : { outcome: "incorrect", score: 0 };
    case "multiple-choice":
      return normalizeAnswer(userAnswer) ===
        normalizeAnswer(question.correctAnswer)
        ? { outcome: "correct", score: MAX_SCORE }
        : { outcome: "incorrect", score: 0 };
    case "write":
      return scoreTextAnswer(
        question.expectedAnswer,
        userAnswer,
        question.importantKeywords,
      );
    case "debug-code":
      return deterministicDebugCodeGrader.grade(question, userAnswer);
  }
}

export interface CreateStudyAttemptInput {
  id: string;
  question: StudyQuestion;
  userAnswer: string;
  responseTimeMs?: number;
  timestamp: string;
}

export interface CreateStudyAttemptFromGradeInput {
  id: string;
  question: StudyQuestion;
  userAnswer: string;
  grade: GradeResult;
  mode?: StudyAttempt["mode"];
  skipped?: boolean;
  conceptsIncluded?: string[];
  conceptsMissed?: string[];
  grader?: StudyAttempt["grader"];
  responseTimeMs?: number;
  timestamp: string;
}

export function createStudyAttemptFromGrade(
  input: CreateStudyAttemptFromGradeInput,
): StudyAttempt {
  if (input.responseTimeMs !== undefined && input.responseTimeMs < 0) {
    throw new Error("responseTimeMs cannot be negative");
  }

  return {
    id: input.id,
    questionId: input.question.id,
    studySetId: input.question.studySetId,
    mode: input.mode ?? input.question.type,
    userAnswer: input.userAnswer,
    outcome: input.grade.outcome,
    skipped: input.skipped,
    conceptsIncluded: input.conceptsIncluded,
    conceptsMissed: input.conceptsMissed,
    grader: input.grader,
    score: input.grade.score,
    responseTimeMs: input.responseTimeMs,
    timestamp: input.timestamp,
  };
}

export function createStudyAttempt(
  input: CreateStudyAttemptInput,
): StudyAttempt {
  if (input.responseTimeMs !== undefined && input.responseTimeMs < 0) {
    throw new Error("responseTimeMs cannot be negative");
  }

  const grade = gradeQuestion(input.question, input.userAnswer);

  return createStudyAttemptFromGrade({
    ...input,
    grade,
  });
}

export interface CreateFlashcardAttemptInput {
  id: string;
  question: FlashcardQuestion;
  rating: FlashcardRating;
  responseTimeMs?: number;
  timestamp: string;
}

export function createFlashcardAttempt(
  input: CreateFlashcardAttemptInput,
): StudyAttempt {
  if (input.responseTimeMs !== undefined && input.responseTimeMs < 0) {
    throw new Error("responseTimeMs cannot be negative");
  }

  const grade = gradeFlashcardRating(input.rating);

  return {
    id: input.id,
    questionId: input.question.id,
    studySetId: input.question.studySetId,
    mode: "flashcard",
    userAnswer: "",
    outcome: grade.outcome,
    rating: input.rating,
    score: grade.score,
    responseTimeMs: input.responseTimeMs,
    timestamp: input.timestamp,
  };
}

export function createInitialLearningStats(
  questionId: string,
  studySetId: string,
): CardLearningStats {
  return {
    questionId,
    studySetId,
    timesSeen: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    mastery: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewInterval: 0,
    consecutiveSuccesses: 0,
  };
}

function masteryChangeForOutcome(outcome: AttemptOutcome): number {
  switch (outcome) {
    case "correct":
      return 10;
    case "partial":
      return 5;
    case "incorrect":
      return -10;
  }
}

export function getMasteryDelta(attempt: StudyAttempt): number {
  if (attempt.rating) {
    switch (attempt.rating) {
      case "again":
        return -12;
      case "hard":
        return 2;
      case "good":
        return 8;
      case "easy":
        return 15;
    }
  }

  return masteryChangeForOutcome(attempt.outcome);
}

export function updateLearningStats(
  stats: CardLearningStats,
  attempt: StudyAttempt,
): CardLearningStats {
  if (stats.questionId !== attempt.questionId) {
    throw new Error("Attempt question does not match learning stats");
  }

  if (stats.studySetId !== attempt.studySetId) {
    throw new Error("Attempt study set does not match learning stats");
  }

  const schedule = scheduleReview({
    reviewedAt: attempt.timestamp,
    currentInterval: stats.reviewInterval,
    consecutiveSuccesses: stats.consecutiveSuccesses,
    outcome: attempt.outcome,
    rating: attempt.rating,
  });

  return {
    ...stats,
    timesSeen: stats.timesSeen + 1,
    timesCorrect:
      stats.timesCorrect + (attempt.outcome === "correct" ? 1 : 0),
    timesIncorrect:
      stats.timesIncorrect + (attempt.outcome === "correct" ? 0 : 1),
    mastery: clampScore(
      stats.mastery + getMasteryDelta(attempt),
    ),
    lastReviewedAt: attempt.timestamp,
    nextReviewAt: schedule.nextReviewAt,
    reviewInterval: schedule.reviewInterval,
    consecutiveSuccesses: schedule.consecutiveSuccesses,
  };
}
