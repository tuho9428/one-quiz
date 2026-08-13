"use client";

import Link from "next/link";
import { useState } from "react";

import { createStudyItemAction } from "@/app/sets/[setId]/actions";
import { StudyItemEditor } from "../edit/StudyItemEditor";
import type { PortableStudyItem } from "./portable";

export function ManualStudyItem({ studySetId, title }: { studySetId: string; title: string }) {
  const [editorKey, setEditorKey] = useState(0);

  async function save(item: PortableStudyItem, addAnother: boolean) {
    const result = await createStudyItemAction(studySetId, item);
    if (result.ok && addAnother) setEditorKey((key) => key + 1);
    return result;
  }

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <Link href={`/sets/${studySetId}`} className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to set</Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Add manually</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Add an item to {title}.</h1>
        </header>
        <StudyItemEditor key={editorKey} showSaveAndAddAnother onSave={save} />
      </div>
    </main>
  );
}
