import Link from "next/link";

import type { StudySetProgress } from "./metrics";

function formatStudyTime(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60000);
  if (minutes < 1) return "Under 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

export interface StudyProgressDashboardProps {
  progress: StudySetProgress[];
}

export function StudyProgressDashboard({ progress }: StudyProgressDashboardProps) {
  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to study</Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Progress</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Know what to study next.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">A focused view of mastery, weak areas, and due reviews across your study sets.</p>
          </div>
          <Link href="/import" className="min-h-11 rounded-xl bg-[#0f766e] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Import material</Link>
        </header>

        {progress.length === 0 ? (
          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-8 dark:border-[#2d4440] dark:bg-[#182320]">
            <h2 className="text-2xl font-semibold">No study sets yet</h2>
            <p className="mt-3 text-[#66807a] dark:text-[#94aea7]">Create a set and your progress will appear here after your first attempt.</p>
          </section>
        ) : (
          <div className="flex flex-col gap-8">
            {progress.map((studySet) => <StudySetProgressCard key={studySet.set.id} progress={studySet} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function StudySetProgressCard({ progress }: { progress: StudySetProgress }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none">
      <div className="border-b border-[#d5e2df] px-5 py-6 dark:border-[#2d4440] sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href={`/sets/${progress.set.id}`} className="text-2xl font-semibold tracking-tight hover:text-[#0f766e] dark:hover:text-[#5eead4]">{progress.set.title}</Link>
            {progress.set.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">{progress.set.description}</p>}
          </div>
          <div className="min-w-52">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm font-semibold text-[#55716a] dark:text-[#a8bdb7]">Overall mastery</p>
              <p className="text-3xl font-semibold text-[#0f766e] dark:text-[#5eead4]">{progress.overallMastery}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label={`${progress.set.title} overall mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.overallMastery}>
              <div className="h-full rounded-full bg-[#0f766e] transition-[width] dark:bg-[#2dd4bf]" style={{ width: `${progress.overallMastery}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[#d5e2df] dark:border-[#2d4440] sm:grid-cols-4 lg:grid-cols-8">
        <Metric label="Mastered" value={progress.cardsMastered} />
        <Metric label="Learning" value={progress.cardsLearning} />
        <Metric label="Weak cards" value={progress.weakCards} tone="rose" />
        <Metric label="Due today" value={progress.cardsDueToday} tone="amber" />
        <Metric label="Study time" value={formatStudyTime(progress.totalStudyTimeMs)} />
        <Metric label="Answered" value={progress.questionsAnswered} />
        <Metric label="Accuracy" value={`${progress.accuracy}%`} tone="teal" />
        <Metric label="Study streak" value={`${progress.currentStudyStreak} days`} tone="teal" />
      </div>

      <div className="grid gap-8 px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Concept mastery</h2>
              <p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">Topics are ordered by what needs attention first.</p>
            </div>
          </div>
          {progress.conceptMastery.length > 0 ? (
            <div className="mt-5 flex flex-col gap-4">
              {progress.conceptMastery.map((concept) => <ConceptRow key={concept.concept} concept={concept.concept} mastery={concept.mastery} />)}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-[#f3f8f6] px-4 py-4 text-sm text-[#66807a] dark:bg-[#1e2d2a] dark:text-[#94aea7]">Add topics to cards to see concept-level mastery.</p>
          )}
        </section>

        <section className="rounded-2xl bg-[#f3f8f6] p-5 dark:bg-[#1e2d2a]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Recommended next action</p>
          <div className="mt-4 flex flex-col gap-3">
            {progress.recommendedActions.map((action) => (
              <Link key={action.label} href={action.href} className={`rounded-xl border px-4 py-4 font-semibold transition hover:-translate-y-px ${action.tone === "urgent" ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60" : action.tone === "focus" ? "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60" : "border-[#b9cfca] bg-[#fbfdfc] text-[#24564e] hover:bg-white dark:border-[#3b5a54] dark:bg-[#182320] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"}`}>{action.label}</Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "rose" | "amber" | "teal" }) {
  const toneClass = {
    neutral: "text-[#16322e] dark:text-[#edf5f1]",
    rose: "text-rose-700 dark:text-rose-300",
    amber: "text-amber-700 dark:text-amber-300",
    teal: "text-[#0f766e] dark:text-[#5eead4]",
  }[tone];

  return (
    <div className="border-r border-b border-[#d5e2df] px-4 py-4 last:border-r-0 dark:border-[#2d4440]">
      <p className="text-xs text-[#66807a] dark:text-[#94aea7]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ConceptRow({ concept, mastery }: { concept: string; mastery: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <p className="font-semibold">{concept}</p>
        <p className="font-mono text-[#55716a] dark:text-[#a8bdb7]">{mastery}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dce8e5] dark:bg-[#263b37]" role="progressbar" aria-label={`${concept} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={mastery}>
        <div className={`h-full rounded-full ${mastery < 60 ? "bg-rose-500" : mastery < 80 ? "bg-amber-500" : "bg-[#0f766e] dark:bg-[#2dd4bf]"}`} style={{ width: `${mastery}%` }} />
      </div>
    </div>
  );
}
