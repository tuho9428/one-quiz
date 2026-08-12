import { describe, expect, it } from "vitest";

import { buildMultipleChoiceOptions, canStudyItemInMode, canUseInMultipleChoice, getEligibleModes, getMultipleChoiceDiagnostics, toFlashcardQuestion, toMultipleChoiceQuestion, toWriteQuestion } from "./eligibility";
import type { StudyQuestion } from "./types";

const write: StudyQuestion = {
  id: "write-1", studySetId: "set-1", type: "write", question: "Why?", expectedAnswer: "Because.", importantKeywords: [],
};
const debug: StudyQuestion = {
  id: "debug-1", studySetId: "set-1", type: "debug-code", task: "identify-bug", problemStatement: "Find it", language: "tsx", codeSnippet: "const x = 1;", expectedExplanation: "The issue.",
};
const writeWithCode: StudyQuestion = {
  ...write,
  id: "write-code-1",
  codeSnippet: "const answer = 42;",
  language: "javascript",
  task: "explain-behavior",
};
const multipleChoice: StudyQuestion = {
  id: "mc-1", studySetId: "set-1", type: "multiple-choice", question: "Pick", correctAnswer: "A", distractors: ["B", "C"],
};

describe("study mode eligibility", () => {
  it("reuses write content in general recall modes", () => {
    expect(canStudyItemInMode(write, "flashcard")).toBe(true);
    expect(canStudyItemInMode(write, "write")).toBe(true);
    expect(canStudyItemInMode(write, "rapid-recall")).toBe(true);
    expect(getEligibleModes(write)).not.toContain("multiple-choice");
  });

  it("makes code content available to recall and debug presentations", () => {
    expect(getEligibleModes(debug)).toEqual(expect.arrayContaining(["flashcard", "write", "rapid-recall", "debug-code"]));
    expect(toFlashcardQuestion(debug).prompt).toContain("const x = 1;");
    expect(toWriteQuestion(debug).expectedAnswer).toBe("The issue.");
    expect(getEligibleModes(writeWithCode)).toContain("debug-code");
    expect(toFlashcardQuestion(writeWithCode).prompt).toContain("const answer = 42;");
  });

  it("requires valid choices or enough candidates for multiple choice", () => {
    expect(canStudyItemInMode(multipleChoice, "multiple-choice")).toBe(true);
    expect(canStudyItemInMode(write, "multiple-choice")).toBe(false);
    expect(getEligibleModes(multipleChoice)).toContain("multiple-choice");
  });

  it("generates focused distractors for normal question and answer items", () => {
    const target: StudyQuestion = {
      ...write,
      id: "ref",
      question: "Which hook stores a mutable value without causing a render?",
      expectedAnswer: "useRef",
      concepts: ["React", "Hooks"],
    };
    const sameTopic = ["useState", "useMemo", "useEffect"].map((answer, index) => ({
      ...write,
      id: `hook-${index}`,
      question: `Which React hook is answer ${index}?`,
      expectedAnswer: answer,
      concepts: ["React", "Hooks"],
    } satisfies StudyQuestion));
    const unrelated = [
      { ...write, id: "array", question: "What does Array.sort do?", expectedAnswer: "Array.sort mutates arrays", concepts: ["JavaScript", "Arrays"] },
      { ...write, id: "abort", question: "What does AbortController do?", expectedAnswer: "AbortController cancels requests", concepts: ["Web APIs"] },
    ] satisfies StudyQuestion[];
    const allItems = [target, ...sameTopic, ...unrelated];

    expect(canUseInMultipleChoice(target, allItems)).toBe(true);
    expect(buildMultipleChoiceOptions(target, allItems, () => 0.2)).toEqual(
      expect.arrayContaining(["useRef", "useState", "useMemo", "useEffect"]),
    );
    expect(buildMultipleChoiceOptions(target, allItems, () => 0.2)).not.toEqual(
      expect.arrayContaining(["Array.sort mutates arrays", "AbortController cancels requests"]),
    );
    expect(toMultipleChoiceQuestion(target, allItems, () => 0.2)?.distractors).toHaveLength(3);
  });

  it("does not enable generated multiple choice without three suitable distractors", () => {
    const target: StudyQuestion = { ...write, id: "target", expectedAnswer: "useRef", concepts: ["React"] };
    const onlyRelated: StudyQuestion[] = [
      { ...write, id: "one", expectedAnswer: "useState", concepts: ["React"] },
      { ...write, id: "two", expectedAnswer: "useMemo", concepts: ["React"] },
    ];

    expect(canUseInMultipleChoice(target, [target, ...onlyRelated])).toBe(false);
    expect(buildMultipleChoiceOptions(target, [target, ...onlyRelated])).toBeNull();
  });

  it("keeps explicit choices ahead of generated candidates", () => {
    const item: StudyQuestion = {
      ...write,
      id: "explicit",
      expectedAnswer: "useRef",
      choices: ["useRef", "useState", "useMemo", "useEffect"],
    };
    const options = buildMultipleChoiceOptions(item, [
      item,
      { ...write, id: "other", expectedAnswer: "unrelated answer" },
    ]);

    expect(options).toEqual(["useRef", "useState", "useMemo", "useEffect"]);
  });

  it("excludes debug code tasks from generated multiple choice", () => {
    const debugItem: StudyQuestion = {
      id: "debug-target",
      studySetId: "set-1",
      type: "debug-code",
      task: "identify-bug",
      problemStatement: "What does this stale closure return?",
      language: "tsx",
      codeSnippet: "useEffect(() => console.log(count), []);",
      expectedExplanation: "The callback closes over the initial count because the effect does not update.",
      concepts: ["React", "Effects", "Closures"],
    };
    const candidates = [
      "The effect cleanup runs before every render and resets state.",
      "The callback closes over the latest count because the dependency updates.",
      "The component cannot render because useEffect only accepts code strings.",
    ].map((expectedAnswer, index) => ({
      ...write,
      id: `normal-candidate-${index}`,
      question: `Related explanation ${index}`,
      expectedAnswer,
    } satisfies StudyQuestion));

    const report = getMultipleChoiceDiagnostics([debugItem, ...candidates]);
    expect(report.debugCode.totalItems).toBe(1);
    expect(report.debugCode.eligibleItems).toBe(0);
    expect(report.debugCode.examples).toHaveLength(0);
    expect(report.debugCode.rejectedItems[0]?.rejectionReason).toBe("code task without explicit choices");
  });

  it("allows debug code items with explicit valid choices", () => {
    const item: StudyQuestion = {
      ...debug,
      choices: ["The stale closure", "A syntax error", "A network failure", "A missing key"],
      expectedExplanation: "The stale closure",
    };

    const report = getMultipleChoiceDiagnostics([item]);
    expect(report.debugCode.eligibleItems).toBe(1);
    expect(report.debugCode.eligibleItems).toBe(report.eligibleDebugCodeWithExplicitChoices);
    expect(buildMultipleChoiceOptions(item, [item])).toEqual(item.choices);
  });

  it("reports debug code rejection by candidate quality, never by source type", () => {
    const report = getMultipleChoiceDiagnostics([debug]);
    expect(report.debugCode.totalItems).toBe(1);
    expect(report.debugCode.eligibleItems).toBe(0);
    expect(report.debugCode.rejectedItems[0]?.rejectionReason).not.toBe("debug_code");
    expect(report.debugCode.rejectedItems[0]?.rejectionReason).toBe("code task without explicit choices");
  });
});
