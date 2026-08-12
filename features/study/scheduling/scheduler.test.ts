import { describe, expect, it } from "vitest";

import {
  getCardLearningState,
  isDueForReview,
  scheduleReview,
} from "./scheduler";

const reviewedAt = "2026-08-11T12:00:00.000Z";

describe("scheduleReview", () => {
  it("makes Again and incorrect answers due immediately", () => {
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 14,
        consecutiveSuccesses: 4,
        outcome: "incorrect",
        rating: "again",
      }),
    ).toEqual({
      nextReviewAt: reviewedAt,
      reviewInterval: 0,
      consecutiveSuccesses: 0,
    });
  });

  it("grows Hard reviews gently", () => {
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 4,
        consecutiveSuccesses: 2,
        outcome: "partial",
        rating: "hard",
      }),
    ).toMatchObject({ reviewInterval: 6, consecutiveSuccesses: 0 });
  });

  it("doubles Good reviews and triples Easy reviews", () => {
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 3,
        consecutiveSuccesses: 1,
        outcome: "correct",
        rating: "good",
      }),
    ).toMatchObject({
      nextReviewAt: "2026-08-17T12:00:00.000Z",
      reviewInterval: 6,
      consecutiveSuccesses: 2,
    });
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 3,
        consecutiveSuccesses: 1,
        outcome: "correct",
        rating: "easy",
      }),
    ).toMatchObject({ reviewInterval: 9, consecutiveSuccesses: 2 });
  });

  it("schedules non-flashcard correct and partial answers through the same rules", () => {
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 2,
        consecutiveSuccesses: 1,
        outcome: "correct",
      }),
    ).toMatchObject({ reviewInterval: 4, consecutiveSuccesses: 2 });
    expect(
      scheduleReview({
        reviewedAt,
        currentInterval: 2,
        consecutiveSuccesses: 1,
        outcome: "partial",
      }),
    ).toMatchObject({ reviewInterval: 3, consecutiveSuccesses: 0 });
  });
});

describe("review status helpers", () => {
  it("treats new cards and past review dates as due", () => {
    const now = new Date(reviewedAt);
    expect(isDueForReview(null, now)).toBe(true);
    expect(isDueForReview(reviewedAt, now)).toBe(true);
    expect(isDueForReview("2026-08-12T12:00:00.000Z", now)).toBe(false);
  });

  it("marks only consistently strong cards as mastered", () => {
    expect(getCardLearningState({ mastery: 80, consecutiveSuccesses: 3 })).toBe(
      "mastered",
    );
    expect(getCardLearningState({ mastery: 100, consecutiveSuccesses: 2 })).toBe(
      "learning",
    );
  });
});
