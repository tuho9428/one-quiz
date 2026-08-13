import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ pool: {} }));
import { mapStudyItemRowToQuestion, type StudyItemRow } from "./repository";

function row(overrides: Partial<StudyItemRow> = {}): StudyItemRow {
  return {
    id: "item-1",
    study_set_id: "set-1",
    type: "write",
    task: "identify-bug",
    question: "What is wrong with this effect?",
    answer: "The effect creates an update loop.",
    explanation: null,
    code_snippet: "useEffect(() => setCount(count + 1), [count]);",
    language: "jsx",
    position: 0,
    options: [],
    tags: ["React", "Effects"],
    ...overrides,
  };
}

describe("study item database mapping", () => {
  it("preserves code context for legacy write items", () => {
    expect(mapStudyItemRowToQuestion(row())).toMatchObject({
      type: "write",
      question: "What is wrong with this effect?",
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "jsx",
      task: "identify-bug",
    });
  });

  it("preserves code context for multiple-choice items", () => {
    expect(mapStudyItemRowToQuestion(row({
      type: "multiple-choice",
      options: [
        { text: "The effect loops", isCorrect: true },
        { text: "Effects cannot update state", isCorrect: false },
        { text: "JSX cannot use hooks", isCorrect: false },
        { text: "The dependency array must be empty", isCorrect: false },
      ],
      answer: "The effect loops",
    }))).toMatchObject({
      type: "multiple-choice",
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "jsx",
      task: "identify-bug",
    });
  });

  it("does not reinterpret a prose explanation as corrected code", () => {
    expect(mapStudyItemRowToQuestion(row({
      type: "debug-code",
      explanation: "count changes → effect runs → setCount changes count → effect runs again.",
    }))).toMatchObject({
      type: "debug-code",
      expectedExplanation: "The effect creates an update loop.",
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
    });
    expect(mapStudyItemRowToQuestion(row({ type: "debug-code", explanation: "A prose explanation" }))).not.toHaveProperty("correctedCode");
  });
});
