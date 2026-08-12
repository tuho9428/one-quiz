import {
  createFlashcardAttempt,
  createStudyAttempt,
} from "../domain/engine";
import type {
  FlashcardQuestion,
  StudyAttempt,
  StudyQuestion,
  StudySet,
} from "../domain/types";
import { sampleFlashcards } from "../modes/flashcards/sample-cards";
import { sampleMultipleChoiceQuestions } from "../modes/multiple-choice/sample-questions";
import { sampleWriteQuestions } from "../modes/write/sample-questions";
import { sampleDebugCodeQuestions } from "../modes/debug-code/sample-questions";
import type { StudySetProgressInput } from "./metrics";
import {
  applyAttemptToStats,
  createStatsForQuestions,
} from "../session/recording";

function timestampDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

interface SeedAction {
  question: StudyQuestion;
  answer: string;
  timestamp: string;
  responseTimeMs: number;
  rating?: "again" | "hard" | "good" | "easy";
}

function buildProgress(
  set: StudySet,
  questions: StudyQuestion[],
  actions: SeedAction[],
): StudySetProgressInput {
  let statsByQuestion = createStatsForQuestions(questions);
  const attempts: StudyAttempt[] = [];

  for (const action of actions) {
    const attempt = action.rating && action.question.type === "flashcard"
      ? createFlashcardAttempt({
          id: `sample-${attempts.length + 1}`,
          question: action.question as FlashcardQuestion,
          rating: action.rating,
          responseTimeMs: action.responseTimeMs,
          timestamp: action.timestamp,
        })
      : createStudyAttempt({
          id: `sample-${attempts.length + 1}`,
          question: action.question,
          userAnswer: action.answer,
          responseTimeMs: action.responseTimeMs,
          timestamp: action.timestamp,
        });

    attempts.push(attempt);
    statsByQuestion = applyAttemptToStats(statsByQuestion, attempt);
  }

  return { set, questions, statsByQuestion, attempts };
}

function flashcardActions(question: FlashcardQuestion): SeedAction[] {
  return [
    5, 4, 3, 2, 1, 0,
  ].map((daysAgo, index) => ({
    question,
    answer: "",
    rating: "easy",
    timestamp: timestampDaysAgo(daysAgo),
    responseTimeMs: 900 + index * 110,
  }));
}

export function createSampleProgressInputs(): StudySetProgressInput[] {
  const activeRecallQuestions: StudyQuestion[] = [
    ...sampleFlashcards,
    ...sampleMultipleChoiceQuestions,
    ...sampleWriteQuestions,
  ];
  const activeRecallSet: StudySet = {
    id: "active-recall-foundations",
    title: "Active recall foundations",
    description: "Retrieval practice, spacing, feedback, and durable learning.",
  };
  const strongCard = sampleFlashcards[0];
  const dueCard = sampleFlashcards[2];
  const mcQuestion = sampleMultipleChoiceQuestions[0];
  const writeQuestion = sampleWriteQuestions[1];

  const activeActions: SeedAction[] = [
    ...flashcardActions(strongCard),
    {
      question: dueCard,
      answer: "",
      rating: "again",
      timestamp: timestampDaysAgo(1),
      responseTimeMs: 2100,
    },
    {
      question: mcQuestion,
      answer: mcQuestion.correctAnswer,
      timestamp: timestampDaysAgo(0),
      responseTimeMs: 1700,
    },
    {
      question: writeQuestion,
      answer: "It schedules repeated retrieval across longer intervals.",
      timestamp: timestampDaysAgo(0),
      responseTimeMs: 6400,
    },
  ];

  const softwareSet: StudySet = {
    id: "software-engineering-foundations",
    title: "Software engineering foundations",
    description: "Debugging, async behavior, TypeScript, and runtime reasoning.",
  };

  const softwareQuestions = sampleDebugCodeQuestions;
  const softwareActions: SeedAction[] = [
    {
      question: softwareQuestions[0],
      answer: "The effect updates state that it depends on, so it creates a render loop.",
      timestamp: timestampDaysAgo(0),
      responseTimeMs: 7800,
    },
    {
      question: softwareQuestions[1],
      answer: "1 followed by 2",
      timestamp: timestampDaysAgo(1),
      responseTimeMs: 3200,
    },
    {
      question: softwareQuestions[2],
      answer: "return items.reduce((sum, item) => sum + item.price, 0);",
      timestamp: timestampDaysAgo(2),
      responseTimeMs: 9200,
    },
    {
      question: softwareQuestions[3],
      answer: "It returns a promise immediately, so done logs before the request resolves.",
      timestamp: timestampDaysAgo(3),
      responseTimeMs: 5400,
    },
  ];

  return [
    buildProgress(activeRecallSet, activeRecallQuestions, activeActions),
    buildProgress(softwareSet, softwareQuestions, softwareActions),
  ];
}
