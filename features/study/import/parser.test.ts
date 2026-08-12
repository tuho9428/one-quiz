import { describe, expect, it } from "vitest";

import { parseStudyMaterial } from "./parser";

describe("parseStudyMaterial", () => {
  it("parses Question and Answer labels with multiline content", () => {
    const result = parseStudyMaterial(`Question: What is retrieval practice?\nAnswer: Actively recalling an answer before checking it.`);

    expect(result.recognizedCount).toBe(1);
    expect(result.draftCards[0]).toMatchObject({
      question: "What is retrieval practice?",
      answer: "Actively recalling an answer before checking it.",
      type: "flashcard",
    });
  });

  it("parses Q and A Markdown blocks and captures tags", () => {
    const result = parseStudyMaterial(`Q: What does useEffect do?\nA: It synchronizes a component with an external system.\nTags: React, Effects`);

    expect(result.draftCards[0].tags).toEqual(["React", "Effects"]);
    expect(result.draftCards[0].answer).toContain("external system");
  });

  it("turns headings followed by explanations into cards", () => {
    const result = parseStudyMaterial(`## Spaced repetition\n\nIt schedules retrieval across increasing intervals.\n\n## Retrieval practice\n\nIt asks you to recall before rereading.`);

    expect(result.draftCards).toHaveLength(2);
    expect(result.draftCards[0].question).toBe("Spaced repetition");
    expect(result.draftCards[1].answer).toContain("recall");
  });

  it("parses numbered interview questions", () => {
    const result = parseStudyMaterial(`1. What is a closure?\nA function that retains access to its lexical scope.\n\n2. What is a promise?\nAn object representing a future result.`);

    expect(result.draftCards).toHaveLength(2);
    expect(result.draftCards[0].question).toContain("closure");
    expect(result.draftCards[1].answer).toContain("future result");
  });

  it("recognizes definitions and fenced code blocks as code cards", () => {
    const result = parseStudyMaterial(`**Reconciliation**: The process of comparing a new tree with the previous tree.\n\n### Effect example\n\n\`\`\`tsx\nuseEffect(() => setCount(count + 1), [count]);\n\`\`\``);

    expect(result.draftCards).toHaveLength(2);
    expect(result.draftCards[0].question).toContain("Reconciliation");
    expect(result.draftCards[1]).toMatchObject({
      isCode: true,
      type: "debug-code",
      language: "tsx",
    });
    expect(result.draftCards[1].needsReview).toBe(true);
  });

  it("preserves content that could not be recognized", () => {
    const result = parseStudyMaterial("A loose paragraph with no clear study structure.");

    expect(result.draftCards).toHaveLength(0);
    expect(result.unparsedSections[0].content).toContain("loose paragraph");
    expect(result.needsReviewCount).toBe(1);
  });
});

