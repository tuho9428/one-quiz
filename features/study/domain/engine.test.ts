import { describe, expect, it } from "vitest";

import {
  createInitialLearningStats,
  createFlashcardAttempt,
  createStudyAttempt,
  gradeFlashcardRating,
  gradeQuestion,
  normalizeAnswer,
  scoreTextAnswer,
  updateLearningStats,
} from "./engine";
import type {
  FlashcardQuestion,
  MultipleChoiceQuestion,
  WriteQuestion,
} from "./types";

const flashcard: FlashcardQuestion = {
  id: "card-1",
  studySetId: "set-1",
  type: "flashcard",
  prompt: "What is retrieval practice?",
  answer: "Actively recalling information",
  explanation: "It strengthens the ability to retrieve knowledge.",
};

const multipleChoice: MultipleChoiceQuestion = {
  id: "card-2",
  studySetId: "set-1",
  type: "multiple-choice",
  question: "Which process strengthens recall?",
  correctAnswer: "Retrieval practice",
  distractors: ["Passive rereading", "Highlighting"],
};

const writeQuestion: WriteQuestion = {
  id: "card-3",
  studySetId: "set-1",
  type: "write",
  question: "Explain retrieval practice.",
  expectedAnswer: "Actively recalling information",
  importantKeywords: ["actively", "recalling"],
};

describe("study grading", () => {
  it("normalizes casing, punctuation, and whitespace", () => {
    expect(normalizeAnswer("  Recall,   Information! ")).toBe(
      "recall information",
    );
  });

  it("grades flashcards and multiple choice through the same interface", () => {
    expect(gradeQuestion(flashcard, "actively recalling information")).toEqual({
      outcome: "correct",
      score: 100,
    });
    expect(gradeQuestion(multipleChoice, "Passive rereading")).toEqual({
      outcome: "incorrect",
      score: 0,
    });
  });

  it("turns flashcard ratings into shared grading outcomes", () => {
    expect(gradeFlashcardRating("again")).toEqual({
      outcome: "incorrect",
      score: 0,
    });
    expect(gradeFlashcardRating("hard")).toEqual({
      outcome: "partial",
      score: 45,
    });
    expect(gradeFlashcardRating("good")).toEqual({
      outcome: "correct",
      score: 80,
    });
    expect(gradeFlashcardRating("easy")).toEqual({
      outcome: "correct",
      score: 100,
    });
  });

  it("supports partial write answers using important keywords", () => {
    const result = scoreTextAnswer(
      writeQuestion.expectedAnswer,
      "recalling information",
      writeQuestion.importantKeywords,
    );

    expect(result.outcome).toBe("partial");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("creates a normalized attempt with mode and grading data", () => {
    expect(
      createStudyAttempt({
        id: "attempt-1",
        question: flashcard,
        userAnswer: "Actively recalling information",
        responseTimeMs: 1250,
        timestamp: "2026-08-11T12:00:00.000Z",
      }),
    ).toEqual({
      id: "attempt-1",
      questionId: "card-1",
      studySetId: "set-1",
      mode: "flashcard",
      userAnswer: "Actively recalling information",
      outcome: "correct",
      score: 100,
      responseTimeMs: 1250,
      timestamp: "2026-08-11T12:00:00.000Z",
    });
  });
});

describe("learning stats", () => {
  it("updates counts, mastery, streak, and review date", () => {
    const stats = createInitialLearningStats("card-1", "set-1");
    const attempt = createStudyAttempt({
      id: "attempt-1",
      question: flashcard,
      userAnswer: "Actively recalling information",
      timestamp: "2026-08-11T12:00:00.000Z",
    });

    expect(updateLearningStats(stats, attempt)).toEqual({
      questionId: "card-1",
      studySetId: "set-1",
      timesSeen: 1,
      timesCorrect: 1,
      timesIncorrect: 0,
      mastery: 10,
      lastReviewedAt: "2026-08-11T12:00:00.000Z",
      nextReviewAt: "2026-08-12T12:00:00.000Z",
      reviewInterval: 1,
      consecutiveSuccesses: 1,
    });
  });

  it("resets the streak and treats partial answers as not fully correct", () => {
    const stats = {
      ...createInitialLearningStats("card-3", "set-1"),
      timesSeen: 2,
      timesCorrect: 2,
      mastery: 20,
      consecutiveSuccesses: 2,
    };
    const attempt = createStudyAttempt({
      id: "attempt-2",
      question: writeQuestion,
      userAnswer: "recalling information",
      timestamp: "2026-08-11T12:00:00.000Z",
    });

    const updated = updateLearningStats(stats, attempt);

    expect(updated.timesSeen).toBe(3);
    expect(updated.timesCorrect).toBe(2);
    expect(updated.timesIncorrect).toBe(1);
    expect(updated.mastery).toBe(25);
    expect(updated.consecutiveSuccesses).toBe(0);
    expect(updated.nextReviewAt).toBe("2026-08-12T12:00:00.000Z");
    expect(updated.reviewInterval).toBe(1);
  });

  it("uses flashcard ratings to update mastery and review scheduling", () => {
    const stats = createInitialLearningStats("card-1", "set-1");
    const attempt = createFlashcardAttempt({
      id: "attempt-hard",
      question: flashcard,
      rating: "hard",
      timestamp: "2026-08-11T12:00:00.000Z",
    });

    const updated = updateLearningStats(stats, attempt);

    expect(updated.mastery).toBe(2);
    expect(updated.timesCorrect).toBe(0);
    expect(updated.timesIncorrect).toBe(1);
    expect(updated.consecutiveSuccesses).toBe(0);
    expect(updated.nextReviewAt).toBe("2026-08-12T12:00:00.000Z");
    expect(updated.reviewInterval).toBe(1);
  });
});
