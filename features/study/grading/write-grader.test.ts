import { describe, expect, it } from "vitest";

import { deterministicWriteGrader } from "./write-grader";
import type { WriteQuestion } from "../domain/types";

const question: WriteQuestion = {
  id: "write-1",
  studySetId: "set-1",
  type: "write",
  question: "Explain retrieval practice.",
  expectedAnswer:
    "Retrieval practice is actively recalling information from memory.",
  importantKeywords: ["actively recalling", "memory"],
  explanation: "The learner has to produce the answer before checking it.",
};

describe("deterministicWriteGrader", () => {
  it("accepts different wording when the important concepts are present", async () => {
    const result = await deterministicWriteGrader.grade(
      question,
      "Actively recalling information from memory is the process.",
    );

    expect(result.outcome).toBe("correct");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.includedConcepts).toEqual(["actively recalling", "memory"]);
    expect(result.missedConcepts).toEqual([]);
  });

  it("returns partial credit when only some concepts are demonstrated", async () => {
    const result = await deterministicWriteGrader.grade(
      question,
      "Retrieval practice is actively recalling information.",
    );

    expect(result.outcome).toBe("partial");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(90);
    expect(result.includedConcepts).toEqual(["actively recalling"]);
    expect(result.missedConcepts).toEqual(["memory"]);
  });

  it("returns incorrect when the response does not demonstrate the concept", async () => {
    const result = await deterministicWriteGrader.grade(
      question,
      "I would reread the chapter.",
    );

    expect(result.outcome).toBe("incorrect");
    expect(result.score).toBeLessThan(60);
    expect(result.missedConcepts).toEqual(["actively recalling", "memory"]);
  });
});
