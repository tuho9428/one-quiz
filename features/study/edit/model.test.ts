import { describe, expect, it } from "vitest";

import { editableItemFromQuestion, portableItemFromEditable } from "./model";

describe("study item editor model", () => {
  it("round-trips legacy type, tags, choices, and code context", () => {
    const editable = editableItemFromQuestion({
      id: "item-1",
      studySetId: "set-1",
      type: "write",
      question: "What is wrong with this effect?",
      expectedAnswer: "It creates an update loop.",
      importantKeywords: ["Effects"],
      concepts: ["React", "Effects"],
      explanation: "The dependency changes after the state update.",
      choices: ["It creates an update loop.", "Nothing", "The hook is missing"],
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "jsx",
      task: "identify-bug",
    });

    expect(editable.type).toBe("write");
    expect(editable.choices).toContain("Nothing");
    expect(portableItemFromEditable(editable)).toEqual(expect.objectContaining({
      type: "write",
      choices: ["It creates an update loop.", "Nothing", "The hook is missing"],
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "jsx",
      task: "identify-bug",
    }));
  });

  it("does not save empty optional fields", () => {
    expect(portableItemFromEditable({
      type: "flashcard",
      question: "Question",
      answer: "Answer",
      explanation: "  ",
      tags: "React, , Hooks",
      choices: "\n",
      codeSnippet: "",
      language: "  ",
      task: "",
    })).toEqual({
      type: "flashcard",
      question: "Question",
      answer: "Answer",
      explanation: undefined,
      tags: ["React", "Hooks"],
      choices: undefined,
      codeSnippet: undefined,
      language: undefined,
      task: undefined,
    });
  });
});
