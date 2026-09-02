"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { importStudyItemsAction } from "@/app/sets/[setId]/actions";
import {
  parsePortableStudyJson,
  portableAiInstructions,
  portableTemplate,
  type NormalizedPortableStudyItem,
} from "./portable";

interface EditableItem extends NormalizedPortableStudyItem {
  index: number;
  selected: boolean;
}

function copyText(text: string, setStatus: (value: string) => void) {
  void navigator.clipboard.writeText(text).then(() => setStatus("Copied to clipboard."), () => setStatus("Clipboard access was denied."));
}

export function JsonStudySetImport({ studySetId, title, backHref = `/sets/${studySetId}`, backLabel = "Back to set", targetOptions, onTargetChange, onRequestCreateNew }: { studySetId: string; title: string; backHref?: string; backLabel?: string; targetOptions?: Array<{ id: string; title: string }>; onTargetChange?: (studySetId: string) => void; onRequestCreateNew?: () => void }) {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ index: number; message: string }>>([]);
  const [isPending, startTransition] = useTransition();

  const selectedItems = useMemo(() => items.filter((item) => item.selected), [items]);

  function validate() {
    const result = parsePortableStudyJson(json);
    setSyntaxError(result.syntaxError ?? null);
    setValidationErrors(result.errors);
    setItems(result.items.flatMap((item) => item.normalized ? [{ ...item.normalized, index: item.index, selected: item.selected }] : []));
    setStatus(result.syntaxError ? null : `${result.validItems.length} valid item${result.validItems.length === 1 ? "" : "s"} ready for preview.`);
  }

  function updateItem(index: number, update: Partial<EditableItem>) {
    setItems((current) => current.map((item) => item.index === index ? { ...item, ...update } : item));
  }

  function importSelected() {
    if (selectedItems.length === 0) return;
    startTransition(async () => {
      const result = await importStudyItemsAction(studySetId, selectedItems);
      setStatus(result.message);
      if (result.ok) setValidationErrors([]);
    });
  }

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <Link href={backHref} className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">{backLabel}</Link>
          {targetOptions && onTargetChange && <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end"><label className="block text-sm font-semibold">Import into<select value={studySetId} onChange={(event) => onTargetChange(event.target.value)} className="mt-2 editor-input sm:min-w-64">{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>{onRequestCreateNew && <button type="button" onClick={onRequestCreateNew} className="min-h-11 text-left text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Create a new set</button>}</div>}
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Import JSON</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Add items to {title}.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Paste one card or a JSON array, validate it locally, review the normalized items, then import the selected content in one server transaction.</p>
        </header>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
          <label htmlFor="portable-json" className="text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]">Study item JSON</label>
          <textarea id="portable-json" value={json} onChange={(event) => setJson(event.target.value)} rows={18} spellCheck={false} className="mt-2 w-full resize-y rounded-2xl border border-[#c8d9d5] bg-[#fbfdfc] px-4 py-3 font-mono text-sm leading-7 text-[#16322e] outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 dark:border-[#3b5a54] dark:bg-[#1e2d2a] dark:text-[#edf5f1]" placeholder={'{\n  "type": "flashcard",\n  "question": "What is React?",\n  "answer": "..."\n}\n\nOr paste an array of cards.'} />
          {syntaxError && <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{syntaxError}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={validate} className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f]">Validate JSON</button>
            <button type="button" onClick={() => copyText(portableTemplate(), setStatus)} className="min-h-12 rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Copy JSON Template</button>
            <button type="button" onClick={() => copyText(portableAiInstructions(), setStatus)} className="min-h-12 rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Copy AI Instructions</button>
          </div>
          {status && <p className="mt-4 text-sm text-[#55716a] dark:text-[#a8bdb7]" role="status">{status}</p>}
        </section>

        {(items.length > 0 || validationErrors.length > 0) && <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-2xl font-semibold tracking-tight">Import Preview</h2><p className="mt-1 text-sm text-[#66807a] dark:text-[#94aea7]">{items.length + validationErrors.filter((error) => !items.some((item) => item.index === error.index)).length} items detected, {items.length} valid, {new Set(validationErrors.map((error) => error.index)).size} invalid.</p></div>
            <button type="button" onClick={importSelected} disabled={isPending || selectedItems.length === 0} className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f]">{isPending ? "Importing..." : `Import ${selectedItems.length} Items`}</button>
          </div>
          {validationErrors.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><p className="font-semibold">Valid JSON but invalid study data</p><ul className="mt-2 list-disc space-y-1 pl-5">{validationErrors.map((error, index) => <li key={`${error.index}-${index}`}>Item {error.index + 1}: {error.message}</li>)}</ul></div>}
          <div className="grid gap-4">
            {items.map((item) => <EditablePreviewItem key={item.index} item={item} onToggle={() => updateItem(item.index, { selected: !item.selected })} onUpdate={(update) => updateItem(item.index, update)} onDelete={() => setItems((current) => current.filter((candidate) => candidate.index !== item.index))} />)}
          </div>
        </section>}
      </div>
    </main>
  );
}

function EditablePreviewItem({ item, onToggle, onUpdate, onDelete }: { item: EditableItem; onToggle: () => void; onUpdate: (update: Partial<NormalizedPortableStudyItem>) => void; onDelete: () => void }) {
  return <article className={`rounded-2xl border p-5 dark:bg-[#182320] ${item.selected ? "border-[#0f766e] bg-[#fbfdfc] dark:border-[#5eead4]" : "border-[#d5e2df] bg-[#f3f8f6] opacity-70 dark:border-[#2d4440]"}`}>
    <div className="flex items-start gap-3"><input type="checkbox" checked={item.selected} onChange={onToggle} aria-label={`Select item ${item.index + 1}`} className="mt-1 h-5 w-5 accent-[#0f766e]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#66807a] dark:text-[#94aea7]">Item {item.index + 1} · {item.type}</p><button type="button" onClick={onDelete} className="text-sm font-semibold text-rose-700 hover:underline dark:text-rose-300">Delete</button></div>
      <label className="mt-4 block text-sm font-semibold">Question<input value={item.question} onChange={(event) => onUpdate({ question: event.target.value })} className="mt-2 editor-input" /></label>
      <label className="mt-4 block text-sm font-semibold">Answer<textarea value={item.answer} onChange={(event) => onUpdate({ answer: event.target.value })} rows={3} className="mt-2 editor-input" /></label>
      <label className="mt-4 block text-sm font-semibold">Tags<input value={item.tags.join(", ")} onChange={(event) => onUpdate({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} className="mt-2 editor-input" /></label>
    </div></div>
  </article>;
}
