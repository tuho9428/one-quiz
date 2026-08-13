"use server";

import { revalidatePath } from "next/cache";

import {
  createStudyItem,
  deleteStudyItem,
  ensureStudySet,
  exportStudySet,
  importStudyItems,
  moveStudyItem,
  updateStudyItem,
  updateStudySet,
} from "@/lib/study/repository";
import { parsePortableStudyJson, type PortableStudyItem } from "@/features/study/import/portable";

export interface StudyMutationResult {
  ok: boolean;
  message: string;
  imported?: number;
  tagsCreatedOrReused?: number;
}

function parseOneItem(item: PortableStudyItem) {
  const parsed = parsePortableStudyJson(JSON.stringify([item]));
  if (parsed.syntaxError || parsed.errors.length > 0 || parsed.validItems.length !== 1) {
    return { ok: false as const, message: parsed.errors[0]?.message ?? "The study item is not valid." };
  }
  return { ok: true as const, item: parsed.validItems[0] };
}

function revalidateStudySet(studySetId: string) {
  revalidatePath(`/sets/${studySetId}`);
  revalidatePath(`/sets/${studySetId}/edit`);
  revalidatePath(`/sets/${studySetId}/items/new`);
  revalidatePath("/sets");
  revalidatePath("/dashboard");
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
    revalidateStudySet(studySetId);
    revalidatePath(`/sets/${studySetId}/items/import`);
    return { ok: true, message: `${summary.imported} items imported.`, imported: summary.imported, tagsCreatedOrReused: summary.tagsCreatedOrReused };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The import failed." };
  }
}

export async function updateStudySetAction(
  studySetId: string,
  input: { title: string; description: string },
): Promise<StudyMutationResult> {
  try {
    await updateStudySet(studySetId, input);
    revalidateStudySet(studySetId);
    return { ok: true, message: "Study set details saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study set could not be updated." };
  }
}

export async function createStudyItemAction(
  studySetId: string,
  input: PortableStudyItem,
): Promise<StudyMutationResult> {
  const parsed = parseOneItem(input);
  if (!parsed.ok) return parsed;
  try {
    await createStudyItem(studySetId, parsed.item);
    revalidateStudySet(studySetId);
    return { ok: true, message: "Study item saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study item could not be saved." };
  }
}

export async function updateStudyItemAction(
  studySetId: string,
  itemId: string,
  input: PortableStudyItem,
): Promise<StudyMutationResult> {
  const parsed = parseOneItem(input);
  if (!parsed.ok) return parsed;
  try {
    await updateStudyItem(studySetId, itemId, parsed.item);
    revalidateStudySet(studySetId);
    return { ok: true, message: "Study item saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study item could not be updated." };
  }
}

export async function deleteStudyItemAction(studySetId: string, itemId: string): Promise<StudyMutationResult> {
  try {
    await deleteStudyItem(studySetId, itemId);
    revalidateStudySet(studySetId);
    return { ok: true, message: "Study item deleted." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study item could not be deleted." };
  }
}

export async function moveStudyItemAction(
  studySetId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<StudyMutationResult> {
  try {
    await moveStudyItem(studySetId, itemId, direction);
    revalidateStudySet(studySetId);
    return { ok: true, message: "Study item order updated." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The study item order could not be updated." };
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
