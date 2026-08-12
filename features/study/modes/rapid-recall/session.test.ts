import { describe, expect, it } from "vitest";

import {
  formatRapidRecallDuration,
  shuffleRapidRecallQuestions,
} from "./session";
import type { WriteQuestion } from "../../domain/types";

const questions: WriteQuestion[] = [
  {
    id: "rapid-1",
    studySetId: "set-1",
    type: "write",
    question: "What is retrieval practice?",
    expectedAnswer: "Actively recalling information.",
    importantKeywords: ["recalling"],
  },
  {
    id: "rapid-2",
    studySetId: "set-1",
    type: "write",
    question: "What is spaced repetition?",
    expectedAnswer: "Reviewing information across increasing intervals.",
    importantKeywords: ["increasing intervals"],
  },
];

describe("Rapid Recall session helpers", () => {
  it("shuffles questions without changing the question set", () => {
    const shuffled = shuffleRapidRecallQuestions(questions, () => 0);

    expect(shuffled.map((question) => question.id)).toEqual([
      "rapid-2",
      "rapid-1",
    ]);
    expect(shuffled).toHaveLength(questions.length);
  });

  it("formats every supported duration", () => {
    expect(formatRapidRecallDuration(30)).toBe("30 seconds");
    expect(formatRapidRecallDuration(60)).toBe("60 seconds");
    expect(formatRapidRecallDuration(120)).toBe("2 minutes");
    expect(formatRapidRecallDuration(300)).toBe("5 minutes");
  });
});
