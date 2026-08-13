"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { PortableStudyItem } from "../import/portable";
import { StudyItemEditor } from "./StudyItemEditor";
import type { EditableStudyItem } from "./model";

interface StudyItemEditorDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  initialValue?: EditableStudyItem;
  submitLabel: string;
  showSaveAndAddAnother?: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onSave: (item: PortableStudyItem, addAnother: boolean) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
}

export function StudyItemEditorDialog({
  open,
  title,
  subtitle,
  initialValue,
  submitLabel,
  showSaveAndAddAnother,
  returnFocusRef,
  onSave,
  onClose,
}: StudyItemEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    dialogRef.current?.close();
    onClose();
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="study-item-editor-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[#10221f]/45 sm:ml-auto sm:w-[min(100%,48rem)]"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f6f5] text-[#16322e] shadow-2xl dark:bg-[#101817] dark:text-[#edf5f1]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d5e2df] bg-[#fbfdfc] px-5 py-5 dark:border-[#2d4440] dark:bg-[#182320] sm:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e] dark:text-[#5eead4]">Study item</p>
            <h2 id="study-item-editor-title" className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-2 line-clamp-2 text-sm text-[#66807a] dark:text-[#a8bdb7]">{subtitle}</p>}
          </div>
          <button type="button" onClick={close} aria-label="Close study item editor" className="min-h-11 min-w-11 shrink-0 rounded-xl border border-[#b9cfca] px-3 text-xl leading-none text-[#24564e] hover:bg-[#e8f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <StudyItemEditor
            key={open ? `${title}-${subtitle ?? "new"}` : "closed"}
            initialValue={initialValue}
            submitLabel={submitLabel}
            showSaveAndAddAnother={showSaveAndAddAnother}
            onSave={onSave}
            onCancel={close}
          />
        </div>
      </div>
    </dialog>
  );
}
