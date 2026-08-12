import {
  normalizeAnswer,
  scoreTextAnswerDetailed,
} from "./text-scoring";
import type {
  DebugCodeQuestion,
  GradeResult,
} from "../domain/types";

export interface DebugCodeGradingResult extends GradeResult {
  expectedExplanation: string;
  expectedAnswer: string;
  includedConcepts: string[];
  missedConcepts: string[];
  explanation?: string;
  grader: "deterministic" | "semantic" | "hybrid";
}

export interface DebugCodeAnswerGrader {
  grade(
    question: DebugCodeQuestion,
    submittedAnswer: string,
  ): DebugCodeGradingResult;
}

function expectedAnswerFor(question: DebugCodeQuestion): string {
  if (question.task === "predict-output") {
    return question.expectedOutput ?? question.expectedExplanation;
  }

  if (question.task === "fix-code" || question.task === "complete-code") {
    return question.expectedCode ?? question.correctedCode ?? question.expectedExplanation;
  }

  return question.expectedExplanation;
}

function findIncludedConcepts(
  concepts: string[],
  submittedAnswer: string,
): string[] {
  const normalizedAnswer = normalizeAnswer(submittedAnswer);
  const answerTokens = new Set(normalizedAnswer.split(" ").filter(Boolean));

  return concepts.filter((concept) => {
    const normalizedConcept = normalizeAnswer(concept);
    if (!normalizedConcept) return false;
    if (normalizedAnswer.includes(normalizedConcept)) return true;

    return normalizedConcept
      .split(" ")
      .some((token) => token.length >= 4 && answerTokens.has(token));
  });
}

/**
 * Deterministic baseline grader. A future semantic grader can implement the
 * same interface and add richer explanation or code-equivalence checks.
 */
export const deterministicDebugCodeGrader: DebugCodeAnswerGrader = {
  grade(question, submittedAnswer) {
    const expectedAnswer = expectedAnswerFor(question);
    const result = scoreTextAnswerDetailed(expectedAnswer, submittedAnswer, []);
    const concepts = question.concepts ?? [];
    const includedConcepts = findIncludedConcepts(concepts, submittedAnswer);
    const score =
      includedConcepts.length === concepts.length && concepts.length > 0
        ? Math.max(90, result.score)
        : result.score;

    return {
      outcome: score >= 90 ? "correct" : score >= 60 ? "partial" : "incorrect",
      score,
      expectedExplanation: question.expectedExplanation,
      expectedAnswer,
      includedConcepts,
      missedConcepts: concepts.filter(
        (concept) => !includedConcepts.includes(concept),
      ),
      explanation:
        question.task === "predict-output"
          ? "Compare your prediction with the expected output below."
          : undefined,
      grader: "deterministic",
    };
  },
};
