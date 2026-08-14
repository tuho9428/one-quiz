"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createFlashcardAttempt,
} from "../../domain/engine";
import type { FlashcardQuestion, FlashcardRating } from "../../domain/types";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  type StatsByQuestion,
} from "../../session/recording";
import { CodeBlock } from "../debug-code/CodeBlock";
export type { StatsByQuestion } from "../../session/recording";

const ratingOrder: FlashcardRating[] = ["again", "hard", "good", "easy"];

const ratingMeta: Record<
  FlashcardRating,
  { label: string; description: string; className: string }
> = {
  again: {
    label: "Again",
    description: "I did not know it",
    className:
      "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-950",
  },
  hard: {
    label: "Hard",
    description: "I barely remembered",
    className:
      "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950",
  },
  good: {
    label: "Good",
    description: "I remembered correctly",
    className:
      "border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950",
  },
  easy: {
    label: "Easy",
    description: "I knew it immediately",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950",
  },
};

type RatingsByQuestion = Record<string, FlashcardRating>;

function getMasteryTotal(
  cards: FlashcardQuestion[],
  statsByQuestion: StatsByQuestion,
): number {
  return cards.reduce(
    (total, card) => total + (statsByQuestion[card.id]?.mastery ?? 0),
    0,
  );
}

function shuffleCards(cards: FlashcardQuestion[]): FlashcardQuestion[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID() ?? `attempt-${Date.now()}`;
}

export interface FlashcardStudyProps {
  cards: FlashcardQuestion[];
  title?: string;
  initialStatsByQuestion?: StatsByQuestion;
  onStatsChange?: (statsByQuestion: StatsByQuestion) => void;
}

export function FlashcardStudy({
  cards,
  title = "Active recall foundations",
  initialStatsByQuestion,
  onStatsChange,
}: FlashcardStudyProps) {
  const [orderedCards, setOrderedCards] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [ratingsByQuestion, setRatingsByQuestion] = useState<RatingsByQuestion>(
    {},
  );
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    initialStatsByQuestion ?? createStatsForQuestions(cards),
  );
  const [sessionStartMastery, setSessionStartMastery] = useState(() =>
    getMasteryTotal(cards, initialStatsByQuestion ?? createStatsForQuestions(cards)),
  );
  const cardStartedAt = useRef<number | null>(null);

  const currentCard = orderedCards[currentIndex];
  const currentRating = currentCard
    ? ratingsByQuestion[currentCard.id]
    : undefined;
  const totalCards = orderedCards.length;
  const progress = isComplete
    ? 100
    : totalCards > 0
      ? ((currentIndex + 1) / totalCards) * 100
      : 0;

  const sessionCounts = useMemo(() => {
    const counts = {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    } satisfies Record<FlashcardRating, number>;

    for (const rating of Object.values(ratingsByQuestion)) {
      counts[rating] += 1;
    }

    return counts;
  }, [ratingsByQuestion]);

  const weakCards = useMemo(
    () =>
      orderedCards.filter((card) => {
        const rating = ratingsByQuestion[card.id];
        return rating === "again" || rating === "hard";
      }),
    [orderedCards, ratingsByQuestion],
  );

  const masteryChange = getMasteryTotal(orderedCards, statsByQuestion) - sessionStartMastery;
  const hasUnratedCards = orderedCards.some((card) => !ratingsByQuestion[card.id]);

  useEffect(() => {
    cardStartedAt.current = Date.now();
  }, [currentIndex]);

  const revealAnswer = useCallback(() => {
    if (!isComplete) setIsRevealed(true);
  }, [isComplete]);

  const goToCard = useCallback(
    (nextIndex: number) => {
      const boundedIndex = Math.max(0, Math.min(nextIndex, totalCards - 1));
      const nextCard = orderedCards[boundedIndex];

      setCurrentIndex(boundedIndex);
      setIsComplete(false);
      setIsRevealed(Boolean(nextCard && ratingsByQuestion[nextCard.id]));
    },
    [orderedCards, ratingsByQuestion, totalCards],
  );

  const rateCurrentCard = useCallback(
    (rating: FlashcardRating) => {
      if (!currentCard || !isRevealed || currentRating) return;

      const timestamp = new Date().toISOString();
      const attempt = createFlashcardAttempt({
        id: createAttemptId(),
        question: currentCard,
        rating,
        responseTimeMs:
          cardStartedAt.current === null
            ? undefined
            : Math.max(0, Date.now() - cardStartedAt.current),
        timestamp,
      });
      const nextRatings = { ...ratingsByQuestion, [currentCard.id]: rating };
      const allCardsRated = orderedCards.every((card) => nextRatings[card.id]);

      setRatingsByQuestion(nextRatings);
      setStatsByQuestion((currentStats) => {
        const nextStats = applyAttemptToStats(currentStats, attempt);
        onStatsChange?.(nextStats);
        return nextStats;
      });

      if (allCardsRated) {
        setIsComplete(true);
        return;
      }

      if (currentIndex < totalCards - 1) {
        setCurrentIndex((index) => index + 1);
        setIsRevealed(false);
      }
    },
    [currentCard, currentIndex, currentRating, isRevealed, onStatsChange, orderedCards, ratingsByQuestion, totalCards],
  );

  const restartSession = useCallback(
    (nextCards: FlashcardQuestion[]) => {
      setOrderedCards(nextCards);
      setCurrentIndex(0);
      setIsRevealed(false);
      setIsComplete(false);
      setRatingsByQuestion({});
      setSessionStartMastery(getMasteryTotal(nextCards, statsByQuestion));
      cardStartedAt.current = Date.now();
    },
    [statsByQuestion],
  );

  const shuffleSession = useCallback(() => {
    if (orderedCards.length < 2) return;

    const currentCardId = currentCard?.id;
    const shuffledCards = shuffleCards(orderedCards);
    const nextIndex = currentCardId
      ? shuffledCards.findIndex((card) => card.id === currentCardId)
      : 0;

    setOrderedCards(shuffledCards);
    setCurrentIndex(Math.max(0, nextIndex));
    setIsRevealed(Boolean(currentCardId && ratingsByQuestion[currentCardId]));
  }, [currentCard, orderedCards, ratingsByQuestion]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isComplete || event.repeat) return;

      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTextInput) return;

      if (event.code === "Space") {
        event.preventDefault();
        revealAnswer();
        return;
      }

      const ratingIndex = Number(event.key) - 1;
      if (ratingIndex >= 0 && ratingIndex < ratingOrder.length) {
        event.preventDefault();
        rateCurrentCard(ratingOrder[ratingIndex]);
        return;
      }

      if (event.key === "ArrowLeft" && currentIndex > 0) {
        event.preventDefault();
        goToCard(currentIndex - 1);
      }

      if (event.key === "ArrowRight" && currentIndex < totalCards - 1) {
        event.preventDefault();
        goToCard(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, goToCard, isComplete, rateCurrentCard, revealAnswer, totalCards]);

  if (!currentCard || totalCards === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No flashcards are available yet.</p>
      </main>
    );
  }

  if (isComplete) {
    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-5 py-6 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <header className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">
                Session complete
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Nice work. Keep the recall moving.
              </h1>
            </div>
            <span className="rounded-full border border-[#c8d9d5] bg-[#eaf2ef] px-3 py-1.5 text-sm font-semibold text-[#35645c] dark:border-[#2e4944] dark:bg-[#192824] dark:text-[#a7d7cc]">
              {title}
            </span>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Cards studied" value={Object.keys(ratingsByQuestion).length} />
              <SummaryStat label="Again" value={sessionCounts.again} tone="rose" />
              <SummaryStat label="Hard" value={sessionCounts.hard} tone="amber" />
              <SummaryStat label="Good" value={sessionCounts.good} tone="sky" />
              <SummaryStat label="Easy" value={sessionCounts.easy} tone="emerald" />
              <SummaryStat
                label="Mastery change"
                value={`${masteryChange >= 0 ? "+" : ""}${masteryChange}`}
                tone={masteryChange >= 0 ? "emerald" : "rose"}
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => restartSession(weakCards)}
                disabled={weakCards.length === 0}
                className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
              >
                Study Weak Cards
              </button>
              <button
                type="button"
                onClick={() => restartSession(cards)}
                className="min-h-12 flex-1 rounded-xl border border-[#b9cfca] bg-transparent px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
              >
                Study Again
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-5 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">
              <span className="h-2 w-2 rounded-full bg-[#0f766e] dark:bg-[#5eead4]" aria-hidden="true" />
              Flashcards
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
          </div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
            <p className="text-sm font-medium text-[#4c6862] dark:text-[#a3bbb5]">
              Card {currentIndex + 1} of {totalCards}
            </p>
            <p className="text-xs text-[#6b8580] dark:text-[#829d96]">
              {Object.keys(ratingsByQuestion).length} rated this session
            </p>
          </div>
        </header>

        <div className="h-2 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-300 ease-out dark:bg-[#2dd4bf]" style={{ width: `${progress}%` }} />
        </div>

        <section className="flex flex-col gap-5" aria-labelledby="flashcard-prompt">
          <div className={`flashcard-stage ${isRevealed ? "is-revealed" : ""}`}>
            <div
              className="flashcard-card"
              data-revealed={isRevealed}
              data-has-code={Boolean(currentCard.codeSnippet)}
            >
              <article className="flashcard-face flashcard-front" aria-hidden={isRevealed}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e] dark:text-[#5eead4]">
                  Prompt
                </span>
                <h2 id="flashcard-prompt" className="mt-5 max-w-2xl text-center text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  {currentCard.prompt}
                </h2>
                {currentCard.codeSnippet && (
                  <div className="flashcard-code-scroll mt-7 w-full max-w-3xl text-left">
                    <CodeBlock code={currentCard.codeSnippet} language={currentCard.language ?? "text"} />
                  </div>
                )}
                <p className="mt-6 text-sm text-[#66807a] dark:text-[#94aea7]">
                  Try to retrieve it before you reveal the answer.
                </p>
              </article>

              <article className="flashcard-face flashcard-back" aria-hidden={!isRevealed}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e] dark:text-[#5eead4]">
                  Answer
                </span>
                <p className="mt-5 max-w-2xl text-center text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {currentCard.answer}
                </p>
                {currentCard.explanation && (
                  <p className="mt-6 max-w-xl text-center text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">
                    {currentCard.explanation}
                  </p>
                )}
              </article>
            </div>
          </div>

          {!isRevealed ? (
            <button
              type="button"
              onClick={revealAnswer}
              className="mx-auto min-h-12 w-full max-w-sm rounded-xl bg-[#0f766e] px-6 py-3 font-semibold text-white shadow-[0_8px_20px_rgba(15,118,110,0.18)] transition hover:bg-[#0b625b] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e] dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4] dark:focus-visible:outline-[#5eead4]"
            >
              Show Answer
            </button>
          ) : (
            <div className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-4 dark:border-[#2d4440] dark:bg-[#182320]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">How well did you remember it?</p>
                  <p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">
                    Use a rating to set the next review.
                  </p>
                </div>
                {currentRating && (
                  <span className="text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">
                    Rated {ratingMeta[currentRating].label}
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ratingOrder.map((rating, index) => {
                  const meta = ratingMeta[rating];
                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => rateCurrentCard(rating)}
                      disabled={Boolean(currentRating)}
                      aria-pressed={currentRating === rating}
                      className={`min-h-16 rounded-xl border px-3 py-2 text-left transition active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-default disabled:opacity-60 dark:focus-visible:outline-[#5eead4] ${meta.className} ${currentRating === rating ? "ring-2 ring-[#0f766e] ring-offset-2 ring-offset-[#fbfdfc] dark:ring-[#5eead4] dark:ring-offset-[#182320]" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2 font-semibold">
                        {meta.label}
                        <kbd className="rounded-md border border-current/20 px-1.5 py-0.5 text-xs font-medium opacity-70">
                          {index + 1}
                        </kbd>
                      </span>
                      <span className="mt-1 block text-xs opacity-75">
                        {meta.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4 border-t border-[#d5e2df] pt-5 dark:border-[#2d4440] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goToCard(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="min-h-11 rounded-xl border border-[#b9cfca] bg-transparent px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToCard(currentIndex + 1)}
              disabled={currentIndex === totalCards - 1}
              className="min-h-11 rounded-xl border border-[#b9cfca] bg-transparent px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
            >
              Next
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shuffleSession}
              className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-[#55716a] transition hover:bg-[#e8f1ee] active:translate-y-px dark:text-[#a8bdb7] dark:hover:bg-[#20332f]"
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={() => restartSession(cards)}
              className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-[#55716a] transition hover:bg-[#e8f1ee] active:translate-y-px dark:text-[#a8bdb7] dark:hover:bg-[#20332f]"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-[#66807a] dark:text-[#94aea7] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {hasUnratedCards && currentIndex === totalCards - 1
              ? "Rate every card to finish the session."
              : "Your progress is saved as you rate each card."}
          </p>
          <p className="font-mono text-xs tracking-wide">
            Space reveal <span className="px-1">|</span> 1-4 rate <span className="px-1">|</span> Left/Right move
          </p>
        </div>
      </div>
    </main>
  );
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "rose" | "amber" | "sky" | "emerald";
}) {
  const toneClass = {
    neutral: "text-[#16322e] dark:text-[#edf5f1]",
    rose: "text-rose-700 dark:text-rose-300",
    amber: "text-amber-700 dark:text-amber-300",
    sky: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
      <p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
