import type {
  AttemptOutcome,
  CardLearningStats,
  StudyAttempt,
  StudyMode,
  StudyQuestion,
} from "../../domain/types";
import { isDueForReview } from "../../scheduling/scheduler";
import { canStudyItemInMode, canUseInMultipleChoice, hasCodeCapability } from "../../domain/eligibility";

export type SmartDifficultyLevel = 1 | 2 | 3 | 4;
export type SmartPriorityBucket =
  | "weak-due"
  | "recently-learned"
  | "medium"
  | "strong";

export interface SmartStudyCandidate {
  question: StudyQuestion;
  stats: CardLearningStats;
}

export interface SmartSelectionState {
  now?: Date;
  previousQuestionId?: string;
  targetLevel: SmartDifficultyLevel;
  recentAttempts: StudyAttempt[];
  recentModes: StudyMode[];
  availableQuestions?: StudyQuestion[];
}

const BUCKET_WEIGHTS: Record<SmartPriorityBucket, number> = {
  "weak-due": 40,
  "recently-learned": 30,
  medium: 20,
  strong: 10,
};

function latestAttemptFor(
  questionId: string,
  attempts: StudyAttempt[],
): StudyAttempt | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].questionId === questionId) return attempts[index];
  }

  return undefined;
}

function isRecentAttempt(attempt: StudyAttempt | undefined, now: Date): boolean {
  if (!attempt) return false;

  const timestamp = new Date(attempt.timestamp).getTime();
  return !Number.isNaN(timestamp) && now.getTime() - timestamp <= 7 * 86400000;
}

function wasRecentMiss(attempt: StudyAttempt | undefined, now: Date): boolean {
  return (
    isRecentAttempt(attempt, now) &&
    (attempt?.outcome === "incorrect" || attempt?.outcome === "partial" || attempt?.skipped === true)
  );
}

export function getQuestionLevel(
  question: StudyQuestion,
  allItems: StudyQuestion[] = [question],
): SmartDifficultyLevel {
  if (canUseInMultipleChoice(question, allItems)) return 1;
  if (hasCodeCapability(question)) return 4;
  if (canStudyItemInMode(question, "write")) return 3;
  return 2;
}

export function getPriorityBucket(
  candidate: SmartStudyCandidate,
  attempts: StudyAttempt[],
  now = new Date(),
): SmartPriorityBucket {
  const latestAttempt = latestAttemptFor(candidate.question.id, attempts);

  if (
    isDueForReview(candidate.stats.nextReviewAt, now) ||
    candidate.stats.mastery < 40 ||
    wasRecentMiss(latestAttempt, now)
  ) {
    return "weak-due";
  }

  if (isRecentAttempt(latestAttempt, now)) return "recently-learned";
  if (candidate.stats.mastery < 80) return "medium";
  return "strong";
}

function getConceptMissBoost(
  candidate: SmartStudyCandidate,
  attempts: StudyAttempt[],
): number {
  const candidateConcepts = new Set(candidate.question.concepts ?? []);
  if (candidateConcepts.size === 0) return 0;

  return attempts.reduce((boost, attempt) => {
    if (
      attempt.outcome === "correct" &&
      !attempt.skipped &&
      attempt.conceptsMissed?.length === 0
    ) {
      return boost;
    }

    const missedConcepts = attempt.conceptsMissed ?? [];
    const overlaps = missedConcepts.some((concept) => candidateConcepts.has(concept));
    return overlaps ? boost + 18 : boost;
  }, 0);
}

function getCandidateScore(
  candidate: SmartStudyCandidate,
  state: SmartSelectionState,
  now: Date,
): number {
  const latestAttempt = latestAttemptFor(candidate.question.id, state.recentAttempts);
  const bucket = getPriorityBucket(candidate, state.recentAttempts, now);
  const levelDistance = Math.abs(getQuestionLevel(candidate.question, state.availableQuestions) - state.targetLevel);
  const recentMode = state.recentModes.includes(
    getPreferredMode(candidate.question, state.targetLevel, state.recentModes, state.availableQuestions),
  );

  return (
    BUCKET_WEIGHTS[bucket] +
    getConceptMissBoost(candidate, state.recentAttempts) +
    (wasRecentMiss(latestAttempt, now) ? 22 : 0) +
    (isDueForReview(candidate.stats.nextReviewAt, now) ? 10 : 0) +
    Math.max(0, 30 - levelDistance * 14) +
    (recentMode ? -8 : 4)
  );
}

function chooseWeightedBucket(
  buckets: SmartPriorityBucket[],
  random: () => number,
): SmartPriorityBucket {
  const totalWeight = buckets.reduce((total, bucket) => total + BUCKET_WEIGHTS[bucket], 0);
  let threshold = random() * totalWeight;

  for (const bucket of buckets) {
    threshold -= BUCKET_WEIGHTS[bucket];
    if (threshold < 0) return bucket;
  }

  return buckets[buckets.length - 1];
}

export function getPreferredMode(
  question: StudyQuestion,
  targetLevel: SmartDifficultyLevel,
  recentModes: StudyMode[] = [],
  allItems: StudyQuestion[] = [question],
): StudyMode {
  if (targetLevel <= 1 && canStudyItemInMode(question, "multiple-choice", allItems)) return "multiple-choice";
  if (targetLevel >= 4 && canStudyItemInMode(question, "debug-code", allItems)) return "debug-code";
  if (targetLevel === 2 && question.type === "write" && canStudyItemInMode(question, "rapid-recall", allItems)) return "rapid-recall";
  if (targetLevel >= 3 && canStudyItemInMode(question, "write", allItems) && !recentModes.slice(-2).includes("write")) return "write";
  if (canStudyItemInMode(question, "flashcard", allItems)) return "flashcard";
  if (canStudyItemInMode(question, "write", allItems)) return "write";
  return "rapid-recall";
}

export function selectNextSmartQuestion(
  candidates: SmartStudyCandidate[],
  state: SmartSelectionState,
  random: () => number = Math.random,
): SmartStudyCandidate | undefined {
  if (candidates.length === 0) return undefined;

  const eligible =
    candidates.length > 1 && state.previousQuestionId
      ? candidates.filter((candidate) => candidate.question.id !== state.previousQuestionId)
      : candidates;
  const pool = eligible.length > 0 ? eligible : candidates;
  const now = state.now ?? new Date();
  const buckets = [...new Set(pool.map((candidate) => getPriorityBucket(candidate, state.recentAttempts, now)))];
  const selectedBucket = chooseWeightedBucket(buckets, random);
  const bucketCandidates = pool.filter(
    (candidate) => getPriorityBucket(candidate, state.recentAttempts, now) === selectedBucket,
  );
  const scored = bucketCandidates
    .map((candidate) => ({ candidate, score: getCandidateScore(candidate, state, now) }))
    .sort((left, right) => right.score - left.score);
  const bestScore = scored[0]?.score;
  const ties = scored.filter((entry) => entry.score === bestScore);

  return ties[Math.floor(random() * ties.length)]?.candidate ?? scored[0]?.candidate;
}

export function getNextDifficultyLevel(
  previousLevel: SmartDifficultyLevel,
  outcome: AttemptOutcome,
): SmartDifficultyLevel {
  if (outcome === "correct") return Math.min(4, previousLevel + 1) as SmartDifficultyLevel;
  if (outcome === "partial") return previousLevel;
  return Math.max(1, previousLevel - 1) as SmartDifficultyLevel;
}

export function getModeLabel(mode: StudyMode): string {
  switch (mode) {
    case "multiple-choice":
      return "Multiple Choice";
    case "flashcard":
      return "Flashcard";
    case "write":
      return "Write";
    case "rapid-recall":
      return "Rapid Recall";
    case "debug-code":
      return "Debug / Code";
  }
}
