"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteStudyItemAction,
  moveStudyItemAction,
  updateStudyItemAction,
  updateStudySetAction,
  createStudyItemAction,
} from "@/app/sets/[setId]/actions";
import type { StudyQuestion } from "../domain/types";
import type { StudySetRecord } from "@/lib/study/repository";
import { editableItemFromQuestion } from "./model";
import { StudyItemEditorDialog } from "./StudyItemEditorDialog";
import type { PortableStudyItem } from "../import/portable";
import { Pagination } from "../components/Pagination";
import { getStudyItemsPage, getStudyItemsPageCount, getStudyItemsPageRange } from "../sets/selection";

const EDIT_ITEMS_PAGE_SIZE = 5;

function questionText(item: StudyQuestion): string {
  switch (item.type) {
    case "flashcard": return item.prompt;
    case "write": return item.question;
    case "multiple-choice": return item.question;
    case "debug-code": return item.problemStatement;
  }
}

function itemTypeLabel(item: StudyQuestion): string {
  switch (item.type) {
    case "multiple-choice": return "Multiple Choice";
    case "debug-code": return "Debug / Code";
    case "write": return "Write";
    default: return "Flashcard";
  }
}

export function EditStudySet({ studySet }: { studySet: StudySetRecord }) {
  const router = useRouter();
  const [title, setTitle] = useState(studySet.title);
  const [description, setDescription] = useState(studySet.description ?? "");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSavingSet, startSetTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const tags = useMemo(
    () => [...new Set(studySet.questions.flatMap((item) => item.concepts ?? []))].sort((a, b) => a.localeCompare(b)),
    [studySet.questions],
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return studySet.questions.filter((item) => {
      const matchesSearch = !query || `${questionText(item)} ${item.concepts?.join(" ") ?? ""}`.toLocaleLowerCase().includes(query);
      const matchesTag = tagFilter === "all" || item.concepts?.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
  }, [search, studySet.questions, tagFilter]);
  const pageCount = getStudyItemsPageCount(filteredItems.length, EDIT_ITEMS_PAGE_SIZE);
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageRange = getStudyItemsPageRange(filteredItems.length, safeCurrentPage, EDIT_ITEMS_PAGE_SIZE);
  const renderedItems = getStudyItemsPage(filteredItems, safeCurrentPage, EDIT_ITEMS_PAGE_SIZE);
  const editingItem = editorItemId && editorItemId !== "new"
    ? studySet.questions.find((item) => item.id === editorItemId)
    : undefined;

  function showMessage(message: string) {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 4000);
  }

  function openEditor(itemId: string, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setEditorItemId(itemId);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleTagChange(value: string) {
    setTagFilter(value);
    setCurrentPage(1);
  }

  function saveSet() {
    startSetTransition(async () => {
      const result = await updateStudySetAction(studySet.id, { title, description: description ?? "" });
      showMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  async function saveItem(item: PortableStudyItem, addAnother: boolean) {
    const result = editorItemId === "new"
      ? await createStudyItemAction(studySet.id, item)
      : await updateStudyItemAction(studySet.id, editorItemId ?? "", item);
    if (result.ok) {
      showMessage(result.message);
      if (!search.trim() && tagFilter === "all") {
        setCurrentPage(getStudyItemsPageCount(studySet.questions.length + 1, EDIT_ITEMS_PAGE_SIZE));
      }
      router.refresh();
      if (!addAnother) setEditorItemId(null);
    }
    return result;
  }

  async function deleteItem(item: StudyQuestion) {
    if (!window.confirm("Delete this study item? Its attempts and learning progress will also be removed.")) return;
    const result = await deleteStudyItemAction(studySet.id, item.id);
    showMessage(result.message);
    if (result.ok) {
      if (editorItemId === item.id) setEditorItemId(null);
      const remainingFilteredCount = Math.max(0, filteredItems.length - 1);
      const nextPageCount = getStudyItemsPageCount(remainingFilteredCount, EDIT_ITEMS_PAGE_SIZE);
      setCurrentPage((page) => Math.min(page, nextPageCount));
      router.refresh();
    }
  }

  async function moveItem(item: StudyQuestion, direction: "up" | "down") {
    const result = await moveStudyItemAction(studySet.id, item.id, direction);
    showMessage(result.message);
    if (result.ok) router.refresh();
  }

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={`/sets/${studySet.id}`} className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to set</Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Edit study set</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Manage your material.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Update canonical content here. Study modes and generated choices will recalculate from these items.</p>
          </div>
          <Link href={`/sets/${studySet.id}/items/import`} className="min-h-11 rounded-xl border border-[#b9cfca] px-4 py-3 text-center text-sm font-semibold text-[#24564e] hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Import items</Link>
        </header>

        <section className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-6" aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-xl font-semibold">Set details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold">Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="editor-input mt-2" />
            </label>
            <label className="block text-sm font-semibold">Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} className="editor-input mt-2" />
            </label>
          </div>
          <button type="button" onClick={saveSet} disabled={isSavingSet} className="mt-5 min-h-11 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b625b] disabled:opacity-50 dark:bg-[#2dd4bf] dark:text-[#10221f]">{isSavingSet ? "Saving..." : "Save set details"}</button>
        </section>

        <section className="rounded-[1.5rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-6" aria-labelledby="items-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="items-heading" className="text-xl font-semibold">Study Items</h2>
              <p className="mt-1 text-sm font-semibold text-[#66807a] dark:text-[#a8bdb7]">{studySet.questions.length} {studySet.questions.length === 1 ? "item" : "items"}</p>
              <p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Search, edit, reorder, or remove individual cards.</p>
            </div>
            <button type="button" onClick={(event) => openEditor("new", event.currentTarget)} className="min-h-11 rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b625b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:bg-[#2dd4bf] dark:text-[#10221f]">+ Add Item</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block text-sm font-semibold">Search
              <input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search questions or tags" className="editor-input mt-2" />
            </label>
            <label className="block text-sm font-semibold">Tag
              <select value={tagFilter} onChange={(event) => handleTagChange(event.target.value)} className="editor-input mt-2 sm:min-w-48">
                <option value="all">All tags</option>
                {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-4 text-sm text-[#66807a] dark:text-[#a8bdb7]">{filteredItems.length > 0 ? `Showing ${pageRange.start}-${pageRange.end} of ${filteredItems.length}${search.trim() || tagFilter !== "all" ? " matching" : ""}` : search.trim() || tagFilter !== "all" ? "0 matching items" : "0 items"}</p>
          <div className="mt-4 grid gap-3">
            {renderedItems.map((item) => {
              const originalIndex = studySet.questions.findIndex((candidate) => candidate.id === item.id);
              return <article key={item.id} className="rounded-xl border border-[#d5e2df] p-4 dark:border-[#2d4440]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f766e] dark:text-[#5eead4]">{itemTypeLabel(item)}</p>
                    <h3 className="mt-1 line-clamp-2 font-semibold">{questionText(item)}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">{(item.concepts ?? []).map((tag) => <span key={tag} className="rounded-full bg-[#e8f1ee] px-2 py-1 text-xs text-[#55716a] dark:bg-[#20332f] dark:text-[#b8e4da]">{tag}</span>)}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={(event) => openEditor(item.id, event.currentTarget)} className="min-h-10 rounded-lg border border-[#b9cfca] px-3 py-2 text-sm font-semibold text-[#24564e] hover:bg-[#e8f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Edit</button>
                    <button type="button" onClick={() => deleteItem(item)} className="min-h-10 rounded-lg border border-[#e3b8b2] px-3 py-2 text-sm font-semibold text-[#a34336] hover:bg-[#fff1ef] dark:border-[#74453f] dark:text-[#f3a49a]">Delete</button>
                    <button type="button" onClick={() => moveItem(item, "up")} disabled={originalIndex === 0} aria-label="Move item up" className="min-h-10 rounded-lg border border-[#b9cfca] px-3 py-2 text-sm font-semibold disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => moveItem(item, "down")} disabled={originalIndex === studySet.questions.length - 1} aria-label="Move item down" className="min-h-10 rounded-lg border border-[#b9cfca] px-3 py-2 text-sm font-semibold disabled:opacity-40">↓</button>
                  </div>
                </div>
              </article>;
            })}
            {filteredItems.length === 0 && studySet.questions.length > 0 && <p className="rounded-xl border border-dashed border-[#b9cfca] p-6 text-center text-sm text-[#66807a] dark:border-[#3b5a54] dark:text-[#a8bdb7]">No items match this search.</p>}
            {studySet.questions.length === 0 && <div className="rounded-xl border border-dashed border-[#b9cfca] p-6 text-center dark:border-[#3b5a54]"><p className="font-semibold">No study items yet.</p><p className="mt-1 text-sm text-[#66807a] dark:text-[#a8bdb7]">Add your first question or import study material.</p><div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={(event) => openEditor("new", event.currentTarget)} className="min-h-11 rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white dark:bg-[#2dd4bf] dark:text-[#10221f]">+ Add First Item</button><Link href={`/sets/${studySet.id}/items/import`} className="min-h-11 rounded-xl border border-[#b9cfca] px-4 py-3 text-sm font-semibold text-[#24564e] dark:border-[#3b5a54] dark:text-[#b8e4da]">Import Material</Link></div></div>}
          </div>
          {filteredItems.length > 0 && <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-[#66807a] dark:text-[#a8bdb7]">Page {safeCurrentPage} of {pageCount}</p><Pagination currentPage={safeCurrentPage} totalPages={pageCount} onPageChange={setCurrentPage} ariaLabel="Edit study item pages" /></div>}
        </section>

        <StudyItemEditorDialog
          open={Boolean(editorItemId)}
          title={editorItemId === "new" ? "Add Study Item" : "Edit Study Item"}
          subtitle={editingItem ? questionText(editingItem) : undefined}
          initialValue={editingItem ? editableItemFromQuestion(editingItem) : undefined}
          submitLabel={editorItemId === "new" ? "Save Item" : "Save Changes"}
          showSaveAndAddAnother={editorItemId === "new"}
          returnFocusRef={returnFocusRef}
          onSave={saveItem}
          onClose={() => setEditorItemId(null)}
        />

        {status && <p role="status" className="fixed bottom-4 left-4 right-4 z-30 rounded-xl bg-[#16322e] px-4 py-3 text-sm font-semibold text-white shadow-lg sm:left-auto sm:max-w-md">{status}</p>}
      </div>
    </main>
  );
}
