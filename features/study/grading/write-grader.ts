import { scoreTextAnswerDetailed } from "./text-scoring";
import type { GradeResult, WriteQuestion } from "../domain/types";

export interface WriteGradingResult extends GradeResult {
  expectedAnswer: string;
  includedConcepts: string[];
  missedConcepts: string[];
  explanation?: string;
  grader: "deterministic" | "semantic" | "hybrid";
}

export interface WriteAnswerGrader {
  grade(
    question: WriteQuestion,
    submittedAnswer: string,
  ): WriteGradingResult | Promise<WriteGradingResult>;
}

/**
 * The initial grader is intentionally deterministic. A semantic grader can
 * implement WriteAnswerGrader later, or supplement this result before the
 * attempt is persisted.
 */
export const deterministicWriteGrader: WriteAnswerGrader = {
  grade(question, submittedAnswer) {
    const result = scoreTextAnswerDetailed(
      question.expectedAnswer,
      submittedAnswer,
      question.importantKeywords,
    );

    return {
      ...result,
      expectedAnswer: question.expectedAnswer,
      explanation: question.explanation,
      grader: "deterministic",
    };
  },
};
