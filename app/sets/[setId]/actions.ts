"use server";

import { revalidatePath } from "next/cache";

import { ensureStudySet, exportStudySet, importStudyItems } from "@/lib/study/repository";
import { parsePortableStudyJson, type PortableStudyItem } from "@/features/study/import/portable";

export interface StudyMutationResult {
  ok: boolean;
  message: string;
  imported?: number;
  tagsCreatedOrReused?: number;
}

export async function createStudySetAction(input: { title: string; description: string }): Promise<{ ok: boolean; id?: string; message: string }> {
  if (!input.title.trim()) return { ok: false, message: "A study-set title is required." };
  try {
    const id = `set-${input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
    const studySet = await ensureStudySet({ id, title: input.title.trim(), description: input.description.trim(), sourceKey: `manual-${id}` });
    revalidatePath("/");
    revalidatePath("/sets");
    revalidatePath("/import");
    return { ok: true, id: studySet.id, message: "Study set created." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study set could not be created." };
  }
}

export async function importStudyItemsAction(
  studySetId: string,
  items: PortableStudyItem[],
): Promise<StudyMutationResult> {
  const parsed = parsePortableStudyJson(JSON.stringify(items));
  if (parsed.syntaxError || parsed.errors.length > 0 || parsed.validItems.length !== items.length) {
    return { ok: false, message: "The selected items are no longer valid. Validate the JSON again." };
  }

  try {
    const summary = await importStudyItems(studySetId, parsed.validItems);
    revalidatePath(`/sets/${studySetId}`);
    revalidatePath(`/sets/${studySetId}/items/import`);
    return { ok: true, message: `${summary.imported} items imported.`, imported: summary.imported, tagsCreatedOrReused: summary.tagsCreatedOrReused };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The import failed." };
  }
}

export async function exportStudySetAction(studySetId: string): Promise<{ ok: boolean; json?: string; message?: string }> {
  try {
    const items = await exportStudySet(studySetId);
    return { ok: true, json: JSON.stringify(items, null, 2) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The export failed." };
  }
}
