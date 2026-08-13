import { describe, expect, it } from "vitest";

import { createInitialLearningStats } from "../../domain/engine";
import type { StudyAttempt, StudyQuestion } from "../../domain/types";
import {
  getNextDifficultyLevel,
  getPriorityBucket,
  getPreferredMode,
  selectNextSmartQuestion,
} from "./selection";

const now = new Date("2026-08-11T12:00:00.000Z");

const multipleChoice: StudyQuestion = {
  id: "mc-1",
  studySetId: "set-1",
  type: "multiple-choice",
  question: "Which answer is correct?",
  correctAnswer: "Correct",
  distractors: ["No", "Not this", "Also no"],
};

const flashcard: StudyQuestion = {
  id: "flash-1",
  studySetId: "set-1",
  type: "flashcard",
  prompt: "What is the answer?",
  answer: "The answer",
};

const write: StudyQuestion = {
  id: "write-1",
  studySetId: "set-1",
  type: "write",
  question: "Explain the idea.",
  expectedAnswer: "The idea",
  importantKeywords: ["idea"],
};

const codeQuestion: StudyQuestion = {
  id: "code-1",
  studySetId: "set-1",
  type: "debug-code",
  task: "identify-bug",
  problemStatement: "What is wrong with this effect?",
  language: "jsx",
  codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
  expectedExplanation: "The effect creates an update loop.",
  concepts: ["React", "Effects"],
};

function candidate(question: StudyQuestion, mastery = 0) {
  return {
    question,
    stats: { ...createInitialLearningStats(question.id, question.studySetId), mastery },
  };
}

describe("Smart Study selection", () => {
  it("prioritizes the weighted weak and due bucket while avoiding immediate repeats", () => {
    const selected = selectNextSmartQuestion(
      [candidate(multipleChoice), candidate(flashcard, 90)],
      {
        now,
        previousQuestionId: "flash-1",
        targetLevel: 1,
        recentAttempts: [],
        recentModes: [],
      },
      () => 0,
    );

    expect(selected?.question.id).toBe("mc-1");
    expect(getPriorityBucket(candidate(multipleChoice), [], now)).toBe("weak-due");
  });

  it("boosts a missed concept without forcing an immediate repeat", () => {
    const attempt: StudyAttempt = {
      id: "attempt-1",
      questionId: "mc-1",
      studySetId: "set-1",
      mode: "multiple-choice",
      userAnswer: "Wrong",
      outcome: "incorrect",
      conceptsMissed: ["Retrieval practice"],
      timestamp: now.toISOString(),
    };
    const related: StudyQuestion = {
      ...flashcard,
      id: "flash-2",
      concepts: ["Retrieval practice"],
    };
    const selected = selectNextSmartQuestion(
      [candidate(multipleChoice), candidate(related, 70)],
      {
        now,
        previousQuestionId: "mc-1",
        targetLevel: 2,
        recentAttempts: [attempt],
        recentModes: ["multiple-choice"],
      },
      () => 0,
    );

    expect(selected?.question.id).toBe("flash-2");
  });

  it("maps the progression to easier and harder study modes", () => {
    expect(getPreferredMode(multipleChoice, 1)).toBe("multiple-choice");
    expect(getPreferredMode(flashcard, 2)).toBe("flashcard");
    expect(getPreferredMode(write, 3)).toBe("write");
    expect(getPreferredMode(write, 2)).toBe("rapid-recall");
  });

  it("keeps code context eligible for both write and multiple choice progression", () => {
    const codeDistractors: StudyQuestion[] = [
      codeQuestion,
      { ...write, id: "code-2", question: "Code question two", expectedAnswer: "The dependency is stale.", concepts: ["React", "Effects"], codeSnippet: "useEffect(() => {}, []);", task: "identify-bug" },
      { ...write, id: "code-3", question: "Code question three", expectedAnswer: "The callback runs once.", concepts: ["React", "Effects"], codeSnippet: "useEffect(() => {}, []);", task: "identify-bug" },
      { ...write, id: "code-4", question: "Code question four", expectedAnswer: "The state update is batched.", concepts: ["React", "Effects"], codeSnippet: "useEffect(() => {}, []);", task: "identify-bug" },
    ];

    expect(getPreferredMode(codeQuestion, 1, [], codeDistractors)).toBe("multiple-choice");
    expect(getPreferredMode(codeQuestion, 3, [], codeDistractors)).toBe("write");
  });

  it("adapts the next level to performance", () => {
    expect(getNextDifficultyLevel(1, "correct")).toBe(2);
    expect(getNextDifficultyLevel(3, "partial")).toBe(3);
    expect(getNextDifficultyLevel(3, "incorrect")).toBe(2);
  });
});
