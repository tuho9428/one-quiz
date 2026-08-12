import Link from "next/link";

import { getStudySets } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function StudySetsPage() {
  const studySets = await getStudySets();

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Study sets</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Choose what to remember.</h1></div>
          <Link href="/import" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white dark:bg-[#2dd4bf] dark:text-[#10221f]">+ New Study Set</Link>
        </header>
        {studySets.length === 0 ? (
          <section className="rounded-[1.75rem] border border-dashed border-[#9ebbb3] bg-[#fbfdfc] p-8 dark:border-[#4d7167] dark:bg-[#182320]">
            <h2 className="text-xl font-semibold">No study sets yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">Run the development import command or create a set through the database repository.</p>
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {studySets.map((studySet) => (
              <Link key={studySet.id} href={`/sets/${studySet.id}`} className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-6 transition hover:-translate-y-px hover:border-[#9ebbb3] dark:border-[#2d4440] dark:bg-[#182320] dark:hover:border-[#4d7167]">
                <h2 className="text-2xl font-semibold tracking-tight">{studySet.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#66807a] dark:text-[#94aea7]">{studySet.description}</p>
                <p className="mt-5 text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">{studySet.questions.length} study items</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
