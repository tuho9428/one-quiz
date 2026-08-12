import type { AttemptOutcome, CardLearningStats, FlashcardRating } from "../domain/types";

export interface ReviewScheduleInput {
  reviewedAt: string;
  currentInterval: number;
  consecutiveSuccesses: number;
  outcome: AttemptOutcome;
  rating?: FlashcardRating;
}

export interface ReviewSchedule {
  nextReviewAt: string;
  reviewInterval: number;
  consecutiveSuccesses: number;
}

const MIN_INTERVAL_DAYS = 1;

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("reviewedAt must be a valid date");
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function intervalFromRating(
  rating: FlashcardRating,
  currentInterval: number,
): number {
  const previous = Math.max(0, currentInterval);

  switch (rating) {
    case "again":
      return 0;
    case "hard":
      return previous === 0
        ? MIN_INTERVAL_DAYS
        : Math.max(MIN_INTERVAL_DAYS, Math.round(previous * 1.5));
    case "good":
      return Math.max(MIN_INTERVAL_DAYS, previous * 2 || MIN_INTERVAL_DAYS);
    case "easy":
      return Math.max(3, previous * 3 || 3);
  }
}

function intervalFromOutcome(
  outcome: AttemptOutcome,
  currentInterval: number,
): number {
  switch (outcome) {
    case "incorrect":
      return 0;
    case "partial":
      return currentInterval === 0
        ? MIN_INTERVAL_DAYS
        : Math.max(MIN_INTERVAL_DAYS, Math.round(currentInterval * 1.5));
    case "correct":
      return Math.max(MIN_INTERVAL_DAYS, currentInterval * 2 || MIN_INTERVAL_DAYS);
  }
}

/**
 * A small, predictable scheduler. Intervals are stored in whole days and
 * failed recalls become due immediately for focused correction.
 */
export function scheduleReview(input: ReviewScheduleInput): ReviewSchedule {
  const interval = input.rating
    ? intervalFromRating(input.rating, input.currentInterval)
    : intervalFromOutcome(input.outcome, input.currentInterval);
  const isSuccessful = input.rating
    ? input.rating === "good" || input.rating === "easy"
    : input.outcome === "correct";
  const nextConsecutiveSuccesses = isSuccessful
    ? input.consecutiveSuccesses + 1
    : 0;

  return {
    nextReviewAt: addDays(input.reviewedAt, interval),
    reviewInterval: interval,
    consecutiveSuccesses: nextConsecutiveSuccesses,
  };
}

export function isDueForReview(nextReviewAt: string | null, now = new Date()): boolean {
  if (nextReviewAt === null) return true;

  const reviewTime = new Date(nextReviewAt).getTime();
  return !Number.isNaN(reviewTime) && reviewTime <= now.getTime();
}

export function getCardLearningState(
  stats: Pick<CardLearningStats, "mastery" | "consecutiveSuccesses">,
): "learning" | "mastered" {
  return stats.mastery >= 80 && stats.consecutiveSuccesses >= 3
    ? "mastered"
    : "learning";
}
