import { describe, expect, it } from "vitest";

import { createFlashcardAttempt } from "../domain/engine";
import type { FlashcardQuestion } from "../domain/types";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  getStatsForQuestion,
} from "./recording";

const question: FlashcardQuestion = {
  id: "card-1",
  studySetId: "set-1",
  type: "flashcard",
  prompt: "What is retrieval practice?",
  answer: "Recalling information from memory",
};

describe("study session recording", () => {
  it("creates initial stats for every question", () => {
    const stats = createStatsForQuestions([question]);

    expect(stats[question.id]).toMatchObject({
      questionId: question.id,
      studySetId: question.studySetId,
      timesSeen: 0,
      mastery: 0,
    });
  });

  it("applies an attempt immutably through the shared learning engine", () => {
    const initial = createStatsForQuestions([question]);
    const attempt = createFlashcardAttempt({
      id: "attempt-1",
      question,
      rating: "good",
      timestamp: "2026-08-11T12:00:00.000Z",
    });
    const next = applyAttemptToStats(initial, attempt);

    expect(initial[question.id].timesSeen).toBe(0);
    expect(next[question.id]).toMatchObject({
      timesSeen: 1,
      timesCorrect: 1,
      mastery: 8,
    });
  });

  it("provides safe initial stats for a question missing from the map", () => {
    const stats = getStatsForQuestion({}, question);

    expect(stats).toMatchObject({
      questionId: question.id,
      studySetId: question.studySetId,
      timesSeen: 0,
    });
  });
});
