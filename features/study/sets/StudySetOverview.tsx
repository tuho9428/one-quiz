"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { StudyQuestion } from "../domain/types";
import type { FlashcardQuestion } from "../domain/types";
import { canStudyItemInMode, toFlashcardQuestion } from "../domain/eligibility";
import { getQuestionText } from "../domain/eligibility";
import { StudyModeChooser } from "./StudyModeChooser";
import { MultipleChoiceDiagnostics } from "./MultipleChoiceDiagnostics";
import {
  clearStudyQuestionSelection,
  filterStudyQuestions,
  getStudyItemsPage,
  getStudyItemsPageCount,
  getStudyItemsPageRange,
  getSelectedStudyQuestions,
  selectVisibleStudyQuestions,
  toggleStudyQuestionSelection,
} from "./selection";
import {
  createStatsForQuestions,
  type StatsByQuestion,
} from "../session/recording";
import { getCardLearningState, isDueForReview } from "../scheduling/scheduler";
import {
  FlashcardStudy,
} from "../modes/flashcards/FlashcardStudy";
import { ExportStudySetButton } from "../import/ExportStudySetButton";
import { Pagination } from "../components/Pagination";

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
  const cards: FlashcardQuestion[] = questions.filter((question) => canStudyItemInMode(question, "flashcard")).map(toFlashcardQuestion);
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(cards),
  );
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isModeChooserOpen, setIsModeChooserOpen] = useState(false);
  const [isSelectionExpanded, setIsSelectionExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredQuestions = useMemo(
    () => filterStudyQuestions(questions, search),
    [questions, search],
  );
  const pageCount = getStudyItemsPageCount(filteredQuestions.length);
  const renderedQuestions = getStudyItemsPage(filteredQuestions, currentPage);
  const pageRange = getStudyItemsPageRange(filteredQuestions.length, currentPage);
  const selectedQuestions = useMemo(
    () => getSelectedStudyQuestions(questions, selectedItemIds),
    [questions, selectedItemIds],
  );
  const allFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((question) => selectedItemIds.includes(question.id));

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

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
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <Link href={`/sets/${setId}/edit`} className="min-h-10 rounded-xl border border-[#b9cfca] px-4 py-2 text-[#24564e] hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">
                Edit set
              </Link>
              <Link href="/dashboard" className="min-h-10 rounded-xl border border-[#b9cfca] px-4 py-2 text-[#24564e] hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">
                Progress
              </Link>
            </div>
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

        <section className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-6" aria-labelledby="study-items-heading">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id="study-items-heading" className="text-lg font-semibold tracking-tight sm:text-xl">Choose specific items</h2>
              {selectedItemIds.length > 0 ? <p className="mt-1 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">{selectedItemIds.length} selected</p> : <p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Create a focused study session from specific questions.</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {selectedItemIds.length > 0 && !isSelectionExpanded && <button type="button" onClick={() => setIsModeChooserOpen(true)} className="min-h-10 rounded-xl bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0b625b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Study Selected</button>}
              <button type="button" onClick={() => setIsSelectionExpanded((expanded) => !expanded)} aria-expanded={isSelectionExpanded} aria-controls="study-item-selection-panel" className="min-h-10 rounded-xl border border-[#b9cfca] px-3 py-2 text-sm font-semibold text-[#24564e] hover:bg-[#e8f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">{isSelectionExpanded ? "Collapse" : selectedItemIds.length > 0 ? "Change Selection" : "Choose Items"}</button>
            </div>
          </div>
          {isSelectionExpanded && <div id="study-item-selection-panel" className="mt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="study-items-heading" className="text-2xl font-semibold tracking-tight">Study items</h2>
              <p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Select questions to create a focused temporary session.</p>
            </div>
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Search questions and tags</span>
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search questions or tags..."
                className="min-h-11 w-full rounded-xl border border-[#b9cfca] bg-[#f8fbfa] px-4 py-2 text-sm text-[#16322e] outline-none placeholder:text-[#87a19a] focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 dark:border-[#3b5a54] dark:bg-[#1b2a27] dark:text-[#edf5f1] dark:placeholder:text-[#76918a] dark:focus:border-[#5eead4]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => setSelectedItemIds((current) => selectVisibleStudyQuestions(current, filteredQuestions))} disabled={filteredQuestions.length === 0 || allFilteredSelected} className="min-h-10 rounded-xl border border-[#b9cfca] px-3 py-2 font-semibold text-[#24564e] hover:bg-[#e8f1ee] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">{search.trim() ? `Select all ${filteredQuestions.length} matching` : `Select all ${filteredQuestions.length} items`}</button>
            <button type="button" onClick={() => setSelectedItemIds(clearStudyQuestionSelection())} disabled={selectedItemIds.length === 0} className="min-h-10 rounded-xl px-3 py-2 font-semibold text-[#55716a] hover:bg-[#e8f1ee] disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#a8bdb7] dark:hover:bg-[#20332f]">Clear selection</button>
            <span className="ml-auto text-[#66807a] dark:text-[#a8bdb7]">{search.trim() ? `${filteredQuestions.length} matching` : `${questions.length} total`} · {selectedItemIds.length} selected</span>
          </div>

          {filteredQuestions.length > 0 ? (
            <div className="mt-4 divide-y divide-[#d5e2df] rounded-xl border border-[#d5e2df] dark:divide-[#2d4440] dark:border-[#2d4440]">
              {renderedQuestions.map((question) => {
                const isSelected = selectedItemIds.includes(question.id);
                return (
                  <div key={question.id} className="flex items-start gap-3 p-4 first:rounded-t-xl last:rounded-b-xl hover:bg-[#f3f8f6] dark:hover:bg-[#1e2d2a]">
                    <input
                      id={`select-${question.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedItemIds((current) => toggleStudyQuestionSelection(current, question.id))}
                      aria-label={`Select ${getQuestionText(question)}`}
                      className="mt-1 h-5 w-5 shrink-0 accent-[#0f766e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-6">{getQuestionText(question)}</p>
                      {question.concepts && question.concepts.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{question.concepts.map((concept) => <span key={concept} className="rounded-md bg-[#e8f1ee] px-2 py-1 text-xs font-medium text-[#55716a] dark:bg-[#20332f] dark:text-[#b8e4da]">{concept}</span>)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-[#9ebbb3] p-5 text-sm text-[#66807a] dark:border-[#4d7167] dark:text-[#a8bdb7]">No study items match this search.</p>
          )}
          <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[#66807a] dark:text-[#a8bdb7]">Showing {pageRange.start}-{pageRange.end} of {filteredQuestions.length}{search.trim() ? " matching" : ""}</p>
            {filteredQuestions.length > 0 && <Pagination currentPage={currentPage} totalPages={pageCount} onPageChange={setCurrentPage} ariaLabel="Study item pages" />}
          </div>
          </div>}
        </section>

        {isSelectionExpanded && selectedItemIds.length > 0 && (
          <section className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-[#9ebbb3] bg-[#e8f5f1]/95 p-4 shadow-[0_12px_40px_rgba(27,64,57,0.16)] backdrop-blur dark:border-[#3b6a5e] dark:bg-[#183b35]/95 sm:flex-row sm:items-center sm:justify-between" aria-label="Selected study items">
            <p className="font-semibold text-[#24564e] dark:text-[#d2f6ee]">{selectedItemIds.length} selected</p>
            <button type="button" onClick={() => setIsModeChooserOpen(true)} className="min-h-11 rounded-xl bg-[#0f766e] px-5 py-2 font-semibold text-white hover:bg-[#0b625b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Study Selected</button>
          </section>
        )}

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
            <ModeCard href={`/sets/${setId}/study/flashcards`} title="Flashcards" description={`Quick recall and spaced repetition · ${cards.length} available`} disabled={cards.length === 0} />
            <ModeCard href={`/sets/${setId}/study/multiple-choice`} title="Multiple Choice" description={`Build recognition, then confirm the reason · ${questions.filter((question) => canStudyItemInMode(question, "multiple-choice", questions)).length} available`} disabled={!questions.some((question) => canStudyItemInMode(question, "multiple-choice", questions))} />
            <ModeCard href={`/sets/${setId}/study/write`} title="Write" description={`Recall answers without hints · ${questions.filter((question) => canStudyItemInMode(question, "write")).length} available`} disabled={!questions.some((question) => canStudyItemInMode(question, "write"))} />
            <ModeCard href={`/sets/${setId}/study/rapid-recall`} title="Rapid Recall" description={`Answer as many as possible against the clock · ${questions.filter((question) => canStudyItemInMode(question, "rapid-recall")).length} available`} disabled={!questions.some((question) => canStudyItemInMode(question, "rapid-recall"))} />
            <ModeCard href={`/sets/${setId}/study/debug-code`} title="Debug / Code" description={`Explain bugs, behavior, and fixes · ${questions.filter((question) => canStudyItemInMode(question, "debug-code")).length} available`} disabled={!questions.some((question) => canStudyItemInMode(question, "debug-code"))} />
            <ModeCard
              title="Weak Areas"
              description="Practice concepts you miss most often"
              onClick={() => setReviewSession({ cards: weakCards, title: "Weak areas" })}
              disabled={weakCards.length === 0}
            />
          </div>
        </section>

        <MultipleChoiceDiagnostics questions={questions} />

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
      {isModeChooserOpen && <StudyModeChooser setId={setId} selectedQuestions={selectedQuestions} onClose={() => setIsModeChooserOpen(false)} />}
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
