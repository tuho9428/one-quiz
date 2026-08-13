"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createStudyAttemptFromGrade,
  getMasteryDelta,
} from "../../domain/engine";
import type { StudyAttempt, WriteQuestion } from "../../domain/types";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  type StatsByQuestion,
} from "../../session/recording";
import {
  deterministicWriteGrader,
  type WriteGradingResult,
} from "../../grading/write-grader";
import { CodeBlock } from "../debug-code/CodeBlock";

interface WriteSessionResult {
  grade: WriteGradingResult;
  attempt: StudyAttempt;
}

type ResultsByQuestion = Record<string, WriteSessionResult>;
function getMasteryTotal(
  questions: WriteQuestion[],
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

function getResultLabel(outcome: WriteGradingResult["outcome"]): string {
  if (outcome === "correct") return "Correct";
  if (outcome === "partial") return "Partially Correct";
  return "Incorrect";
}

function getResultTone(outcome: WriteGradingResult["outcome"]): string {
  if (outcome === "correct") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  if (outcome === "partial") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100";
  }
  return "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100";
}

export interface WriteStudyProps {
  questions: WriteQuestion[];
  title?: string;
}

export function WriteStudy({
  questions,
  title = "Active recall foundations",
}: WriteStudyProps) {
  const [sessionQuestions, setSessionQuestions] = useState(questions);
  const [resultsByQuestion, setResultsByQuestion] = useState<ResultsByQuestion>(
    {},
  );
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(questions),
  );
  const [sessionStartMastery, setSessionStartMastery] = useState(() =>
    getMasteryTotal(questions, createStatsForQuestions(questions)),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const questionStartedAt = useRef<number | null>(null);

  const currentQuestion = sessionQuestions[currentIndex];
  const currentResult = currentQuestion
    ? resultsByQuestion[currentQuestion.id]
    : undefined;
  const totalQuestions = sessionQuestions.length;
  const progress = isComplete
    ? 100
    : totalQuestions > 0
      ? ((currentIndex + 1) / totalQuestions) * 100
      : 0;
  const resultList = useMemo(
    () => Object.values(resultsByQuestion),
    [resultsByQuestion],
  );
  const masteryChange =
    getMasteryTotal(sessionQuestions, statsByQuestion) - sessionStartMastery;

  const weakQuestions = useMemo(
    () =>
      sessionQuestions.filter(
        (question) => resultsByQuestion[question.id]?.grade.outcome !== "correct",
      ),
    [resultsByQuestion, sessionQuestions],
  );

  const conceptsNeedReview = useMemo(() => {
    const counts = new Map<string, number>();

    for (const { grade } of resultList) {
      if (grade.outcome === "correct") continue;

      for (const concept of grade.missedConcepts) {
        counts.set(concept, (counts.get(concept) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [resultList]);

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [currentIndex]);

  const checkAnswer = useCallback(async () => {
    if (!currentQuestion || currentResult || !answer.trim() || isChecking) {
      return;
    }

    setIsChecking(true);

    try {
      const grade = await deterministicWriteGrader.grade(
        currentQuestion,
        answer,
      );
      const attempt = createStudyAttemptFromGrade({
        id: createAttemptId(),
        question: currentQuestion,
        userAnswer: answer,
        grade,
        conceptsIncluded: grade.includedConcepts,
        conceptsMissed: grade.missedConcepts,
        grader: grade.grader,
        responseTimeMs:
          questionStartedAt.current === null
            ? undefined
            : Math.max(0, Date.now() - questionStartedAt.current),
        timestamp: new Date().toISOString(),
      });

      setResultsByQuestion((currentResults) => ({
        ...currentResults,
        [currentQuestion.id]: { grade, attempt },
      }));
      setStatsByQuestion((currentStats) =>
        applyAttemptToStats(currentStats, attempt),
      );
    } finally {
      setIsChecking(false);
    }
  }, [answer, currentQuestion, currentResult, isChecking]);

  const nextQuestion = useCallback(() => {
    if (!currentResult) return;

    if (currentIndex >= totalQuestions - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentIndex((index) => index + 1);
    setAnswer("");
  }, [currentIndex, currentResult, totalQuestions]);

  const startSession = useCallback(
    (nextQuestions: WriteQuestion[]) => {
      setSessionQuestions(nextQuestions);
      setResultsByQuestion({});
      setCurrentIndex(0);
      setAnswer("");
      setIsComplete(false);
      setSessionStartMastery(getMasteryTotal(nextQuestions, statsByQuestion));
      questionStartedAt.current = Date.now();
    },
    [statsByQuestion],
  );

  if (!currentQuestion || totalQuestions === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No write questions are available yet.</p>
      </main>
    );
  }

  if (isComplete) {
    const fullyCorrect = resultList.filter(({ grade }) => grade.outcome === "correct").length;
    const partiallyCorrect = resultList.filter(({ grade }) => grade.outcome === "partial").length;
    const incorrect = resultList.filter(({ grade }) => grade.outcome === "incorrect").length;
    const averageScore = resultList.length
      ? Math.round(resultList.reduce((total, { grade }) => total + grade.score, 0) / resultList.length)
      : 0;

    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-5 py-6 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Write mode complete</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Your written recall snapshot</h1>
            <p className="mt-3 text-[#55716a] dark:text-[#a8bdb7]">{title}</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Average answer score" value={`${averageScore}%`} tone={averageScore >= 90 ? "emerald" : averageScore >= 60 ? "amber" : "rose"} />
              <SummaryStat label="Fully correct" value={fullyCorrect} tone="emerald" />
              <SummaryStat label="Partially correct" value={partiallyCorrect} tone="amber" />
              <SummaryStat label="Incorrect" value={incorrect} tone="rose" />
              <SummaryStat label="Mastery change" value={`${masteryChange >= 0 ? "+" : ""}${masteryChange}`} tone={masteryChange >= 0 ? "emerald" : "rose"} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">Concepts that need review</h2>
                {conceptsNeedReview.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {conceptsNeedReview.map(([concept, count]) => (
                      <li key={concept} className="flex items-center justify-between rounded-xl bg-[#f3f8f6] px-4 py-3 text-sm dark:bg-[#1e2d2a]">
                        <span>{concept}</span>
                        <span className="font-mono text-xs text-[#66807a] dark:text-[#94aea7]">{count} missed</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#66807a] dark:text-[#94aea7]">No concepts need review from this session.</p>
                )}
              </div>

              <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] p-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
                <p className="text-sm text-[#66807a] dark:text-[#94aea7]">The next useful step is to write the weak answers again without looking at the expected wording.</p>
                <p className="mt-3 text-2xl font-semibold">{weakQuestions.length} answer{weakQuestions.length === 1 ? "" : "s"} to review</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => startSession(weakQuestions)}
                disabled={weakQuestions.length === 0}
                className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
              >
                Review Weak Answers
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

  const result = currentResult?.grade;

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-5 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]"><span className="h-2 w-2 rounded-full bg-[#0f766e] dark:bg-[#5eead4]" aria-hidden="true" />Write mode</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          </div>
          <p className="text-sm font-medium text-[#4c6862] dark:text-[#a3bbb5]">Question {currentIndex + 1} of {totalQuestions}</p>
        </header>

        <div className="h-2 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label="Write mode progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-300 ease-out dark:bg-[#2dd4bf]" style={{ width: `${progress}%` }} />
        </div>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8" aria-labelledby="write-question">
          <h2 id="write-question" className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion.question}</h2>
          {currentQuestion.codeSnippet && (
            <div className="mt-6">
              <CodeBlock code={currentQuestion.codeSnippet} language={currentQuestion.language ?? "text"} />
            </div>
          )}
          <label htmlFor="write-answer" className="mt-7 block text-sm font-semibold text-[#55716a] dark:text-[#a8bdb7]">Your answer</label>
          <textarea
            id="write-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={Boolean(currentResult) || isChecking}
            placeholder="Write what you remember..."
            rows={7}
            className="mt-2 block w-full resize-y rounded-xl border border-[#b9cfca] bg-[#f8fbfa] px-4 py-3 text-base leading-7 text-[#16322e] outline-none transition placeholder:text-[#87a19a] focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10 disabled:cursor-default disabled:opacity-80 dark:border-[#3b5a54] dark:bg-[#1b2a27] dark:text-[#edf5f1] dark:placeholder:text-[#76918a] dark:focus:border-[#5eead4] dark:focus:ring-[#5eead4]/10"
          />

          {!currentResult || !result ? (
            <button
              type="button"
              onClick={checkAnswer}
              disabled={!answer.trim() || isChecking}
              className="mt-4 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
            >
              {isChecking ? "Checking..." : "Check Answer"}
            </button>
          ) : (
            <div className={`mt-6 rounded-xl border p-4 ${getResultTone(result.outcome)}`} aria-live="polite">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-semibold">Result: {getResultLabel(result.outcome)}</p>
                <span className="font-mono text-sm font-semibold">{result.score}/100</span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">Expected answer</p>
                  <p className="mt-2 text-sm leading-6">{result.expectedAnswer}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">Your answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{currentResult.attempt.userAnswer}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ConceptList label="Important concepts included" concepts={result.includedConcepts} />
                <ConceptList label="Important concepts missed" concepts={result.missedConcepts} />
              </div>
              {result.explanation && <p className="mt-5 border-t border-current/15 pt-4 text-sm leading-6">{result.explanation}</p>}
              <p className="mt-4 text-xs font-medium opacity-75">Mastery impact: {getMasteryDelta(currentResult.attempt) >= 0 ? "+" : ""}{getMasteryDelta(currentResult.attempt)}</p>
            </div>
          )}

          {currentResult && (
            <button
              type="button"
              onClick={nextQuestion}
              className="mt-4 min-h-12 w-full rounded-xl border border-[#b9cfca] bg-transparent px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
            >
              Next Question
            </button>
          )}
        </section>

        <p className="text-sm text-[#66807a] dark:text-[#94aea7]">Write from memory first. The grader rewards concepts, not exact phrasing.</p>
      </div>
    </main>
  );
}

function ConceptList({ label, concepts }: { label: string; concepts: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">{label}</p>
      {concepts.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {concepts.map((concept) => (
            <li key={concept} className="rounded-lg border border-current/20 px-2.5 py-1 text-xs font-medium">{concept}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm opacity-75">None yet</p>
      )}
    </div>
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
