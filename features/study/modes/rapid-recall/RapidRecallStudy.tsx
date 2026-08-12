"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  createStudyAttemptFromGrade,
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
import {
  formatRapidRecallDuration,
  RAPID_RECALL_DURATIONS,
  shuffleRapidRecallQuestions,
  type RapidRecallDuration,
} from "./session";

interface RapidRecallFeedback {
  outcome: WriteGradingResult["outcome"];
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID() ?? `attempt-${Date.now()}`;
}

function formatTimer(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getFeedbackLabel(outcome: WriteGradingResult["outcome"]): string {
  if (outcome === "correct") return "✓ Correct";
  if (outcome === "partial") return "△ Partial";
  return "✕ Incorrect";
}

function getFeedbackClass(outcome: WriteGradingResult["outcome"]): string {
  if (outcome === "correct") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  if (outcome === "partial") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100";
  }
  return "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100";
}

function createRapidRecallAttempt(
  question: WriteQuestion,
  userAnswer: string,
  grade: WriteGradingResult,
  responseTimeMs: number | undefined,
  skipped = false,
): StudyAttempt {
  return createStudyAttemptFromGrade({
    id: createAttemptId(),
    question,
    userAnswer,
    grade,
    mode: "rapid-recall",
    skipped,
    conceptsIncluded: grade.includedConcepts,
    conceptsMissed: grade.missedConcepts,
    grader: grade.grader,
    responseTimeMs,
    timestamp: new Date().toISOString(),
  });
}

export interface RapidRecallStudyProps {
  questions: WriteQuestion[];
  title?: string;
}

export function RapidRecallStudy({
  questions,
  title = "Active recall foundations",
}: RapidRecallStudyProps) {
  const [selectedDuration, setSelectedDuration] =
    useState<RapidRecallDuration>(60);
  const [sessionQuestions, setSessionQuestions] = useState<WriteQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState<StudyAttempt[]>([]);
  const [feedback, setFeedback] = useState<RapidRecallFeedback | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(questions),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionEndAtRef = useRef<number | null>(null);
  const sessionDurationMsRef = useRef(0);
  const questionStartedAtRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const currentQuestion = sessionQuestions[currentIndex];
  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  const completeSession = useCallback(() => {
    if (!runningRef.current) return;

    runningRef.current = false;
    clearFeedbackTimeout();
    setIsRunning(false);
    setIsChecking(false);
    setFeedback(null);
    setAnswer("");

    const startedAt = sessionStartedAtRef.current ?? Date.now();
    const elapsed = Math.min(
      sessionDurationMsRef.current,
      Math.max(0, Date.now() - startedAt),
    );
    setElapsedMs(elapsed);
    setRemainingMs(0);
    setIsComplete(true);
    sessionEndAtRef.current = null;
  }, [clearFeedbackTimeout]);

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const endAt = sessionEndAtRef.current;
      if (!endAt) return;

      const nextRemaining = Math.max(0, endAt - Date.now());
      setRemainingMs(nextRemaining);

      if (nextRemaining === 0) completeSession();
    };

    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [completeSession, isRunning]);

  const focusInput = useCallback(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isRunning || isComplete || feedback || isChecking) return focusInput();
  }, [currentIndex, feedback, focusInput, isChecking, isComplete, isRunning]);

  const answerStats = useMemo(() => {
    const skipped = attempts.filter((attempt) => attempt.skipped).length;
    const answered = attempts.filter((attempt) => !attempt.skipped);
    const correct = answered.filter((attempt) => attempt.outcome === "correct").length;
    const partial = answered.filter((attempt) => attempt.outcome === "partial").length;
    const incorrect = answered.filter((attempt) => attempt.outcome === "incorrect").length;
    let streak = 0;
    let longestStreak = 0;

    for (const attempt of attempts) {
      streak = attempt.outcome === "correct" && !attempt.skipped ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    }

    return {
      answered,
      attempted: answered.length,
      correct,
      partial,
      incorrect,
      skipped,
      currentStreak: streak,
      longestStreak,
    };
  }, [attempts]);

  const topicsToReview = useMemo(() => {
    const counts = new Map<string, number>();

    for (const attempt of attempts) {
      if (attempt.outcome === "correct" && !attempt.skipped) continue;

      for (const concept of attempt.conceptsMissed ?? ["Uncategorized"]) {
        counts.set(concept, (counts.get(concept) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [attempts]);

  const missedQuestionIds = useMemo(
    () =>
      new Set(
        attempts
          .filter((attempt) => attempt.skipped || attempt.outcome !== "correct")
          .map((attempt) => attempt.questionId),
      ),
    [attempts],
  );
  const missedQuestions = useMemo(
    () => sessionQuestions.filter((question) => missedQuestionIds.has(question.id)),
    [missedQuestionIds, sessionQuestions],
  );
  const recordAttempt = useCallback((attempt: StudyAttempt) => {
    setAttempts((currentAttempts) => [...currentAttempts, attempt]);
    setStatsByQuestion((currentStats) =>
      applyAttemptToStats(currentStats, attempt),
    );
  }, []);

  const advanceQuestion = useCallback(() => {
    if (sessionQuestions.length === 0) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= sessionQuestions.length) {
      setSessionQuestions(shuffleRapidRecallQuestions(sessionQuestions));
      setCurrentIndex(0);
    } else {
      setCurrentIndex(nextIndex);
    }
    setAnswer("");
    setFeedback(null);
    questionStartedAtRef.current = Date.now();
  }, [currentIndex, sessionQuestions]);

  const scheduleNextQuestion = useCallback(() => {
    clearFeedbackTimeout();
    feedbackTimeoutRef.current = window.setTimeout(() => {
      feedbackTimeoutRef.current = null;
      if (!runningRef.current) return;

      if (
        sessionEndAtRef.current !== null &&
        Date.now() >= sessionEndAtRef.current
      ) {
        completeSession();
        return;
      }

      advanceQuestion();
    }, 650);
  }, [advanceQuestion, clearFeedbackTimeout, completeSession]);

  const submitAnswer = useCallback(async () => {
    if (
      !runningRef.current ||
      !currentQuestion ||
      feedback ||
      isChecking ||
      !answer.trim()
    ) {
      return;
    }

    const submittedAnswer = answer;
    setIsChecking(true);

    const grade = await deterministicWriteGrader.grade(
      currentQuestion,
      submittedAnswer,
    );
    const responseTimeMs =
      questionStartedAtRef.current === null
        ? undefined
        : Math.max(0, Date.now() - questionStartedAtRef.current);
    const attempt = createRapidRecallAttempt(
      currentQuestion,
      submittedAnswer,
      grade,
      responseTimeMs,
    );

    if (!runningRef.current) return;

    recordAttempt(attempt);
    setIsChecking(false);
    setAnswer("");
    setFeedback({ outcome: grade.outcome });
    scheduleNextQuestion();
  }, [answer, currentQuestion, feedback, isChecking, recordAttempt, scheduleNextQuestion]);

  const skipQuestion = useCallback(() => {
    if (!runningRef.current || !currentQuestion || feedback || isChecking) return;

    const grade: WriteGradingResult = {
      outcome: "incorrect",
      score: 0,
      expectedAnswer: currentQuestion.expectedAnswer,
      includedConcepts: [],
      missedConcepts: currentQuestion.importantKeywords,
      explanation: currentQuestion.explanation,
      grader: "deterministic",
    };
    recordAttempt(
      createRapidRecallAttempt(currentQuestion, "", grade, undefined, true),
    );
    advanceQuestion();
  }, [advanceQuestion, currentQuestion, feedback, isChecking, recordAttempt]);

  const startSession = useCallback(
    (nextQuestions: WriteQuestion[], duration = selectedDuration) => {
      if (nextQuestions.length === 0) return;

      clearFeedbackTimeout();
      const now = Date.now();
      const durationMs = duration * 1000;
      sessionDurationMsRef.current = durationMs;
      sessionStartedAtRef.current = now;
      sessionEndAtRef.current = now + durationMs;
      questionStartedAtRef.current = now;
      runningRef.current = true;

      setSelectedDuration(duration);
      setSessionQuestions(shuffleRapidRecallQuestions(nextQuestions));
      setCurrentIndex(0);
      setAnswer("");
      setAttempts([]);
      setFeedback(null);
      setRemainingMs(durationMs);
      setElapsedMs(0);
      setIsComplete(false);
      setIsChecking(false);
      setIsRunning(true);
    }, [clearFeedbackTimeout, selectedDuration]);

  useEffect(() => {
    if (!isRunning) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skipQuestion();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, skipQuestion]);

  useEffect(() => clearFeedbackTimeout, [clearFeedbackTimeout]);

  if (questions.length === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No rapid recall questions are available yet.</p>
      </main>
    );
  }

  if (!isRunning && !isComplete) {
    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-5 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]"><span className="h-2 w-2 rounded-full bg-[#0f766e] dark:bg-[#5eead4]" aria-hidden="true" />Rapid recall</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Review more in less time.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Answer from memory, get a quick signal, and keep moving until the timer ends.</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <p className="text-sm font-semibold text-[#55716a] dark:text-[#a8bdb7]">Choose a sprint length</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RAPID_RECALL_DURATIONS.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setSelectedDuration(duration)}
                  aria-pressed={selectedDuration === duration}
                  className={`min-h-16 rounded-xl border px-3 py-3 text-sm font-semibold transition active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:focus-visible:outline-[#5eead4] ${selectedDuration === duration ? "border-[#0f766e] bg-[#e7f3ef] text-[#0f5f58] ring-2 ring-[#0f766e]/15 dark:border-[#5eead4] dark:bg-[#203a34] dark:text-[#c3f4ea] dark:ring-[#5eead4]/15" : "border-[#cfdfdb] bg-[#f6faf8] text-[#55716a] hover:border-[#8bb8ad] dark:border-[#36514b] dark:bg-[#1d2d2a] dark:text-[#a8bdb7] dark:hover:border-[#5e9e90]"}`}
                >
                  {formatRapidRecallDuration(duration)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => startSession(questions)}
              className="mt-6 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
            >
              Start Rapid Recall
            </button>
            <p className="mt-4 text-center text-sm text-[#66807a] dark:text-[#94aea7]">During the sprint: Enter submits, Escape skips.</p>
          </section>
        </div>
      </main>
    );
  }

  if (isComplete) {
    const accuracy = answerStats.attempted
      ? Math.round((answerStats.correct / answerStats.attempted) * 100)
      : 0;
    const questionsPerMinute = elapsedMs
      ? attempts.length / (elapsedMs / 60000)
      : 0;

    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-5 py-6 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Time is up</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Rapid recall results</h1>
            <p className="mt-3 text-[#55716a] dark:text-[#a8bdb7]">{title}</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Questions attempted" value={answerStats.attempted} />
              <SummaryStat label="Accuracy" value={`${accuracy}%`} tone={accuracy >= 70 ? "emerald" : "amber"} />
              <SummaryStat label="Longest streak" value={answerStats.longestStreak} tone="emerald" />
              <SummaryStat label="Questions/minute" value={questionsPerMinute.toFixed(1)} />
              <SummaryStat label="Correct" value={answerStats.correct} tone="emerald" />
              <SummaryStat label="Partial" value={answerStats.partial} tone="amber" />
              <SummaryStat label="Incorrect" value={answerStats.incorrect} tone="rose" />
              <SummaryStat label="Skipped" value={answerStats.skipped} />
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Topics to Review</h2>
              {topicsToReview.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {topicsToReview.map(([topic, count]) => (
                    <li key={topic} className="flex items-center justify-between rounded-xl bg-[#f3f8f6] px-4 py-3 text-sm dark:bg-[#1e2d2a]"><span>{topic}</span><span className="font-mono text-xs text-[#66807a] dark:text-[#94aea7]">{count} missed</span></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#66807a] dark:text-[#94aea7]">No topics need review from this sprint.</p>
              )}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => startSession(missedQuestions)} disabled={missedQuestions.length === 0} className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Study Mistakes</button>
              <button type="button" onClick={() => startSession(sessionQuestions)} className="min-h-12 rounded-xl border border-[#b9cfca] bg-transparent px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Try Again</button>
              <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Flashcards</Link>
              <button type="button" onClick={() => startSession(missedQuestions)} disabled={missedQuestions.length === 0} className="min-h-12 rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Weak Areas</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const timerIsLow = remainingMs <= 10000;

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-4 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]"><span className="h-2 w-2 rounded-full bg-[#0f766e] dark:bg-[#5eead4]" aria-hidden="true" />Rapid recall</div>
            <p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">{title}</p>
          </div>
          <div className={`font-mono text-3xl font-semibold tabular-nums sm:text-4xl ${timerIsLow ? "text-rose-600 dark:text-rose-300" : "text-[#16322e] dark:text-[#edf5f1]"}`} aria-live="polite" aria-label={`${formatTimer(remainingMs)} remaining`}>{formatTimer(remainingMs)}</div>
        </header>

        <div className="grid grid-cols-3 gap-2">
          <LiveStat label="Correct" value={answerStats.correct} tone="emerald" />
          <LiveStat label="Streak" value={answerStats.currentStreak} tone="teal" />
          <LiveStat label="Attempted" value={answerStats.attempted} />
        </div>

        <section className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8" aria-labelledby="rapid-recall-question">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Answer quickly</p>
          <h1 id="rapid-recall-question" className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion?.question}</h1>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitAnswer();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  skipQuestion();
                }
              }}
              disabled={Boolean(feedback) || isChecking}
              autoComplete="off"
              autoCapitalize="sentences"
              placeholder="Type your answer, then press Enter"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#b9cfca] bg-[#f8fbfa] px-4 py-3 text-base text-[#16322e] outline-none transition placeholder:text-[#87a19a] focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/10 disabled:cursor-default disabled:opacity-70 dark:border-[#3b5a54] dark:bg-[#1b2a27] dark:text-[#edf5f1] dark:placeholder:text-[#76918a] dark:focus:border-[#5eead4] dark:focus:ring-[#5eead4]/10"
            />
            <button type="button" onClick={skipQuestion} disabled={Boolean(feedback) || isChecking} className="min-h-12 rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#edf5f2] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Skip</button>
          </div>

          {feedback && <div className={`mt-5 rounded-xl border px-4 py-3 text-lg font-semibold ${getFeedbackClass(feedback.outcome)}`} aria-live="assertive">{getFeedbackLabel(feedback.outcome)}</div>}
        </section>

        <div className="flex items-center justify-between text-sm text-[#66807a] dark:text-[#94aea7]"><p>Enter submit <span className="px-1">|</span> Escape skip</p><p className="font-mono text-xs">{answerStats.currentStreak} current streak</p></div>
      </div>
    </main>
  );
}

function LiveStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "emerald" | "teal" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : tone === "teal" ? "text-[#0f766e] dark:text-[#5eead4]" : "text-[#16322e] dark:text-[#edf5f1]";
  return <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-3 dark:border-[#2d4440] dark:bg-[#1e2d2a]"><p className="text-xs text-[#66807a] dark:text-[#94aea7]">{label}</p><p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p></div>;
}

function SummaryStat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "rose" | "amber" | "emerald" }) {
  const toneClass = { neutral: "text-[#16322e] dark:text-[#edf5f1]", rose: "text-rose-700 dark:text-rose-300", amber: "text-amber-700 dark:text-amber-300", emerald: "text-emerald-700 dark:text-emerald-300" }[tone];
  return <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]"><p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p><p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p></div>;
}
