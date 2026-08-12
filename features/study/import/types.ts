import type { StudyQuestion } from "../domain/types";

export type ImportedQuestionType = StudyQuestion["type"];

export interface ImportDraftCard {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
  choices?: string[];
  tags: string[];
  type: ImportedQuestionType;
  isCode: boolean;
  codeSnippet?: string;
  language?: string;
  sourceText: string;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface UnparsedImportSection {
  id: string;
  content: string;
  reason: string;
}

export interface ImportParseResult {
  draftCards: ImportDraftCard[];
  unparsedSections: UnparsedImportSection[];
  recognizedCount: number;
  needsReviewCount: number;
}
