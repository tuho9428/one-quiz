"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { FlashcardQuestion } from "../domain/types";
import type { StudyQuestion } from "../domain/types";
import {
  createStatsForQuestions,
  type StatsByQuestion,
} from "../session/recording";
import { getCardLearningState, isDueForReview } from "../scheduling/scheduler";
import {
  FlashcardStudy,
} from "../modes/flashcards/FlashcardStudy";
import { ExportStudySetButton } from "../import/ExportStudySetButton";

export interface StudySetOverviewProps {
  setId: string;
  title: string;
  description: string;
  questions: StudyQuestion[];
}

type ReviewSession = {
  cards: FlashcardQuestion[];
  title: string;
};

export function StudySetOverview({
  setId,
  title,
  description,
  questions,
}: StudySetOverviewProps) {
  const cards = questions.filter((question): question is FlashcardQuestion => question.type === "flashcard");
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(cards),
  );
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);

  const dueCards = useMemo(
    () =>
      cards.filter((card) =>
        isDueForReview(statsByQuestion[card.id]?.nextReviewAt),
      ),
    [cards, statsByQuestion],
  );
  const weakCards = useMemo(
    () =>
      cards.filter((card) => {
        const stats = statsByQuestion[card.id];
        return stats && (stats.mastery < 40 || stats.timesIncorrect > stats.timesCorrect);
      }),
    [cards, statsByQuestion],
  );
  const mastery = cards.length
    ? Math.round(
        cards.reduce(
          (total, card) => total + (statsByQuestion[card.id]?.mastery ?? 0),
          0,
        ) / cards.length,
      )
    : 0;
  const masteredCount = cards.filter(
    (card) => getCardLearningState(statsByQuestion[card.id]) === "mastered",
  ).length;
  const learningCount = cards.length - masteredCount;
  const weakConcepts = useMemo(() => {
    const concepts = new Set<string>();

    for (const card of weakCards) {
      for (const concept of card.concepts ?? []) concepts.add(concept);
    }

    return [...concepts];
  }, [weakCards]);

  if (reviewSession) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setReviewSession(null)}
          className="fixed left-4 top-4 z-20 min-h-10 rounded-xl border border-[#b9cfca] bg-[#fbfdfc]/95 px-4 py-2 text-sm font-semibold text-[#24564e] shadow-sm backdrop-blur transition hover:bg-white dark:border-[#3b5a54] dark:bg-[#182320]/95 dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
        >
          Back to set
        </button>
        <FlashcardStudy
          cards={reviewSession.cards}
          title={reviewSession.title}
          initialStatsByQuestion={statsByQuestion}
          onStatsChange={setStatsByQuestion}
        />
      </div>
    );
  }

  return (
    <main data-study-set={setId} className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">
              Study set
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">
              {description}
            </p>
            <p className="mt-3 text-sm text-[#66807a] dark:text-[#94aea7]">
              {questions.length} items in this set
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 text-sm font-semibold sm:items-end">
            <Link href="/dashboard" className="text-[#0f766e] hover:underline dark:text-[#5eead4]">
              Progress
            </Link>
            <ExportStudySetButton studySetId={setId} />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-6 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <p className="text-sm font-semibold text-[#55716a] dark:text-[#a8bdb7]">Overall mastery</p>
            <p className="mt-2 text-6xl font-semibold tracking-tight text-[#0f766e] dark:text-[#5eead4] sm:text-7xl">
              {mastery}%
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label="Overall mastery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mastery}>
              <div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-300 dark:bg-[#2dd4bf]" style={{ width: `${mastery}%` }} />
            </div>
            <p className="mt-4 text-sm text-[#66807a] dark:text-[#94aea7]">
              {masteredCount} mastered <span className="px-1">|</span> {learningCount} learning
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-[#0f766e] p-6 text-white shadow-[0_18px_50px_rgba(15,118,110,0.22)] dark:bg-[#174f48] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b8f1e4]">
              Recommended next
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start Smart Study
            </h2>
            <p className="mt-3 max-w-md text-base leading-7 text-[#d2f6ee]">
              A guided session that adapts to your weak concepts and recent recall.
            </p>
            <Link
              href={`/sets/${setId}/study/smart-study`}
              className="mt-7 flex min-h-14 w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-[#0b625b] transition hover:bg-[#e8faf5] active:translate-y-px"
            >
              Start Smart Study
            </Link>
            <p className="mt-3 text-center text-sm text-[#b8f1e4]">10 min recommended</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3" aria-label="Study set summary">
          <SummaryMetric label="Due today" value={dueCards.length} tone="amber" />
          <SummaryMetric label="Weak concepts" value={weakConcepts.length} tone="rose" />
          <SummaryMetric label="Items" value={questions.length} tone="teal" />
        </section>

        {questions.length === 0 && (
          <section className="rounded-[1.5rem] border border-dashed border-[#9ebbb3] bg-[#fbfdfc] p-6 dark:border-[#4d7167] dark:bg-[#182320]">
            <h2 className="text-xl font-semibold">This study set is empty.</h2>
            <p className="mt-2 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">
              Add a question manually or import material before starting a study mode.
            </p>
          </section>
        )}

        <section>
          <SectionHeading title="Study Modes" description="Choose a focused way to practice this material." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ModeCard href={`/sets/${setId}/study/flashcards`} title="Flashcards" description="Quick recall and spaced repetition" disabled={cards.length === 0} />
            <ModeCard href={`/sets/${setId}/study/multiple-choice`} title="Multiple Choice" description="Build recognition, then confirm the reason" disabled={!questions.some((question) => question.type === "multiple-choice")} />
            <ModeCard href={`/sets/${setId}/study/write`} title="Write" description="Recall answers without hints" disabled={!questions.some((question) => question.type === "write")} />
            <ModeCard href={`/sets/${setId}/study/rapid-recall`} title="Rapid Recall" description="Answer as many as possible against the clock" disabled={!questions.some((question) => question.type === "write")} />
            <ModeCard href={`/sets/${setId}/study/debug-code`} title="Debug / Code" description="Explain bugs, behavior, and fixes" disabled={!questions.some((question) => question.type === "debug-code")} />
            <ModeCard
              title="Weak Areas"
              description="Practice concepts you miss most often"
              onClick={() => setReviewSession({ cards: weakCards, title: "Weak areas" })}
              disabled={weakCards.length === 0}
            />
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">Add items</h2>
            <p className="mt-1 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">Paste validated portable JSON or add one item manually.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={`/sets/${setId}/items/new`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Add Manually</Link>
            <Link href={`/import?setId=${setId}&format=text`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Import Raw Text</Link>
            <Link href={`/import?setId=${setId}&format=markdown`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Import Markdown</Link>
            <Link href={`/sets/${setId}/items/import`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f]">Import JSON</Link>
          </div>
        </section>

        <section>
          <SectionHeading title="Practice" description="Longer-form practice is coming next." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ModeCard title="Mock Interview" description="Practice explaining answers under interview pressure" disabled />
            <ModeCard title="Exam" description="Work through a complete timed assessment" disabled />
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">Progress</h2>
            <p className="mt-1 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">
              See mastery, accuracy, study time, streaks, and concept-level weaknesses.
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">
            View progress
          </Link>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">{description}</p>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: "amber" | "rose" | "teal" }) {
  const toneClass = {
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
    teal: "text-[#0f766e] dark:text-[#5eead4]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] px-4 py-4 dark:border-[#2d4440] dark:bg-[#182320] sm:px-5 sm:py-5">
      <p className="text-xs text-[#66807a] dark:text-[#94aea7] sm:text-sm">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

function ModeCard({
  title,
  description,
  href,
  onClick,
  disabled = false,
}: {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = `group flex min-h-32 flex-col justify-between rounded-2xl border p-5 text-left transition ${disabled ? "cursor-not-allowed border-[#d5e2df] bg-[#f3f8f6] opacity-55 dark:border-[#2d4440] dark:bg-[#1e2d2a]" : "border-[#d5e2df] bg-[#fbfdfc] hover:-translate-y-px hover:border-[#9ebbb3] hover:bg-white active:translate-y-px dark:border-[#2d4440] dark:bg-[#182320] dark:hover:border-[#4d7167] dark:hover:bg-[#20332f]"}`;
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {!disabled && <span aria-hidden="true" className="text-lg text-[#0f766e] transition-transform group-hover:translate-x-0.5 dark:text-[#5eead4]">→</span>}
      </div>
      <p className="mt-5 max-w-xs text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">{description}</p>
    </>
  );

  if (href && !disabled) return <Link href={href} className={className}>{content}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={className}>{content}</button>;
}
