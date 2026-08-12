"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createFlashcardAttempt,
  createStudyAttempt,
  createStudyAttemptFromGrade,
} from "../../domain/engine";
import type {
  FlashcardRating,
  StudyAttempt,
  StudyMode,
  StudyQuestion,
  WriteQuestion,
} from "../../domain/types";
import type { WriteGradingResult } from "../../grading/write-grader";
import { scoreTextAnswerDetailed } from "../../grading/text-scoring";
import {
  deterministicDebugCodeGrader,
  type DebugCodeGradingResult,
} from "../../grading/debug-code-grader";
import {
  applyAttemptToStats,
  createStatsForQuestions,
  getStatsForQuestion,
  type StatsByQuestion,
} from "../../session/recording";
import {
  getModeLabel,
  getNextDifficultyLevel,
  getPreferredMode,
  selectNextSmartQuestion,
  type SmartDifficultyLevel,
  type SmartStudyCandidate,
} from "./selection";
import { prepareMultipleChoiceSession, type MultipleChoiceOption } from "../multiple-choice/session";
import { CodeBlock } from "../debug-code/CodeBlock";

type SmartDuration = 0 | 300 | 600 | 1200;

const SMART_DURATIONS: Array<{ value: SmartDuration; label: string }> = [
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1200, label: "20 minutes" },
  { value: 0, label: "Unlimited" },
];

const FLASHCARD_RATINGS: FlashcardRating[] = ["again", "hard", "good", "easy"];

interface SmartFeedback {
  attempt: StudyAttempt;
  nextLevel: SmartDifficultyLevel;
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID() ?? `smart-attempt-${Date.now()}`;
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatStudyTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`;
}

function questionPrompt(question: StudyQuestion): string {
  switch (question.type) {
    case "flashcard":
      return question.prompt;
    case "multiple-choice":
    case "write":
    case "debug-code":
      return question.type === "debug-code"
        ? question.problemStatement
        : question.question;
  }
}

function asWriteQuestion(question: StudyQuestion): WriteQuestion {
  switch (question.type) {
    case "write":
      return question;
    case "debug-code":
      return {
        id: question.id,
        studySetId: question.studySetId,
        type: "write",
        concepts: question.concepts,
        question: question.problemStatement,
        expectedAnswer: question.expectedExplanation,
        importantKeywords: question.concepts ?? [],
        explanation: question.correctedCode,
      };
    case "flashcard":
      return {
        id: question.id,
        studySetId: question.studySetId,
        type: "write",
        concepts: question.concepts,
        question: question.prompt,
        expectedAnswer: question.answer,
        importantKeywords: question.concepts ?? [],
        explanation: question.explanation,
      };
    case "multiple-choice":
      return {
        id: question.id,
        studySetId: question.studySetId,
        type: "write",
        concepts: question.concepts,
        question: question.question,
        expectedAnswer: question.correctAnswer,
        importantKeywords: question.concepts ?? [],
        explanation: question.explanation,
      };
  }
}

function getQuestionConcepts(question: StudyQuestion): string[] {
  return question.concepts ?? ["General recall"];
}

function createTextAttempt(
  question: StudyQuestion,
  mode: StudyMode,
  userAnswer: string,
  responseTimeMs: number,
): { attempt: StudyAttempt; grade: WriteGradingResult | DebugCodeGradingResult } {
  if (question.type === "debug-code") {
    const grade = deterministicDebugCodeGrader.grade(question, userAnswer);
    const attempt = createStudyAttemptFromGrade({
      id: createAttemptId(),
      question,
      userAnswer,
      grade,
      mode,
      conceptsIncluded: grade.includedConcepts,
      conceptsMissed: grade.missedConcepts,
      grader: grade.grader,
      responseTimeMs,
      timestamp: new Date().toISOString(),
    });

    return { attempt, grade };
  }

  const writeQuestion = asWriteQuestion(question);
  const scored = scoreTextAnswerDetailed(
    writeQuestion.expectedAnswer,
    userAnswer,
    writeQuestion.importantKeywords,
  );
  const grade: WriteGradingResult = {
    ...scored,
    expectedAnswer: writeQuestion.expectedAnswer,
    explanation: writeQuestion.explanation,
    grader: "deterministic",
  };
  const attempt = createStudyAttemptFromGrade({
    id: createAttemptId(),
    question,
    userAnswer,
    grade,
    mode,
    conceptsIncluded: grade.includedConcepts,
    conceptsMissed: grade.missedConcepts,
    grader: grade.grader,
    responseTimeMs,
    timestamp: new Date().toISOString(),
  });

  return { attempt, grade };
}

function getAttemptScore(attempt: StudyAttempt): number {
  return attempt.score ?? (attempt.outcome === "correct" ? 100 : 0);
}

export interface SmartStudyProps {
  questions: StudyQuestion[];
  title?: string;
}

export function SmartStudy({
  questions,
  title = "Active recall foundations",
}: SmartStudyProps) {
  const [duration, setDuration] = useState<SmartDuration>(600);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<StudyQuestion[]>(questions);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<StudyMode | null>(null);
  const [currentOptions, setCurrentOptions] = useState<MultipleChoiceOption[]>([]);
  const [targetLevel, setTargetLevel] = useState<SmartDifficultyLevel>(1);
  const [answer, setAnswer] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [feedback, setFeedback] = useState<SmartFeedback | null>(null);
  const [attempts, setAttempts] = useState<StudyAttempt[]>([]);
  const [recentModes, setRecentModes] = useState<StudyMode[]>([]);
  const [statsByQuestion, setStatsByQuestion] = useState<StatsByQuestion>(() =>
    createStatsForQuestions(questions),
  );
  const [remainingMs, setRemainingMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionStartMastery, setSessionStartMastery] = useState(0);
  const [selectedDurationLabel, setSelectedDurationLabel] = useState("10 minutes");
  const sessionStartedAtRef = useRef<number | null>(null);
  const questionStartedAtRef = useRef<number | null>(null);

  const currentQuestion = activeQuestions.find(
    (question) => question.id === currentQuestionId,
  );
  const currentAnswerAttempted = Boolean(feedback);

  const candidatesFor = useCallback(
    (sessionQuestions: StudyQuestion[], currentStats: StatsByQuestion) =>
      sessionQuestions.map((question) => ({
        question,
        stats: getStatsForQuestion(currentStats, question),
      })),
    [],
  );

  const chooseNextQuestion = useCallback(
    (
      sessionQuestions: StudyQuestion[],
      currentStats: StatsByQuestion,
      previousQuestionId: string | undefined,
      nextLevel: SmartDifficultyLevel,
      currentAttempts: StudyAttempt[],
      currentRecentModes: StudyMode[],
    ) =>
      selectNextSmartQuestion(
        candidatesFor(sessionQuestions, currentStats),
        {
          now: new Date(),
          previousQuestionId,
          targetLevel: nextLevel,
          recentAttempts: currentAttempts,
          recentModes: currentRecentModes,
        },
        Math.random,
      ),
    [candidatesFor],
  );

  const setCurrentQuestion = useCallback(
    (candidate: SmartStudyCandidate | undefined, level: SmartDifficultyLevel, modes: StudyMode[]) => {
      if (!candidate) {
        setCurrentQuestionId(null);
        setCurrentMode(null);
        setCurrentOptions([]);
        return;
      }

      const mode = getPreferredMode(candidate.question, level, modes);
      setCurrentQuestionId(candidate.question.id);
      setCurrentMode(mode);
      setCurrentOptions(
        candidate.question.type === "multiple-choice"
          ? prepareMultipleChoiceSession([candidate.question])[0]?.options ?? []
          : [],
      );
      setAnswer("");
      setIsRevealed(false);
      questionStartedAtRef.current = Date.now();
    },
    [],
  );

  const beginSession = useCallback(
    (sessionQuestions: StudyQuestion[] = questions) => {
      if (sessionQuestions.length === 0) return;

      const masteryBefore = sessionQuestions.reduce(
        (total, question) => total + (statsByQuestion[question.id]?.mastery ?? 0),
        0,
      );
      const first = chooseNextQuestion(
        sessionQuestions,
        statsByQuestion,
        undefined,
        1,
        [],
        [],
      );

      setActiveQuestions(sessionQuestions);
      setAttempts([]);
      setRecentModes([]);
      setTargetLevel(1);
      setFeedback(null);
      setSessionStartMastery(masteryBefore);
      setElapsedMs(0);
      setRemainingMs(duration === 0 ? 0 : duration * 1000);
      setIsComplete(false);
      setIsRunning(true);
      sessionStartedAtRef.current = Date.now();
      setCurrentQuestion(first, 1, []);
    },
    [chooseNextQuestion, duration, questions, setCurrentQuestion, statsByQuestion],
  );

  const finishSession = useCallback(() => {
    if (!isRunning) return;

    const startedAt = sessionStartedAtRef.current ?? Date.now();
    const elapsed = Math.max(0, Date.now() - startedAt);
    setElapsedMs(duration === 0 ? elapsed : Math.min(elapsed, duration * 1000));
    setRemainingMs(0);
    setIsRunning(false);
    setFeedback(null);
    setAnswer("");
    setIsComplete(true);
  }, [duration, isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const startedAt = sessionStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      setElapsedMs(duration === 0 ? elapsed : Math.min(elapsed, duration * 1000));

      if (duration > 0) {
        const nextRemaining = Math.max(0, duration * 1000 - elapsed);
        setRemainingMs(nextRemaining);
        if (nextRemaining === 0) finishSession();
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [duration, finishSession, isRunning]);

  const recordAttempt = useCallback(
    (attempt: StudyAttempt) => {
      const nextLevel = getNextDifficultyLevel(targetLevel, attempt.outcome);
      const nextRecentModes = [...recentModes, attempt.mode].slice(-6);

      setAttempts((currentAttempts) => [...currentAttempts, attempt]);
      setRecentModes(nextRecentModes);
      setTargetLevel(nextLevel);
      setStatsByQuestion((currentStats) =>
        applyAttemptToStats(currentStats, attempt),
      );
      setFeedback({ attempt, nextLevel });
    },
    [recentModes, targetLevel],
  );

  const responseTime = () =>
    Math.max(0, Date.now() - (questionStartedAtRef.current ?? Date.now()));

  const submitAnswer = useCallback(
    (userAnswer: string) => {
      if (!isRunning || !currentQuestion || !currentMode || feedback) return;
      if (!userAnswer.trim()) return;

      if (currentMode === "flashcard") return;

      const attempt =
        currentMode === "multiple-choice"
          ? createStudyAttempt({
              id: createAttemptId(),
              question: currentQuestion,
              userAnswer,
              responseTimeMs: responseTime(),
              timestamp: new Date().toISOString(),
            })
          : createTextAttempt(
              currentQuestion,
              currentMode,
              userAnswer,
              responseTime(),
            ).attempt;

      recordAttempt(attempt);
    },
    [currentMode, currentQuestion, feedback, isRunning, recordAttempt],
  );

  const rateFlashcard = useCallback(
    (rating: FlashcardRating) => {
      if (
        !isRunning ||
        !currentQuestion ||
        currentQuestion.type !== "flashcard" ||
        !isRevealed ||
        feedback
      ) {
        return;
      }

      recordAttempt(
        createFlashcardAttempt({
          id: createAttemptId(),
          question: currentQuestion,
          rating,
          responseTimeMs: responseTime(),
          timestamp: new Date().toISOString(),
        }),
      );
    },
    [currentQuestion, feedback, isRevealed, isRunning, recordAttempt],
  );

  const skipQuestion = useCallback(() => {
    if (!isRunning || !currentQuestion || feedback) return;

    const attempt = createStudyAttemptFromGrade({
      id: createAttemptId(),
      question: currentQuestion,
      userAnswer: "",
      grade: { outcome: "incorrect", score: 0 },
      mode: currentMode ?? currentQuestion.type,
      skipped: true,
      conceptsMissed: getQuestionConcepts(currentQuestion),
      responseTimeMs: responseTime(),
      timestamp: new Date().toISOString(),
    });
    recordAttempt(attempt);
  }, [currentMode, currentQuestion, feedback, isRunning, recordAttempt]);

  const nextQuestion = useCallback(() => {
    if (!feedback || activeQuestions.length === 0) return;

    const nextAttempts = [...attempts, feedback.attempt];
    const nextModes = [...recentModes, feedback.attempt.mode].slice(-6);
    const next = chooseNextQuestion(
      activeQuestions,
      statsByQuestion,
      currentQuestionId ?? undefined,
      feedback.nextLevel,
      nextAttempts,
      nextModes,
    );
    setTargetLevel(feedback.nextLevel);
    setCurrentQuestion(next, feedback.nextLevel, nextModes);
    setFeedback(null);
  }, [activeQuestions, attempts, chooseNextQuestion, currentQuestionId, feedback, recentModes, setCurrentQuestion, statsByQuestion]);

  useEffect(() => {
    if (!isRunning || feedback) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      const isTextEntry =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        event.preventDefault();
        skipQuestion();
        return;
      }

      if (isTextEntry) return;

      if (currentMode === "flashcard" && event.code === "Space") {
        event.preventDefault();
        setIsRevealed(true);
        return;
      }

      if (currentMode === "multiple-choice") {
        const optionIndex = Number(event.key) - 1;
        if (optionIndex >= 0 && optionIndex < currentOptions.length) {
          event.preventDefault();
          submitAnswer(currentOptions[optionIndex].text);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMode, currentOptions, feedback, isRunning, skipQuestion, submitAnswer]);

  const sessionStats = useMemo(() => {
    const correct = attempts.filter((attempt) => attempt.outcome === "correct").length;
    const partial = attempts.filter((attempt) => attempt.outcome === "partial").length;
    const incorrect = attempts.filter((attempt) => attempt.outcome === "incorrect").length;
    const score = attempts.length
      ? Math.round(
          attempts.reduce((total, attempt) => total + getAttemptScore(attempt), 0) /
            attempts.length,
        )
      : 0;

    return { correct, partial, incorrect, score };
  }, [attempts]);

  const mistakeQuestionIds = useMemo(
    () =>
      new Set(
        attempts
          .filter((attempt) => attempt.outcome !== "correct" || attempt.skipped)
          .map((attempt) => attempt.questionId),
      ),
    [attempts],
  );
  const mistakeQuestions = useMemo(
    () => questions.filter((question) => mistakeQuestionIds.has(question.id)),
    [mistakeQuestionIds, questions],
  );

  const conceptsImproved = useMemo(
    () =>
      [...new Set(
        attempts
          .filter((attempt) => attempt.outcome === "correct")
          .flatMap((attempt) => attempt.conceptsIncluded?.length ? attempt.conceptsIncluded : getQuestionConcepts(questions.find((question) => question.id === attempt.questionId) ?? questions[0])),
      )],
    [attempts, questions],
  );
  const conceptsStillWeak = useMemo(
    () =>
      [...new Set(
        attempts
          .filter((attempt) => attempt.outcome !== "correct" || attempt.skipped)
          .flatMap((attempt) => attempt.conceptsMissed?.length ? attempt.conceptsMissed : getQuestionConcepts(questions.find((question) => question.id === attempt.questionId) ?? questions[0])),
      )],
    [attempts, questions],
  );

  if (questions.length === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f5] px-5 py-10 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1]">
        <p>No questions are available for Smart Study yet.</p>
      </main>
    );
  }

  if (!isRunning && !isComplete) {
    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <header className="max-w-3xl">
            <Link href="/" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">
              Back to study
            </Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">
              Recommended
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
              Smart Study
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">
              A focused session that starts with easier retrieval, finds weak concepts, and increases the challenge as your recall improves.
            </p>
          </header>

          <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">How long do you have?</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {SMART_DURATIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDuration(option.value);
                      setSelectedDurationLabel(option.label);
                    }}
                    aria-pressed={duration === option.value}
                    className={`min-h-16 rounded-2xl border px-4 py-3 text-left font-semibold transition active:translate-y-px ${duration === option.value ? "border-[#0f766e] bg-[#e3f2ee] text-[#0f5f58] ring-2 ring-[#0f766e]/20 dark:border-[#5eead4] dark:bg-[#183b35] dark:text-[#c4f4e8]" : "border-[#c8d9d5] bg-[#fbfdfc] text-[#35645c] hover:bg-white dark:border-[#2d4944] dark:bg-[#182320] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-6 dark:border-[#2d4440] dark:bg-[#182320]">
              <p className="text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">{selectedDurationLabel} session</p>
              <p className="mt-3 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">
                Smart Study will mix recall formats and use your answers to decide what deserves attention next.
              </p>
              <button
                type="button"
                onClick={() => beginSession()}
                className="mt-6 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
              >
                Start Smart Study
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (isComplete) {
    const masteryAfter = activeQuestions.reduce(
      (total, question) => total + (statsByQuestion[question.id]?.mastery ?? 0),
      0,
    );
    const masteryChange = masteryAfter - sessionStartMastery;

    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Session complete</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Smart Study complete</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">You spent {formatStudyTime(elapsedMs)} turning recall into useful feedback.</p>
          </header>

          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Session score" value={`${sessionStats.score}%`} tone="teal" />
              <ResultStat label="Mastery before → after" value={`${sessionStartMastery} → ${masteryAfter}`} tone={masteryChange >= 0 ? "emerald" : "rose"} />
              <ResultStat label="Questions completed" value={attempts.length} />
              <ResultStat label="Time studied" value={formatStudyTime(elapsedMs)} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ResultStat label="Correct" value={sessionStats.correct} tone="emerald" />
              <ResultStat label="Partial" value={sessionStats.partial} tone="amber" />
              <ResultStat label="Incorrect" value={sessionStats.incorrect} tone="rose" />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <ConceptList title="Concepts improved" concepts={conceptsImproved} emptyLabel="Keep answering to build a stronger signal." tone="emerald" />
            <ConceptList title="Concepts still weak" concepts={conceptsStillWeak} emptyLabel="No weak concepts detected in this session." tone="rose" />
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => beginSession()}
              className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]"
            >
              Continue Smart Study
            </button>
            <button
              type="button"
              onClick={() => beginSession(mistakeQuestions)}
              disabled={mistakeQuestions.length === 0}
              className="min-h-12 flex-1 rounded-xl border border-[#b9cfca] bg-transparent px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"
            >
              Review Mistakes
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentQuestion || !currentMode) return null;

  const feedbackGrade = feedback?.attempt;
  const textQuestion = currentQuestion ? asWriteQuestion(currentQuestion) : null;

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-5 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Smart Study</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="text-right">
              <p className="font-mono text-2xl font-semibold tabular-nums text-[#0f766e] dark:text-[#5eead4]">{duration === 0 ? formatClock(elapsedMs) : formatClock(remainingMs)}</p>
              <p className="text-xs text-[#66807a] dark:text-[#94aea7]">{duration === 0 ? "elapsed" : "remaining"}</p>
            </div>
            <button type="button" onClick={finishSession} className="min-h-10 rounded-xl border border-[#b9cfca] px-3 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">End session</button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Live session stats">
          <LiveStat label="Completed" value={attempts.length} />
          <LiveStat label="Correct" value={sessionStats.correct} tone="emerald" />
          <LiveStat label="Current level" value={targetLevel} />
          <LiveStat label="Modes used" value={new Set(recentModes).size} />
        </section>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[#e3f2ee] px-3 py-1.5 text-xs font-semibold text-[#0f766e] dark:bg-[#1f4039] dark:text-[#91e8d8]">{getModeLabel(currentMode)}</span>
            <span className="text-sm text-[#66807a] dark:text-[#94aea7]">Level {targetLevel} of 4</span>
          </div>

          <div className="mt-10">
            {currentMode === "multiple-choice" && currentQuestion.type === "multiple-choice" ? (
              <>
                <h2 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion.question}</h2>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {currentOptions.map((option, index) => {
                    const isCorrect = option.text === currentQuestion.correctAnswer;
                    const isSelected = feedbackGrade?.userAnswer === option.text;
                    const optionClass = feedback
                      ? isCorrect
                        ? "border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
                        : isSelected
                          ? "border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100"
                          : "border-[#d5e2df] bg-[#f3f8f6] text-[#66807a] dark:border-[#2d4440] dark:bg-[#1e2d2a] dark:text-[#829d96]"
                      : "border-[#c8d9d5] bg-[#fbfdfc] text-[#24564e] hover:border-[#0f766e] hover:bg-[#edf5f2] dark:border-[#3b5a54] dark:bg-[#182320] dark:text-[#b8e4da] dark:hover:border-[#5eead4] dark:hover:bg-[#20332f]";
                    return (
                      <button key={option.id} type="button" disabled={currentAnswerAttempted} onClick={() => submitAnswer(option.text)} className={`min-h-16 rounded-2xl border px-4 py-3 text-left font-semibold transition active:translate-y-px disabled:cursor-default ${optionClass}`}>
                        <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-current/20 text-sm">{index + 1}</span>
                        {option.text}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : currentMode === "flashcard" && currentQuestion.type === "flashcard" ? (
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Prompt</p>
                <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{currentQuestion.prompt}</h2>
                {!isRevealed && !feedback ? (
                  <button type="button" onClick={() => setIsRevealed(true)} className="mt-10 min-h-12 rounded-xl bg-[#0f766e] px-8 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Show Answer</button>
                ) : (
                  <>
                    <p className="mx-auto mt-8 max-w-2xl text-2xl font-semibold leading-tight text-[#24564e] dark:text-[#c5ebe2] sm:text-4xl">{currentQuestion.answer}</p>
                    {currentQuestion.explanation && <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#66807a] dark:text-[#a8bdb7]">{currentQuestion.explanation}</p>}
                    {!feedback && <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">{FLASHCARD_RATINGS.map((rating) => <button key={rating} type="button" onClick={() => rateFlashcard(rating)} className="min-h-14 rounded-xl border border-[#c8d9d5] bg-[#f3f8f6] px-3 py-2 font-semibold capitalize text-[#24564e] transition hover:border-[#0f766e] hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:bg-[#1e2d2a] dark:text-[#b8e4da] dark:hover:border-[#5eead4] dark:hover:bg-[#20332f]">{rating}</button>)}</div>}
                  </>
                )}
              </div>
            ) : currentMode === "debug-code" && currentQuestion.type === "debug-code" ? (
              <>
                <h2 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{currentQuestion.problemStatement}</h2>
                <div className="mt-6"><CodeBlock code={currentQuestion.codeSnippet} language={currentQuestion.language} /></div>
                <AnswerBox value={answer} onChange={setAnswer} onSubmit={() => submitAnswer(answer)} label="Explain the bug and the fix" buttonLabel="Check Explanation" disabled={Boolean(feedback)} />
              </>
            ) : (
              <>
                <h2 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{questionPrompt(currentQuestion)}</h2>
                <AnswerBox value={answer} onChange={setAnswer} onSubmit={() => submitAnswer(answer)} label={currentMode === "rapid-recall" ? "Short answer" : "Answer from memory"} buttonLabel="Check Answer" disabled={Boolean(feedback)} />
              </>
            )}
          </div>

          {feedback && (
            <div className={`mt-8 rounded-2xl border p-5 ${feedback.attempt.outcome === "correct" ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100" : feedback.attempt.outcome === "partial" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100" : "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-semibold capitalize">{feedback.attempt.outcome}</p>
                <p className="font-mono text-sm font-semibold">{getAttemptScore(feedback.attempt)} / 100</p>
              </div>
              {textQuestion && currentMode !== "multiple-choice" && currentMode !== "flashcard" && <p className="mt-3 text-sm leading-6">Expected answer: {textQuestion.expectedAnswer}</p>}
              {currentQuestion.type === "multiple-choice" && <p className="mt-3 text-sm leading-6">{currentQuestion.explanation ?? `Correct answer: ${currentQuestion.correctAnswer}`}</p>}
              {currentQuestion.type === "debug-code" && currentQuestion.correctedCode && <div className="mt-4"><CodeBlock code={currentQuestion.correctedCode} language={currentQuestion.language} label="Correction" /></div>}
              <button type="button" onClick={nextQuestion} className="mt-5 min-h-11 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Next Question</button>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-2 text-sm text-[#66807a] dark:text-[#94aea7] sm:flex-row sm:items-center sm:justify-between">
          <p>{feedback ? "Use the feedback, then continue when ready." : "Smart Study adapts after every answer."}</p>
          <p className="font-mono text-xs tracking-wide">1-4 choose <span className="px-1">|</span> Space reveal <span className="px-1">|</span> Escape skip</p>
        </div>
      </div>
    </main>
  );
}

function AnswerBox({
  value,
  onChange,
  onSubmit,
  label,
  buttonLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  buttonLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="mt-8">
      <label className="text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]">{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} rows={4} className="mt-2 w-full resize-y rounded-2xl border border-[#c8d9d5] bg-[#fbfdfc] px-4 py-3 text-base leading-7 text-[#16322e] outline-none transition placeholder:text-[#91aaa3] focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 disabled:opacity-60 dark:border-[#3b5a54] dark:bg-[#1e2d2a] dark:text-[#edf5f1] dark:placeholder:text-[#66807a] dark:focus:border-[#5eead4]" placeholder="Type what you remember..." />
      <button type="button" onClick={onSubmit} disabled={disabled || !value.trim()} className="mt-3 min-h-11 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">{buttonLabel}</button>
    </div>
  );
}

function LiveStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "emerald" }) {
  return (
    <div className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] px-4 py-4 dark:border-[#2d4440] dark:bg-[#182320]">
      <p className="text-xs text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-[#16322e] dark:text-[#edf5f1]"}`}>{value}</p>
    </div>
  );
}

function ResultStat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "teal" | "emerald" | "amber" | "rose" }) {
  const toneClass = {
    neutral: "text-[#16322e] dark:text-[#edf5f1]",
    teal: "text-[#0f766e] dark:text-[#5eead4]",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
  }[tone];

  return (
    <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
      <p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ConceptList({ title, concepts, emptyLabel, tone }: { title: string; concepts: string[]; emptyLabel: string; tone: "emerald" | "rose" }) {
  return (
    <section className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320]">
      <h2 className="text-lg font-semibold">{title}</h2>
      {concepts.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{concepts.map((concept) => <span key={concept} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tone === "emerald" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"}`}>{concept}</span>)}</div> : <p className="mt-3 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">{emptyLabel}</p>}
    </section>
  );
}
