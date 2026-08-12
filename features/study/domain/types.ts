export type StudyMode =
  | "flashcard"
  | "multiple-choice"
  | "write"
  | "rapid-recall"
  | "debug-code";

export type FlashcardRating = "again" | "hard" | "good" | "easy";

export type AttemptOutcome = "correct" | "incorrect" | "partial";
export type GraderType = "deterministic" | "semantic" | "hybrid";

export interface StudySet {
  id: string;
  title: string;
  description?: string;
}

interface BaseStudyQuestion {
  id: string;
  studySetId: string;
  concepts?: string[];
}

export interface FlashcardQuestion extends BaseStudyQuestion {
  type: "flashcard";
  prompt: string;
  answer: string;
  explanation?: string;
}

export interface MultipleChoiceQuestion extends BaseStudyQuestion {
  type: "multiple-choice";
  question: string;
  correctAnswer: string;
  distractors: string[];
  explanation?: string;
}

export interface WriteQuestion extends BaseStudyQuestion {
  type: "write";
  question: string;
  expectedAnswer: string;
  importantKeywords: string[];
  explanation?: string;
}

export type DebugCodeTask =
  | "identify-bug"
  | "explain-behavior"
  | "predict-output"
  | "fix-code"
  | "complete-code";

export interface DebugCodeQuestion extends BaseStudyQuestion {
  type: "debug-code";
  task: DebugCodeTask;
  problemStatement: string;
  language: string;
  codeSnippet: string;
  expectedExplanation: string;
  expectedOutput?: string;
  expectedCode?: string;
  correctedCode?: string;
}

export type StudyQuestion =
  | FlashcardQuestion
  | MultipleChoiceQuestion
  | WriteQuestion
  | DebugCodeQuestion;

export interface StudyAttempt {
  id: string;
  questionId: string;
  studySetId: string;
  mode: StudyMode;
  userAnswer: string;
  outcome: AttemptOutcome;
  skipped?: boolean;
  conceptsIncluded?: string[];
  conceptsMissed?: string[];
  grader?: GraderType;
  rating?: FlashcardRating;
  score?: number;
  responseTimeMs?: number;
  timestamp: string;
}

export interface CardLearningStats {
  questionId: string;
  studySetId: string;
  timesSeen: number;
  timesCorrect: number;
  /** Counts incorrect and partial attempts because neither is fully correct. */
  timesIncorrect: number;
  mastery: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewInterval: number;
  consecutiveSuccesses: number;
}

export interface GradeResult {
  outcome: AttemptOutcome;
  score: number;
}
