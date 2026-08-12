"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createStudyAttempt,
} from "../../domain/engine";
import type { MultipleChoiceQuestion, StudyAttempt } from "../../domain/types";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  type StatsByQuestion,
} from "../../session/recording";
import {
  prepareMultipleChoiceSession,
  type MultipleChoiceOption,
  type MultipleChoiceSessionQuestion,
} from "./session";

interface AnswerState {
  selectedOptionId: string;
  selectedAnswer: string;
  attempt: StudyAttempt;
  feedbackRequested: boolean;
}

type AnswerStates = Record<string, AnswerState>;
function getMasteryTotal(
  questions: MultipleChoiceQuestion[],
  statsByQuestion: StatsByQuestion,
): number {
  return questions.reduce(
    (total, question) =>
      total + (statsByQuestion[question.id]?.mastery ?? 0),
    0,
  );
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID() ?? `attempt-${Date.now()}`;
}

function formatResponseTime(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function getAnswerSummary(answerStates: AnswerStates) {
  const attempts = Object.values(answerStates).map(({ attempt }) => attempt);
  const correct = attempts.filter((attempt) => attempt.outcome === "correct").length;

  return {
    attempts,
    correct,
    incorrect: attempts.length - correct,
  };
}

export interface MultipleChoiceStudyProps {
  questions: MultipleChoiceQuestion[];
  title?: string;
}

export function MultipleChoiceStudy({
  questions,
  title = "Active recall foundations",
}: MultipleChoiceStudyProps) {
  const [sessionQuestions, setSessionQuestions] = useState<
    MultipleChoiceSessionQuestion[]
  >(() => prepareMultipleChoiceSession(questions));
  const [answerStates, setAnswerStates] = useState<AnswerStates>({});
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(questions),
  );
  const [sessionStartMastery, setSessionStartMastery] = useState(() =>
    getMasteryTotal(questions, createStatsForQuestions(questions)),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [instantFeedback, setInstantFeedback] = useState(true);
  const questionStartedAt = useRef<number | null>(null);

  const currentSessionQuestion = sessionQuestions[currentIndex];
  const currentQuestion = currentSessionQuestion?.question;
  const currentAnswer = currentQuestion
    ? answerStates[currentQuestion.id]
    : undefined;
  const totalQuestions = sessionQuestions.length;
  const progress = isComplete
    ? 100
    : totalQuestions > 0
      ? ((currentIndex + 1) / totalQuestions) * 100
      : 0;
  const { attempts, correct, incorrect } = useMemo(
    () => getAnswerSummary(answerStates),
    [answerStates],
  );
  const currentScore = attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0;
  const feedbackVisible = Boolean(
    currentAnswer && (instantFeedback || currentAnswer.feedbackRequested),
  );
  const masteryChange =
    getMasteryTotal(
      sessionQuestions.map(({ question }) => question),
      statsByQuestion,
    ) - sessionStartMastery;

  const weakConcepts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const { question } of sessionQuestions) {
      const answer = answerStates[question.id];
      if (!answer || answer.attempt.outcome === "correct") continue;

      for (const concept of question.concepts ?? ["Uncategorized"]) {
        counts.set(concept, (counts.get(concept) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [answerStates, sessionQuestions]);

  const incorrectQuestions = useMemo(
    () =>
      sessionQuestions.filter(({ question }) => {
        const answer = answerStates[question.id];
        return answer && answer.attempt.outcome !== "correct";
      }),
    [answerStates, sessionQuestions],
  );

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [currentIndex]);

  const selectAnswer = useCallback(
    (option: MultipleChoiceOption) => {
      if (!currentQuestion || currentAnswer) return;

      const attempt = createStudyAttempt({
        id: createAttemptId(),
        question: currentQuestion,
        userAnswer: option.text,
        responseTimeMs:
          questionStartedAt.current === null
            ? undefined
            : Math.max(0, Date.now() - questionStartedAt.current),
        timestamp: new Date().toISOString(),
      });

      setAnswerStates((currentAnswers) => ({
        ...currentAnswers,
        [currentQuestion.id]: {
          selectedOptionId: option.id,
          selectedAnswer: option.text,
          attempt,
          feedbackRequested: instantFeedback,
        },
      }));
      setStatsByQuestion((currentStats) =>
        applyAttemptToStats(currentStats, attempt),
      );
    },
    [currentAnswer, currentQuestion, instantFeedback],
  );

  const showFeedback = useCallback(() => {
    if (!currentQuestion || !currentAnswer) return;

    setAnswerStates((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: {
        ...currentAnswer,
        feedbackRequested: true,
      },
    }));
  }, [currentAnswer, currentQuestion]);

  const nextQuestion = useCallback(() => {
    if (!currentAnswer) return;

    if (currentIndex >= totalQuestions - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentIndex((index) => index + 1);
  }, [currentAnswer, currentIndex, totalQuestions]);

  const startSession = useCallback(
    (nextQuestions: MultipleChoiceQuestion[]) => {
      setSessionQuestions(prepareMultipleChoiceSession(nextQuestions));
      setAnswerStates({});
      setCurrentIndex(0);
      setIsComplete(false);
      setSessionStartMastery(getMasteryTotal(nextQuestions, statsByQuestion));
      questionStartedAt.current = Date.now();
    },
    [statsByQuestion],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isComplete || event.repeat) return;

      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTextInput) return;

      const optionIndex = Number(event.key) - 1;
      const options = currentSessionQuestion?.options ?? [];

      if (optionIndex >= 0 && optionIndex < options.length) {
        event.preventDefault();
        selectAnswer(options[optionIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSessionQuestion, isComplete, selectAnswer]);

  if (!currentQuestion || totalQuestions === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No multiple-choice questions are available yet.</p>
      </main>
    );
  }

  if (isComplete) {
    const averageResponseTime = attempts.length
      ? attempts.reduce(
          (total, attempt) => total + (attempt.responseTimeMs ?? 0),
          0,
        ) / attempts.length
      : 0;
    const percentage = Math.round((correct / totalQuestions) * 100);

    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-5 py-6 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">
              Multiple choice complete
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Your recall snapshot
            </h1>
            <p className="mt-3 text-[#55716a] dark:text-[#a8bdb7]">{title}</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Score" value={`${correct} / ${totalQuestions}`} />
              <SummaryStat label="Percentage" value={`${percentage}%`} tone={percentage >= 70 ? "emerald" : "amber"} />
              <SummaryStat label="Correct" value={correct} tone="emerald" />
              <SummaryStat label="Incorrect" value={incorrect} tone="rose" />
              <SummaryStat label="Average response" value={formatResponseTime(averageResponseTime)} />
              <SummaryStat label="Mastery change" value={`${masteryChange >= 0 ? "+" : ""}${masteryChange}`} tone={masteryChange >= 0 ? "emerald" : "rose"} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">Weak concepts</h2>
                {weakConcepts.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {weakConcepts.map(([concept, count]) => (
                      <li key={concept} className="flex items-center justify-between rounded-xl bg-[#f3f8f6] px-4 py-3 text-sm dark:bg-[#1e2d2a]">
                        <span>{concept}</span>
                        <span className="font-mono text-xs text-[#66807a] dark:text-[#94aea7]">{count} missed</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#66807a] dark:text-[#94aea7]">No weak concepts in this session.</p>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold">Questions answered incorrectly</h2>
                {incorrectQuestions.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {incorrectQuestions.map(({ question }) => {
                      const answer = answerStates[question.id];
                      return (
                        <li key={question.id} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-900/70 dark:bg-rose-950/40">
                          <p className="font-semibold text-rose-950 dark:text-rose-100">{question.question}</p>
                          <p className="mt-2 text-rose-800 dark:text-rose-200">Your answer: {answer.selectedAnswer}</p>
                          <p className="mt-1 text-rose-800 dark:text-rose-200">Correct answer: {question.correctAnswer}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#66807a] dark:text-[#94aea7]">Every answer was correct.</p>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => startSession(incorrectQuestions.map(({ question }) => question))}
                disabled={incorrectQuestions.length === 0}
                className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
              >
                Review Mistakes
              </button>
              <button
                type="button"
                onClick={() => startSession(questions)}
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

  const showCorrectAnswer = currentAnswer?.attempt.outcome === "correct";

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-5 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">
              <span className="h-2 w-2 rounded-full bg-[#0f766e] dark:bg-[#5eead4]" aria-hidden="true" />
              Multiple choice
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          </div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
            <p className="text-sm font-medium text-[#4c6862] dark:text-[#a3bbb5]">Question {currentIndex + 1} of {totalQuestions}</p>
            <p className="text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">Score {correct} / {attempts.length}</p>
          </div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label="Question progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-300 ease-out dark:bg-[#2dd4bf]" style={{ width: `${progress}%` }} />
          </div>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-[#55716a] dark:text-[#a8bdb7]">
            <input
              type="checkbox"
              checked={instantFeedback}
              onChange={(event) => setInstantFeedback(event.target.checked)}
              className="h-4 w-4 accent-[#0f766e]"
            />
            Instant feedback
          </label>
        </div>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8" aria-labelledby="multiple-choice-question">
          <h2 id="multiple-choice-question" className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion.question}</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2" role="group" aria-label="Answer choices">
            {currentSessionQuestion.options.map((option, index) => {
              const isSelected = currentAnswer?.selectedOptionId === option.id;
              const isCorrect = option.text === currentQuestion.correctAnswer;
              const showFeedbackState = feedbackVisible && currentAnswer;
              let optionState = "border-[#cfdfdb] bg-[#f6faf8] hover:border-[#8bb8ad] hover:bg-[#edf7f3] dark:border-[#36514b] dark:bg-[#1d2d2a] dark:hover:border-[#5e9e90] dark:hover:bg-[#203a34]";

              if (showFeedbackState && isCorrect) {
                optionState = "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100";
              } else if (showFeedbackState && isSelected) {
                optionState = "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100";
              } else if (isSelected) {
                optionState = "border-[#0f766e] bg-[#e7f3ef] ring-2 ring-[#0f766e]/20 dark:border-[#5eead4] dark:bg-[#203a34] dark:ring-[#5eead4]/20";
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectAnswer(option)}
                  disabled={Boolean(currentAnswer)}
                  aria-pressed={isSelected}
                  className={`flex min-h-16 items-start gap-3 rounded-xl border px-4 py-4 text-left transition active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-default dark:focus-visible:outline-[#5eead4] ${optionState}`}
                >
                  <kbd className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/20 font-mono text-sm font-semibold opacity-75">{index + 1}</kbd>
                  <span className="pt-0.5 font-medium leading-6">{option.text}</span>
                </button>
              );
            })}
          </div>

          {currentAnswer && !feedbackVisible && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#cbded9] bg-[#f1f8f5] p-4 text-sm dark:border-[#36514b] dark:bg-[#1e332e] sm:flex-row sm:items-center sm:justify-between">
              <p>Your answer is recorded. Feedback is waiting when you are ready.</p>
              <button type="button" onClick={showFeedback} className="font-semibold text-[#0f766e] underline decoration-[#8bb8ad] underline-offset-4 dark:text-[#5eead4] dark:decoration-[#5e9e90]">Show Feedback</button>
            </div>
          )}

          {currentAnswer && feedbackVisible && (
            <div className={`mt-5 rounded-xl border p-4 ${showCorrectAnswer ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100" : "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100"}`} aria-live="polite">
              <p className="font-semibold">{showCorrectAnswer ? "Correct" : "Not quite"}</p>
              {!showCorrectAnswer && (
                <div className="mt-2 text-sm leading-6">
                  <p>Your answer: {currentAnswer.selectedAnswer}</p>
                  <p>Correct answer: {currentQuestion.correctAnswer}</p>
                </div>
              )}
              {currentQuestion.explanation && <p className="mt-3 text-sm leading-6">{currentQuestion.explanation}</p>}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#66807a] dark:text-[#94aea7]">Choose an answer once. The first response is recorded.</p>
            <button
              type="button"
              onClick={nextQuestion}
              disabled={!currentAnswer}
              className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
            >
              Next Question
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-2 text-sm text-[#66807a] dark:text-[#94aea7] sm:flex-row sm:items-center sm:justify-between">
          <p>Keyboard: 1, 2, 3, 4 to choose an answer.</p>
          <p className="font-mono text-xs tracking-wide">{currentScore}% current score</p>
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
  tone?: "neutral" | "rose" | "amber" | "emerald";
}) {
  const toneClass = {
    neutral: "text-[#16322e] dark:text-[#edf5f1]",
    rose: "text-rose-700 dark:text-rose-300",
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
      <p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
