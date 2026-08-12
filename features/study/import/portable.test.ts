import { describe, expect, it } from "vitest";

import { parsePortableStudyJson, portableItemFromStudyQuestion } from "./portable";

describe("portable study JSON", () => {
  it("distinguishes syntax errors from valid JSON errors", () => {
    expect(parsePortableStudyJson("[{]").syntaxError).toContain("JSON syntax error");
    expect(parsePortableStudyJson("{}").errors[0]?.message).toContain("array");
  });

  it("normalizes omitted type and validates multiple-choice choices", () => {
    const result = parsePortableStudyJson(JSON.stringify([
      { question: "What is React?", answer: "A UI library" },
      { type: "multiple_choice", question: "Which?", answer: "B", choices: ["A", "B"] },
    ]));

    expect(result.validItems).toHaveLength(2);
    expect(result.validItems[0]?.type).toBe("flashcard");
    expect(result.validItems[1]?.type).toBe("multiple-choice");
  });

  it("reports item-level validation errors without discarding valid items", () => {
    const result = parsePortableStudyJson(JSON.stringify([
      { question: "Valid", answer: "Answer" },
      { type: "multiple_choice", question: "Broken", answer: "A", choices: ["B"] },
    ]));

    expect(result.validItems).toHaveLength(1);
    expect(result.errors).toEqual([{ index: 1, message: "multiple_choice requires at least 2 choices" }, { index: 1, message: 'multiple_choice "answer" must match one choice' }]);
  });

  it("exports canonical questions using portable field names", () => {
    const portable = portableItemFromStudyQuestion({
      id: "q-1",
      studySetId: "set-1",
      type: "debug-code",
      task: "identify-bug",
      problemStatement: "What is wrong?",
      language: "jsx",
      codeSnippet: "const value = 1;",
      expectedExplanation: "The value is immutable.",
      concepts: ["React"],
    });

    expect(portable).toEqual(expect.objectContaining({ type: "debug_code", codeSnippet: "const value = 1;" }));
    expect(portable).not.toHaveProperty("id");
    expect(portable).not.toHaveProperty("studySetId");
  });
});
