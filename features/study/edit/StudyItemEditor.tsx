"use client";

import { useState, useTransition } from "react";

import { emptyEditableStudyItem, portableItemFromEditable, type EditableStudyItem } from "./model";
import type { PortableStudyItem } from "../import/portable";

const types = [
  { value: "flashcard", label: "Flashcard / standard recall" },
  { value: "write", label: "Write preferred" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "debug_code", label: "Debug / Code" },
] as const;

const tasks = [
  ["identify-bug", "Identify a bug"],
  ["explain-behavior", "Explain behavior"],
  ["predict-output", "Predict output"],
  ["fix-code", "Fix code"],
  ["complete-code", "Complete code"],
] as const;

export interface StudyItemEditorProps {
  initialValue?: EditableStudyItem;
  submitLabel?: string;
  showSaveAndAddAnother?: boolean;
  onSave: (item: PortableStudyItem, addAnother: boolean) => Promise<{ ok: boolean; message: string }>;
  onCancel?: () => void;
}

export function StudyItemEditor({
  initialValue = emptyEditableStudyItem(),
  submitLabel = "Save item",
  showSaveAndAddAnother = false,
  onSave,
  onCancel,
}: StudyItemEditorProps) {
  const [value, setValue] = useState<EditableStudyItem>(initialValue);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasAdvancedContent = Boolean(value.codeSnippet || value.choices || value.language || value.task);

  const update = <K extends keyof EditableStudyItem>(key: K, next: EditableStudyItem[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  function save(addAnother: boolean) {
    setStatus(null);
    startTransition(async () => {
      const result = await onSave(portableItemFromEditable(value), addAnother);
      setStatus(result.message);
      if (result.ok && addAnother) setValue(emptyEditableStudyItem());
    });
  }

  return (
    <form
      className="rounded-[1.5rem] border border-[#b9cfca] bg-[#fbfdfc] p-5 shadow-sm dark:border-[#3b5a54] dark:bg-[#182320] sm:p-6"
      onSubmit={(event) => { event.preventDefault(); save(false); }}
    >
      <div className="grid gap-5">
        <label className="block text-sm font-semibold">
          Preferred content type
          <select value={value.type} onChange={(event) => update("type", event.target.value as EditableStudyItem["type"])} className="editor-input mt-2">
            {types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <span className="mt-2 block text-xs font-normal text-[#66807a] dark:text-[#94aea7]">This is the source item type, not an exclusive study-mode restriction.</span>
        </label>

        <label className="block text-sm font-semibold">Question
          <textarea required value={value.question} onChange={(event) => update("question", event.target.value)} rows={4} placeholder="What is a closure, and why is it useful?" className="editor-input mt-2" />
        </label>
        <label className="block text-sm font-semibold">Answer
          <textarea required value={value.answer} onChange={(event) => update("answer", event.target.value)} rows={4} placeholder="A closure lets a function remember variables from its outer scope." className="editor-input mt-2" />
        </label>
        <label className="block text-sm font-semibold">Explanation <span className="font-normal text-[#66807a]">optional</span>
          <textarea value={value.explanation} onChange={(event) => update("explanation", event.target.value)} rows={3} placeholder="Add a short explanation, example, or memory cue." className="editor-input mt-2" />
        </label>
        <label className="block text-sm font-semibold">Tags <span className="font-normal text-[#66807a]">comma separated</span>
          <input value={value.tags} onChange={(event) => update("tags", event.target.value)} placeholder="JavaScript, Functions, High Priority" className="editor-input mt-2" />
        </label>

        <details open={hasAdvancedContent || value.type === "multiple_choice" || value.type === "debug_code"} className="rounded-xl border border-[#d5e2df] p-4 dark:border-[#2d4440]">
          <summary className="cursor-pointer text-sm font-semibold">Code context and explicit choices</summary>
          <div className="mt-4 grid gap-5">
            <label className="block text-sm font-semibold">Choices <span className="font-normal text-[#66807a]">optional; one per line, including the answer</span>
              <textarea value={value.choices} onChange={(event) => update("choices", event.target.value)} rows={5} placeholder={"useState\nuseRef\nuseEffect\nuseMemo"} className="editor-input mt-2" />
            </label>
            <label className="block text-sm font-semibold">Language <span className="font-normal text-[#66807a]">optional</span>
              <input value={value.language} onChange={(event) => update("language", event.target.value)} placeholder="javascript" className="editor-input mt-2" />
            </label>
            <label className="block text-sm font-semibold">Code task <span className="font-normal text-[#66807a]">required for code exercises</span>
              <select value={value.task} onChange={(event) => update("task", event.target.value)} className="editor-input mt-2">
                <option value="">Not specified</option>
                {tasks.map(([task, label]) => <option key={task} value={task}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Code snippet <span className="font-normal text-[#66807a]">optional except for code exercises</span>
              <textarea value={value.codeSnippet} onChange={(event) => update("codeSnippet", event.target.value)} rows={9} placeholder={'useEffect(() => {\n  setCount(count + 1);\n}, [count]);'} className="editor-input mt-2 font-mono" />
            </label>
          </div>
        </details>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex flex-col gap-3 border-t border-[#d5e2df] bg-[#fbfdfc]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6 dark:border-[#2d4440] dark:bg-[#182320]/95">
        {onCancel && <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-[#b9cfca] px-5 py-3 text-sm font-semibold text-[#24564e] hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Cancel</button>}
        {showSaveAndAddAnother && <button type="button" onClick={() => save(true)} disabled={isPending} className="min-h-12 rounded-xl border border-[#0f766e] px-5 py-3 text-sm font-semibold text-[#0f766e] hover:bg-[#e8f1ee] disabled:opacity-50 dark:border-[#5eead4] dark:text-[#5eead4]">Save &amp; Add Another</button>}
        <button type="submit" disabled={isPending} className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b625b] disabled:cursor-wait disabled:opacity-50 dark:bg-[#2dd4bf] dark:text-[#10221f]">{isPending ? "Saving..." : submitLabel}</button>
      </div>
      {status && <p className="mt-4 text-sm text-[#55716a] dark:text-[#a8bdb7]" role="status">{status}</p>}
    </form>
  );
}
