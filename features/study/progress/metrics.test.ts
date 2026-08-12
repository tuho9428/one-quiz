import { describe, expect, it } from "vitest";

import { createInitialLearningStats } from "../domain/engine";
import type { StudyAttempt, StudyQuestion, StudySet } from "../domain/types";
import { deriveStudySetProgress } from "./metrics";

const set: StudySet = { id: "set-1", title: "React Hooks" };
const questions: StudyQuestion[] = [
  {
    id: "card-mastered",
    studySetId: set.id,
    type: "flashcard",
    prompt: "What is a hook?",
    answer: "A function",
    concepts: ["Hooks", "Effects"],
  },
  {
    id: "card-weak",
    studySetId: set.id,
    type: "flashcard",
    prompt: "What is reconciliation?",
    answer: "A comparison process",
    concepts: ["Reconciliation"],
  },
];

const now = new Date("2026-08-11T12:00:00.000Z");

function stats(questionId: string, mastery: number, nextReviewAt: string | null) {
  return {
    ...createInitialLearningStats(questionId, set.id),
    mastery,
    consecutiveSuccesses: mastery >= 80 ? 3 : 0,
    nextReviewAt,
  };
}

function attempt(
  id: string,
  outcome: StudyAttempt["outcome"],
  timestamp: string,
  responseTimeMs: number,
): StudyAttempt {
  return {
    id,
    questionId: id === "attempt-1" ? "card-mastered" : "card-weak",
    studySetId: set.id,
    mode: "flashcard",
    userAnswer: "answer",
    outcome,
    score: outcome === "correct" ? 100 : 0,
    responseTimeMs,
    timestamp,
  };
}

describe("deriveStudySetProgress", () => {
  it("derives decision-useful card and attempt metrics", () => {
    const progress = deriveStudySetProgress(
      {
        set,
        questions,
        statsByQuestion: {
          "card-mastered": stats("card-mastered", 92, "2026-08-15T12:00:00.000Z"),
          "card-weak": stats("card-weak", 28, "2026-08-10T12:00:00.000Z"),
        },
        attempts: [
          attempt("attempt-1", "correct", "2026-08-09T12:00:00.000Z", 1200),
          attempt("attempt-2", "incorrect", "2026-08-10T12:00:00.000Z", 800),
          attempt("attempt-3", "incorrect", "2026-08-11T12:00:00.000Z", 600),
        ],
      },
      now,
    );

    expect(progress.overallMastery).toBe(60);
    expect(progress.cardsMastered).toBe(1);
    expect(progress.cardsLearning).toBe(1);
    expect(progress.weakCards).toBe(1);
    expect(progress.cardsDueToday).toBe(1);
    expect(progress.totalStudyTimeMs).toBe(2600);
    expect(progress.questionsAnswered).toBe(3);
    expect(progress.accuracy).toBe(33);
    expect(progress.currentStudyStreak).toBe(3);
    expect(progress.weakestConcept?.concept).toBe("Reconciliation");
    expect(progress.recommendedActions[0].label).toBe("1 cards need review");
  });

  it("averages mastery across tagged cards and ignores other study sets", () => {
    const progress = deriveStudySetProgress(
      {
        set,
        questions,
        statsByQuestion: {
          "card-mastered": stats("card-mastered", 80, null),
          "card-weak": stats("card-weak", 20, null),
        },
        attempts: [
          {
            ...attempt("attempt-1", "correct", "2026-08-11T12:00:00.000Z", 500),
            studySetId: "other-set",
          },
        ],
      },
      now,
    );

    expect(progress.conceptMastery).toEqual([
      { concept: "Reconciliation", mastery: 20, cardCount: 1 },
      { concept: "Effects", mastery: 80, cardCount: 1 },
      { concept: "Hooks", mastery: 80, cardCount: 1 },
    ]);
    expect(progress.questionsAnswered).toBe(0);
  });
});
