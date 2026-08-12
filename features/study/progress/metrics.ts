import type {
  CardLearningStats,
  StudyAttempt,
  StudyQuestion,
  StudySet,
} from "../domain/types";
import {
  getCardLearningState,
  isDueForReview,
} from "../scheduling/scheduler";

export type StatsByQuestion = Record<string, CardLearningStats>;

export interface StudySetProgressInput {
  set: StudySet;
  questions: StudyQuestion[];
  statsByQuestion: StatsByQuestion;
  attempts: StudyAttempt[];
}

export interface ConceptMastery {
  concept: string;
  mastery: number;
  cardCount: number;
}

export interface RecommendedAction {
  label: string;
  href: string;
  tone: "urgent" | "focus" | "steady";
}

export interface StudySetProgress {
  set: StudySet;
  totalCards: number;
  overallMastery: number;
  cardsMastered: number;
  cardsLearning: number;
  weakCards: number;
  cardsDueToday: number;
  totalStudyTimeMs: number;
  questionsAnswered: number;
  accuracy: number;
  currentStudyStreak: number;
  conceptMastery: ConceptMastery[];
  weakestConcept?: ConceptMastery;
  recommendedActions: RecommendedAction[];
}

function getStats(
  question: StudyQuestion,
  statsByQuestion: StatsByQuestion,
): CardLearningStats {
  return (
    statsByQuestion[question.id] ?? {
      questionId: question.id,
      studySetId: question.studySetId,
      timesSeen: 0,
      timesCorrect: 0,
      timesIncorrect: 0,
      mastery: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      reviewInterval: 0,
      consecutiveSuccesses: 0,
    }
  );
}

function dateKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function calculateCurrentStudyStreak(
  attempts: StudyAttempt[],
  now = new Date(),
): number {
  const studiedDays = new Set(
    attempts
      .map((attempt) => dateKey(attempt.timestamp))
      .filter((day): day is string => day !== null),
  );
  const today = dateKey(now.toISOString());
  if (!today || !studiedDays.has(today)) return 0;

  let streak = 0;
  const cursor = new Date(`${today}T00:00:00.000Z`);

  while (studiedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function deriveConceptMastery(
  questions: StudyQuestion[],
  statsByQuestion: StatsByQuestion,
): ConceptMastery[] {
  const conceptTotals = new Map<string, { total: number; cards: number }>();

  for (const question of questions) {
    for (const concept of question.concepts ?? []) {
      const current = conceptTotals.get(concept) ?? { total: 0, cards: 0 };
      current.total += getStats(question, statsByQuestion).mastery;
      current.cards += 1;
      conceptTotals.set(concept, current);
    }
  }

  return [...conceptTotals.entries()]
    .map(([concept, value]) => ({
      concept,
      mastery: Math.round(value.total / value.cards),
      cardCount: value.cards,
    }))
    .sort((left, right) => left.mastery - right.mastery || left.concept.localeCompare(right.concept));
}

function buildRecommendedActions(
  setId: string,
  cardsDueToday: number,
  weakCards: number,
  weakestConcept: ConceptMastery | undefined,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (cardsDueToday > 0) {
    actions.push({
      label: `${cardsDueToday} cards need review`,
      href: `/sets/${setId}`,
      tone: "urgent",
    });
  }

  if (weakestConcept && weakCards > 0) {
    actions.push({
      label: `Your weakest topic is ${weakestConcept.concept}`,
      href: "/smart-study",
      tone: "focus",
    });
  }

  actions.push({
    label: "10-minute Smart Study recommended",
    href: "/smart-study",
    tone: "steady",
  });

  return actions;
}

export function deriveStudySetProgress(
  input: StudySetProgressInput,
  now = new Date(),
): StudySetProgress {
  const attempts = input.attempts.filter(
    (attempt) => attempt.studySetId === input.set.id,
  );
  const stats = input.questions.map((question) => getStats(question, input.statsByQuestion));
  const answeredAttempts = attempts.filter((attempt) => !attempt.skipped);
  const correctAttempts = answeredAttempts.filter(
    (attempt) => attempt.outcome === "correct",
  );
  const conceptMastery = deriveConceptMastery(input.questions, input.statsByQuestion);
  const weakestConcept = conceptMastery[0];
  const cardsDueToday = input.questions.filter((question) =>
    isDueForReview(getStats(question, input.statsByQuestion).nextReviewAt, now),
  ).length;
  const cardsMastered = stats.filter(
    (card) => getCardLearningState(card) === "mastered",
  ).length;
  const weakCards = stats.filter((card) => card.mastery < 40).length;

  return {
    set: input.set,
    totalCards: input.questions.length,
    overallMastery: input.questions.length
      ? Math.round(stats.reduce((total, card) => total + card.mastery, 0) / input.questions.length)
      : 0,
    cardsMastered,
    cardsLearning: input.questions.length - cardsMastered,
    weakCards,
    cardsDueToday,
    totalStudyTimeMs: attempts.reduce(
      (total, attempt) => total + (attempt.responseTimeMs ?? 0),
      0,
    ),
    questionsAnswered: answeredAttempts.length,
    accuracy: answeredAttempts.length
      ? Math.round((correctAttempts.length / answeredAttempts.length) * 100)
      : 0,
    currentStudyStreak: calculateCurrentStudyStreak(attempts, now),
    conceptMastery,
    weakestConcept,
    recommendedActions: buildRecommendedActions(
      input.set.id,
      cardsDueToday,
      weakCards,
      weakestConcept,
    ),
  };
}

