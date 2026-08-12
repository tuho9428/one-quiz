import { describe, expect, it } from "vitest";

import { prepareMultipleChoiceSession } from "./session";
import type { MultipleChoiceQuestion } from "../../domain/types";

const questions: MultipleChoiceQuestion[] = [
  {
    id: "question-1",
    studySetId: "set-1",
    type: "multiple-choice",
    question: "Which method requires retrieval?",
    correctAnswer: "Self-testing",
    distractors: ["Rereading", "Highlighting", "Copying"],
  },
  {
    id: "question-2",
    studySetId: "set-1",
    type: "multiple-choice",
    question: "Which schedule spaces reviews?",
    correctAnswer: "Spaced repetition",
    distractors: ["Cramming", "Skimming", "Transcribing"],
  },
];

describe("prepareMultipleChoiceSession", () => {
  it("creates four options and randomizes their order", () => {
    const session = prepareMultipleChoiceSession(questions, () => 0);
    const firstQuestion = session.find(
      ({ question }) => question.id === "question-1",
    );

    expect(session).toHaveLength(2);
    expect(firstQuestion?.options).toHaveLength(4);
    expect(firstQuestion?.options.map((option) => option.text)).not.toEqual([
      "Self-testing",
      "Rereading",
      "Highlighting",
      "Copying",
    ]);
    expect(firstQuestion?.options.map((option) => option.text)).toEqual(
      expect.arrayContaining([
        "Self-testing",
        "Rereading",
        "Highlighting",
        "Copying",
      ]),
    );
  });

  it("rejects questions that do not have at least two answers", () => {
    expect(() =>
      prepareMultipleChoiceSession([
        { ...questions[0], distractors: [] },
      ]),
    ).toThrow("must have at least 2 answers");
  });
});
