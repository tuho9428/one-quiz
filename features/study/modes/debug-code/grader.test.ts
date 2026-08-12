import { describe, expect, it } from "vitest";

import type { DebugCodeQuestion } from "../../domain/types";
import { deterministicDebugCodeGrader } from "./grader";

const baseQuestion: DebugCodeQuestion = {
  id: "debug-1",
  studySetId: "set-1",
  type: "debug-code",
  task: "identify-bug",
  problemStatement: "What is wrong with this effect?",
  language: "tsx",
  codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
  expectedExplanation:
    "The effect updates the state that it depends on, so it runs again after every update and creates a render loop.",
  concepts: ["React useEffect", "state mutation"],
};

describe("deterministicDebugCodeGrader", () => {
  it("grades an explanation by concepts rather than exact wording", () => {
    const result = deterministicDebugCodeGrader.grade(
      baseQuestion,
      "The useEffect changes state and depends on that state, so it runs repeatedly.",
    );

    expect(result.outcome).toBe("correct");
    expect(result.includedConcepts).toEqual([
      "React useEffect",
      "state mutation",
    ]);
    expect(result.missedConcepts).toEqual([]);
  });

  it("uses expected output for prediction tasks", () => {
    const question: DebugCodeQuestion = {
      ...baseQuestion,
      id: "debug-output",
      task: "predict-output",
      expectedOutput: "2",
    };

    const result = deterministicDebugCodeGrader.grade(question, "2");

    expect(result.outcome).toBe("correct");
    expect(result.expectedAnswer).toBe("2");
    expect(result.expectedExplanation).toBe(baseQuestion.expectedExplanation);
  });

  it("uses expected code for fix and completion tasks", () => {
    const question: DebugCodeQuestion = {
      ...baseQuestion,
      id: "debug-fix",
      task: "fix-code",
      expectedCode: "return sum + item.price;",
      correctedCode: "return sum + item.price;",
    };

    const result = deterministicDebugCodeGrader.grade(
      question,
      "return sum + item.price;",
    );

    expect(result.outcome).toBe("correct");
    expect(result.expectedAnswer).toBe("return sum + item.price;");
  });
});

