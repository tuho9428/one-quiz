"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createStudyAttemptFromGrade,
} from "../../domain/engine";
import type { DebugCodeQuestion, StudyAttempt } from "../../domain/types";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  type StatsByQuestion,
} from "../../session/recording";
import { CodeBlock } from "./CodeBlock";
import {
  deterministicDebugCodeGrader,
  type DebugCodeGradingResult,
} from "./grader";

type ConceptPerformance = Record<
  string,
  { seen: number; correct: number; partial: number; incorrect: number }
>;

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID() ?? `debug-attempt-${Date.now()}`;
}

function taskLabel(task: DebugCodeQuestion["task"]): string {
  switch (task) {
    case "identify-bug":
      return "Identify a bug";
    case "explain-behavior":
      return "Explain behavior";
    case "predict-output":
      return "Predict output";
    case "fix-code":
      return "Fix the code";
    case "complete-code":
      return "Complete the code";
  }
}

function answerLabel(task: DebugCodeQuestion["task"]): string {
  switch (task) {
    case "predict-output":
      return "What will this code output?";
    case "fix-code":
      return "Write the corrected code or explain the fix.";
    case "complete-code":
      return "Complete the missing code.";
    default:
      return "Explain your answer from memory.";
  }
}

function getConcepts(question: DebugCodeQuestion): string[] {
  return question.concepts ?? ["General debugging"];
}

function formatScore(score: number): string {
  return `${score} / 100`;
}

function buildConceptPerformance(
  attempts: StudyAttempt[],
  questions: DebugCodeQuestion[],
): ConceptPerformance {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const performance: ConceptPerformance = {};

  for (const attempt of attempts) {
    const concepts = attempt.conceptsIncluded?.length || attempt.conceptsMissed?.length
      ? [...new Set([...(attempt.conceptsIncluded ?? []), ...(attempt.conceptsMissed ?? [])])]
      : getConcepts(questionById.get(attempt.questionId) ?? questions[0]);

    for (const concept of concepts) {
      const current = performance[concept] ?? {
        seen: 0,
        correct: 0,
        partial: 0,
        incorrect: 0,
      };
      current.seen += 1;
      current[attempt.outcome] += 1;
      performance[concept] = current;
    }
  }

  return performance;
}

export interface DebugCodeStudyProps {
  questions: DebugCodeQuestion[];
  title?: string;
}

export function DebugCodeStudy({
  questions,
  title = "Software engineering foundations",
}: DebugCodeStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<DebugCodeGradingResult | null>(null);
  const [attempts, setAttempts] = useState<StudyAttempt[]>([]);
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(questions),
  );
  const [sessionStartMastery, setSessionStartMastery] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const questionStartedAtRef = useRef<number | null>(null);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0
    ? ((currentIndex + (result ? 1 : 0)) / questions.length) * 100
    : 0;

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [currentIndex]);

  const submitAnswer = useCallback(() => {
    if (!currentQuestion || result || !answer.trim()) return;

    const gradingResult = deterministicDebugCodeGrader.grade(
      currentQuestion,
      answer,
    );
    const attempt = createStudyAttemptFromGrade({
      id: createAttemptId(),
      question: currentQuestion,
      userAnswer: answer,
      grade: gradingResult,
      mode: "debug-code",
      conceptsIncluded: gradingResult.includedConcepts,
      conceptsMissed: gradingResult.missedConcepts,
      grader: gradingResult.grader,
      responseTimeMs: Math.max(
        0,
        Date.now() - (questionStartedAtRef.current ?? Date.now()),
      ),
      timestamp: new Date().toISOString(),
    });

    setAttempts((currentAttempts) => [...currentAttempts, attempt]);
    setStatsByQuestion((currentStats) =>
      applyAttemptToStats(currentStats, attempt),
    );
    setResult(gradingResult);
  }, [answer, currentQuestion, result]);

  const nextQuestion = useCallback(() => {
    if (!result) return;

    if (currentIndex >= questions.length - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setResult(null);
    questionStartedAtRef.current = Date.now();
  }, [currentIndex, questions.length, result]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (result) nextQuestion();
        else submitAnswer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextQuestion, result, submitAnswer]);

  const conceptPerformance = useMemo(
    () => buildConceptPerformance(attempts, questions),
    [attempts, questions],
  );
  const sessionScore = attempts.length
    ? Math.round(
        attempts.reduce((total, attempt) => total + (attempt.score ?? 0), 0) /
          attempts.length,
      )
    : 0;
  const masteryAfter = questions.reduce(
    (total, question) => total + (statsByQuestion[question.id]?.mastery ?? 0),
    0,
  );

  const restartSession = useCallback(() => {
    setCurrentIndex(0);
    setAnswer("");
    setResult(null);
    setAttempts([]);
    setIsComplete(false);
    setSessionStartMastery(masteryAfter);
    questionStartedAtRef.current = Date.now();
  }, [masteryAfter]);

  if (questions.length === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No Debug / Code questions are available yet.</p>
      </main>
    );
  }

  if (isComplete) {
    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header>
            <Link href="/" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to study</Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Debug / Code complete</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Keep debugging from memory.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Your answers are recorded through the shared attempt and mastery engine.</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Session score" value={formatScore(sessionScore)} tone="teal" />
              <SummaryStat label="Questions" value={attempts.length} />
              <SummaryStat label="Mastery change" value={`${masteryAfter - sessionStartMastery >= 0 ? "+" : ""}${masteryAfter - sessionStartMastery}`} tone={masteryAfter >= sessionStartMastery ? "emerald" : "rose"} />
              <SummaryStat label="Correct answers" value={attempts.filter((attempt) => attempt.outcome === "correct").length} tone="emerald" />
            </div>
          </section>

          <section className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-6">
            <h2 className="text-xl font-semibold">Concept performance</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(conceptPerformance).map(([concept, stats]) => (
                <div key={concept} className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{concept}</p>
                    <p className="font-mono text-xs text-[#66807a] dark:text-[#94aea7]">{stats.correct}/{stats.seen} correct</p>
                  </div>
                  <p className="mt-2 text-sm text-[#66807a] dark:text-[#94aea7]">{stats.partial} partial, {stats.incorrect} incorrect</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={restartSession} className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Study Again</button>
            <Link href="/smart-study" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Smart Study</Link>
          </div>
        </div>
      </main>
    );
  }

  const correctedCode = currentQuestion.correctedCode ?? currentQuestion.expectedCode;

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-5 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to study</Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Debug / Code</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-medium text-[#4c6862] dark:text-[#a3bbb5]">Question {currentIndex + 1} of {questions.length}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37] sm:w-48" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Debug study progress"><div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-300 dark:bg-[#2dd4bf]" style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[#e3f2ee] px-3 py-1.5 text-xs font-semibold text-[#0f766e] dark:bg-[#1f4039] dark:text-[#91e8d8]">{taskLabel(currentQuestion.task)}</span>
            <div className="flex flex-wrap gap-2">{getConcepts(currentQuestion).map((concept) => <span key={concept} className="rounded-lg border border-[#c8d9d5] px-2.5 py-1 text-xs font-semibold text-[#55716a] dark:border-[#3b5a54] dark:text-[#a8bdb7]">{concept}</span>)}</div>
          </div>

          <h2 className="mt-8 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion.problemStatement}</h2>
          <div className="mt-6"><CodeBlock code={currentQuestion.codeSnippet} language={currentQuestion.language} /></div>

          {!result ? (
            <div className="mt-8">
              <label htmlFor="debug-answer" className="text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]">{answerLabel(currentQuestion.task)}</label>
              <textarea id="debug-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-2xl border border-[#c8d9d5] bg-[#fbfdfc] px-4 py-3 text-base leading-7 text-[#16322e] outline-none transition placeholder:text-[#91aaa3] focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 dark:border-[#3b5a54] dark:bg-[#1e2d2a] dark:text-[#edf5f1] dark:placeholder:text-[#66807a] dark:focus:border-[#5eead4]" placeholder="Type your explanation or code..." />
              <button type="button" onClick={submitAnswer} disabled={!answer.trim()} className="mt-3 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Check Answer</button>
              <p className="mt-3 text-center font-mono text-xs text-[#66807a] dark:text-[#94aea7]">Ctrl + Enter to submit</p>
            </div>
          ) : (
            <DebugResult question={currentQuestion} result={result} correctedCode={correctedCode} onNext={nextQuestion} isLast={currentIndex === questions.length - 1} />
          )}
        </section>
      </div>
    </main>
  );
}

function DebugResult({
  question,
  result,
  correctedCode,
  onNext,
  isLast,
}: {
  question: DebugCodeQuestion;
  result: DebugCodeGradingResult;
  correctedCode?: string;
  onNext: () => void;
  isLast: boolean;
}) {
  const resultTone = result.outcome === "correct"
    ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
    : result.outcome === "partial"
      ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
      : "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100";

  return (
    <div className={`mt-8 rounded-2xl border p-5 ${resultTone}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Result</p>
          <h3 className="mt-2 text-2xl font-semibold capitalize">{result.outcome}</h3>
        </div>
        <p className="font-mono text-2xl font-semibold">Score {formatScore(result.score)}</p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <ConceptResult title="What you identified correctly" concepts={result.includedConcepts} emptyLabel="No tagged concepts matched yet." tone="emerald" />
        <ConceptResult title="What you missed" concepts={result.missedConcepts} emptyLabel="No tagged concepts were missed." tone="rose" />
      </div>

      <div className="mt-6 space-y-5 text-sm leading-7">
        <div>
          <p className="font-semibold">Expected explanation</p>
          <p className="mt-1">{result.expectedExplanation}</p>
        </div>
        {question.task === "predict-output" && question.expectedOutput && (
          <div>
            <p className="font-semibold">Expected output</p>
            <p className="mt-1 font-mono">{question.expectedOutput}</p>
          </div>
        )}
        {correctedCode && (
          <div>
            <p className="mb-2 font-semibold">Corrected code</p>
            <CodeBlock code={correctedCode} language={question.language} label="Correction" />
          </div>
        )}
      </div>

      <button type="button" onClick={onNext} className="mt-6 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">{isLast ? "Finish Session" : "Next Question"}</button>
    </div>
  );
}

function ConceptResult({ title, concepts, emptyLabel, tone }: { title: string; concepts: string[]; emptyLabel: string; tone: "emerald" | "rose" }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {concepts.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{concepts.map((concept) => <span key={concept} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${tone === "emerald" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100" : "bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100"}`}>{concept}</span>)}</div> : <p className="mt-1 opacity-75">{emptyLabel}</p>}
    </div>
  );
}

function SummaryStat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "teal" | "emerald" | "rose" }) {
  const toneClass = {
    neutral: "text-[#16322e] dark:text-[#edf5f1]",
    teal: "text-[#0f766e] dark:text-[#5eead4]",
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose: "text-rose-700 dark:text-rose-300",
  }[tone];

  return (
    <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
      <p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
