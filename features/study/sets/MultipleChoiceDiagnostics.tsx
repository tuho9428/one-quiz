"use client";

import { useMemo } from "react";

import {
  getMultipleChoiceDiagnostics,
  type MultipleChoiceEligibilityDiagnostic,
} from "../domain/eligibility";
import type { StudyQuestion } from "../domain/types";

export function MultipleChoiceDiagnostics({ questions }: { questions: StudyQuestion[] }) {
  const report = useMemo(() => getMultipleChoiceDiagnostics(questions), [questions]);

  return (
    <details className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 text-[#16322e] dark:border-[#2d4440] dark:bg-[#182320] dark:text-[#edf5f1] sm:p-6">
      <summary className="cursor-pointer list-none font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e]">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>Multiple Choice eligibility diagnostics</span>
          <span className="text-sm font-mono font-normal text-[#0f766e] dark:text-[#5eead4]">{report.eligibleItems} of {report.totalItems} eligible</span>
        </span>
      </summary>

      <div className="mt-6 space-y-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <DiagnosticStat label="Total items" value={report.totalItems} />
          <DiagnosticStat label="Normal / non-code" value={report.normalItems} />
          <DiagnosticStat label="Debug / code" value={report.debugCodeItems} />
          <DiagnosticStat label="Explicit choices" value={report.itemsWithExplicitChoices} />
          <DiagnosticStat label="Generated distractors" value={report.itemsEligibleUsingGeneratedDistractors} />
          <DiagnosticStat label="Eligible normal" value={report.eligibleNormalItems} tone="teal" />
          <DiagnosticStat label="Debug MC explicit" value={report.eligibleDebugCodeWithExplicitChoices} tone="teal" />
          <DiagnosticStat label="Rejected (<3 usable)" value={report.itemsRejectedForInsufficientDistractors} />
          <DiagnosticStat label="Eligible" value={report.eligibleItems} tone="teal" />
        </div>

        <section aria-labelledby="debug-mc-diagnostics">
          <h3 id="debug-mc-diagnostics" className="text-lg font-semibold">Debug / Code analysis</h3>
          <p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Debug content is evaluated by its choices and answer candidates. Its source type is not a rejection reason.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <DiagnosticStat label="Debug items" value={report.debugCode.totalItems} />
            <DiagnosticStat label="Debug eligible for MC" value={report.debugCode.eligibleItems} tone="teal" />
            <DiagnosticStat label="Debug rejected" value={report.debugCode.rejectedItems.length} tone="rose" />
          </div>
          {report.debugCode.examples.length > 0 && <ExampleList title="Debug questions that became generated MC" examples={report.debugCode.examples} />}
          {report.debugCode.rejectedItems.length > 0 && <RejectedList title="Rejected debug questions" items={report.debugCode.rejectedItems} />}
        </section>

        {report.highQualityGeneratedExamples.length > 0 && <ExampleList title="High-quality generated MC examples" examples={report.highQualityGeneratedExamples} />}
        {report.rejectedItems.length > 0 && <RejectedList title="Rejected questions and reasons" items={report.rejectedItems} />}
      </div>
    </details>
  );
}

function ExampleList({ title, examples }: { title: string; examples: MultipleChoiceEligibilityDiagnostic[] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 grid gap-3">
        {examples.map((example) => (
          <article key={example.questionId} className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] p-4 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
            <p className="font-semibold leading-6">{example.question}</p>
            <p className="mt-2 text-sm text-[#55716a] dark:text-[#b8e4da]">Answer: {example.generatedOptions[0]}</p>
            <p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Distractors: {example.generatedOptions.slice(1).join(" · ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RejectedList({ title, items }: { title: string; items: MultipleChoiceEligibilityDiagnostic[] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.questionId} className="rounded-xl border border-[#e7c8c8] bg-[#fff7f7] p-4 dark:border-[#5f3636] dark:bg-[#2d1e1e]">
            <p className="font-semibold leading-6">{item.question}</p>
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">Reason: {item.rejectionReason}</p>
            <p className="mt-1 text-xs text-[#66807a] dark:text-[#a8bdb7]">Candidates: {item.candidateCount} · suitable: {item.suitableCandidateCount} · near duplicates removed: {item.duplicateCandidatesRemoved}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiagnosticStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "teal" | "rose" }) {
  const toneClass = tone === "teal"
    ? "text-[#0f766e] dark:text-[#5eead4]"
    : tone === "rose"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#16322e] dark:text-[#edf5f1]";
  return (
    <div className="rounded-xl border border-[#d5e2df] bg-[#f3f8f6] px-4 py-3 dark:border-[#2d4440] dark:bg-[#1e2d2a]">
      <p className="text-xs text-[#66807a] dark:text-[#a8bdb7]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
