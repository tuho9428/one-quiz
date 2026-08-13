import Link from "next/link";
import type { ContinueStudyingCandidate } from "./continue";
import type { DashboardStudySet } from "./summary";

export function StudyDashboard({
  studySets,
  continueStudying,
}: {
  studySets: DashboardStudySet[];
  continueStudying: ContinueStudyingCandidate | null;
}) {

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Study what needs you next.</h1>
          <p className="mt-4 text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Your active-recall home for focused practice, due reviews, and stronger memory.</p>
        </section>

        {continueStudying && <section className="rounded-[1.75rem] bg-[#0f766e] p-6 text-white shadow-[0_18px_50px_rgba(15,118,110,0.22)] dark:bg-[#174f48] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b8f1e4]">Continue studying</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">{continueStudying.studySetTitle}</h2>
              {continueStudying.mode && <p className="mt-2 font-semibold text-[#d2f6ee]">{formatMode(continueStudying.mode)}</p>}
              <p className="mt-1 text-[#d2f6ee]">
                {continueStudying.incomplete
                  ? continueStudying.completedItems > 0
                    ? `${continueStudying.completedItems} question${continueStudying.completedItems === 1 ? "" : "s"} answered in this session.`
                    : "Study session started."
                  : `Last studied ${formatDate(continueStudying.lastStudiedAt)}.`}
              </p>
            </div>
            <Link href={getContinueHref(continueStudying)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 py-3 font-semibold text-[#0b625b] transition hover:bg-[#e8faf5] active:translate-y-px">{continueStudying.incomplete ? continueStudying.resumable ? "Continue" : "Open mode" : "Study again"}</Link>
          </div>
        </section>}

        <section>
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-tight">Your study sets</h2><p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">Choose a set to see its modes, progress, and next actions.</p></div><Link href="/import" className="hidden min-h-11 items-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] sm:inline-flex dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Import material</Link></div>
          {studySets.length === 0 ? <section className="mt-5 rounded-[1.5rem] border border-dashed border-[#9ebbb3] bg-[#fbfdfc] p-8 dark:border-[#4d7167] dark:bg-[#182320]"><h3 className="text-xl font-semibold">You don&apos;t have any study sets yet.</h3><p className="mt-2 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">Start with notes or a portable JSON array and turn them into active-recall items.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Link href="/import" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white dark:bg-[#2dd4bf] dark:text-[#10221f]">Import material</Link><Link href="/sets" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] dark:border-[#3b5a54] dark:text-[#b8e4da]">Create study set</Link></div></section> : <div className="mt-5 grid gap-4 md:grid-cols-2">{studySets.map((studySet) => <StudySetCard key={studySet.id} studySet={studySet} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function StudySetCard({ studySet }: { studySet: DashboardStudySet }) {
  return <article className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-6 transition hover:-translate-y-px hover:border-[#9ebbb3] dark:border-[#2d4440] dark:bg-[#182320] dark:hover:border-[#4d7167]"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><Link href={`/sets/${studySet.id}`} className="text-2xl font-semibold tracking-tight hover:text-[#0f766e] dark:hover:text-[#5eead4]">{studySet.title}</Link><p className="mt-2 max-w-xl text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">{studySet.description}</p></div><Link href={`/sets/${studySet.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white dark:bg-[#2dd4bf] dark:text-[#10221f]">Study</Link></div><div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><DashboardMetric label="Items" value={studySet.itemCount} />{studySet.mastery !== undefined && <DashboardMetric label="Mastery" value={`${studySet.mastery}%`} />}{studySet.dueCount !== undefined && <DashboardMetric label="Due" value={studySet.dueCount} />}{studySet.lastStudiedAt && <DashboardMetric label="Last studied" value={formatDate(studySet.lastStudiedAt)} />}</div></article>;
}

function DashboardMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[#f3f8f6] px-3 py-3 dark:bg-[#1e2d2a]"><p className="text-xs text-[#66807a] dark:text-[#94aea7]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getContinueHref(continueStudying: ContinueStudyingCandidate): string {
  const route = continueStudying.mode ? modeRoute(continueStudying.mode) : null;
  return route ? `/sets/${continueStudying.studySetId}/study/${route}` : `/sets/${continueStudying.studySetId}`;
}

function modeRoute(mode: string): string | null {
  switch (mode.toLowerCase()) {
    case "flashcard":
    case "flashcards":
      return "flashcards";
    case "multiple-choice":
    case "multiple_choice":
      return "multiple-choice";
    case "write":
      return "write";
    case "rapid-recall":
    case "rapid_recall":
      return "rapid-recall";
    case "smart-study":
    case "smart_study":
      return "smart-study";
    case "debug-code":
    case "debug_code":
      return "debug-code";
    default:
      return null;
  }
}

function formatMode(mode: string): string {
  const route = modeRoute(mode);
  if (route === "flashcards") return "Flashcards";
  if (route === "multiple-choice") return "Multiple Choice";
  if (route === "rapid-recall") return "Rapid Recall";
  if (route === "smart-study") return "Smart Study";
  if (route === "debug-code") return "Debug / Code";
  if (route === "write") return "Write";
  return mode;
}
