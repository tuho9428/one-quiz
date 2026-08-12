"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { canStudyItemInMode } from "../domain/eligibility";
import type { StudyQuestion } from "../domain/types";

interface StudyModeChooserProps {
  setId: string;
  selectedQuestions: StudyQuestion[];
  onClose: () => void;
}

const modes = [
  { key: "flashcards", label: "Flashcards", description: "Quick recall and spaced repetition", eligibility: "flashcard" as const },
  { key: "write", label: "Write", description: "Recall answers without hints", eligibility: "write" as const },
  { key: "multiple-choice", label: "Multiple Choice", description: "Recognize the answer, then confirm why", eligibility: "multiple-choice" as const },
  { key: "rapid-recall", label: "Rapid Recall", description: "Answer as many as possible against the clock", eligibility: "rapid-recall" as const },
  { key: "debug-code", label: "Debug / Code", description: "Explain bugs, behavior, and fixes", eligibility: "debug-code" as const },
  { key: "smart-study", label: "Smart Study", description: "Adapt difficulty and mode within this selection", eligibility: "smart-study" as const },
];

function modeHref(setId: string, mode: string, questions: StudyQuestion[]): string {
  const ids = questions.map((question) => question.id).join(",");
  return `/sets/${encodeURIComponent(setId)}/study/${mode}?items=${encodeURIComponent(ids)}`;
}

export function StudyModeChooser({ setId, selectedQuestions, onClose }: StudyModeChooserProps) {
  const total = selectedQuestions.length;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#16322e]/45 px-4 py-8 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="study-selected-title" className="mx-auto w-full max-w-2xl rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 text-[#16322e] shadow-2xl dark:border-[#2d4440] dark:bg-[#182320] dark:text-[#edf5f1] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Study selected</p>
            <h2 id="study-selected-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Study {total} selected item{total === 1 ? "" : "s"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66807a] dark:text-[#a8bdb7]">Choose a mode. Only compatible items from this selection will be included.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close study mode chooser" className="min-h-10 rounded-xl border border-[#b9cfca] px-3 text-xl leading-none text-[#35645c] hover:bg-[#e8f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">×</button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {modes.map((mode) => {
            const available = selectedQuestions.filter((question) => canStudyItemInMode(question, mode.eligibility, selectedQuestions));
            const isDisabled = available.length === 0;
            return (
              <Link key={mode.key} href={isDisabled ? "#" : modeHref(setId, mode.key, selectedQuestions)} aria-disabled={isDisabled} onClick={(event) => { if (isDisabled) event.preventDefault(); }} className={`rounded-2xl border p-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${isDisabled ? "cursor-not-allowed border-[#d5e2df] bg-[#f3f8f6] opacity-55 dark:border-[#2d4440] dark:bg-[#1e2d2a]" : "border-[#d5e2df] bg-[#fbfdfc] hover:border-[#9ebbb3] hover:bg-[#f3f8f6] dark:border-[#2d4440] dark:bg-[#182320] dark:hover:border-[#4d7167] dark:hover:bg-[#20332f]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{mode.label}</h3>
                  <span className="text-sm font-mono text-[#0f766e] dark:text-[#5eead4]">{available.length} / {total}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#66807a] dark:text-[#a8bdb7]">{mode.description}</p>
                {!isDisabled && available.length < total && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Only {available.length} of {total} selected items are compatible.</p>}
                {isDisabled && <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">No selected items are compatible.</p>}
                {!isDisabled && <p className="mt-4 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">Study {available.length} compatible item{available.length === 1 ? "" : "s"} →</p>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
