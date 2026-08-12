import type { StudyQuestion } from "../../domain/types";
import { sampleFlashcards } from "../flashcards/sample-cards";
import { sampleMultipleChoiceQuestions } from "../multiple-choice/sample-questions";
import { sampleWriteQuestions } from "../write/sample-questions";

const sampleDebugQuestion: StudyQuestion = {
  id: "debug-1",
  studySetId: "active-recall-foundations",
  type: "debug-code",
  task: "identify-bug",
  language: "typescript",
  concepts: ["Debugging"],
  problemStatement: "Why does this function return the wrong total?",
  codeSnippet: `function total(items) {
  return items.reduce((sum, item) => item.price, 0);
}`,
  expectedExplanation:
    "The reducer returns the current price instead of adding it to the running sum. It should return sum plus item.price.",
  correctedCode: `function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`,
};

export const sampleSmartStudyQuestions: StudyQuestion[] = [
  ...sampleMultipleChoiceQuestions,
  ...sampleFlashcards,
  ...sampleWriteQuestions,
  sampleDebugQuestion,
];
