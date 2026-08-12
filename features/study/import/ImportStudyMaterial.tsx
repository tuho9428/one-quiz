"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { parseStudyMaterial } from "./parser";
import { createStudySetAction, importStudyItemsAction } from "@/app/sets/[setId]/actions";
import { JsonStudySetImport } from "./JsonStudySetImport";
import type {
  ImportDraftCard,
  ImportParseResult,
  ImportedQuestionType,
} from "./types";

type SourceFormat = "text" | "markdown" | "json";
type ImportStage = "compose" | "review" | "imported";

const QUESTION_TYPES: Array<{ value: ImportedQuestionType; label: string }> = [
  { value: "flashcard", label: "Flashcard" },
  { value: "write", label: "Write" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "debug-code", label: "Debug / Code" },
];

function reviewReasons(card: ImportDraftCard): string[] {
  const reasons: string[] = [];
  if (!card.question.trim()) reasons.push("Question is missing");
  if (!card.answer.trim() && !card.codeSnippet?.trim()) reasons.push("Answer is missing");
  if (card.isCode && !card.answer.trim()) reasons.push("Code question needs an explanation");
  if (card.type === "multiple-choice" && (!card.choices || card.choices.length < 2)) reasons.push("Multiple Choice needs at least 2 options");
  return reasons;
}

function withReviewState(card: ImportDraftCard): ImportDraftCard {
  const reasons = reviewReasons(card);
  return { ...card, reviewReasons: reasons, needsReview: reasons.length > 0 };
}

function createBlankCard(index: number): ImportDraftCard {
  return {
    id: `manual-${Date.now()}-${index}`,
    question: "",
    answer: "",
    tags: [],
    type: "flashcard",
    isCode: false,
    sourceText: "Added manually",
    needsReview: true,
    reviewReasons: ["Question is missing", "Answer is missing"],
  };
}

export function ImportStudyMaterial({ studySets, initialStudySetId, initialFormat }: { studySets: Array<{ id: string; title: string }>; initialStudySetId?: string; initialFormat?: SourceFormat }) {
  const router = useRouter();
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>(initialFormat ?? "markdown");
  const [targetStudySetId, setTargetStudySetId] = useState(initialStudySetId ?? studySets[0]?.id ?? "");
  const [newSetTitle, setNewSetTitle] = useState("");
  const [newSetDescription, setNewSetDescription] = useState("");
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [content, setContent] = useState("");
  const [stage, setStage] = useState<ImportStage>("compose");
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const cards = useMemo(() => parseResult?.draftCards ?? [], [parseResult]);
  const needsReviewCount = useMemo(
    () => cards.filter((card) => card.needsReview).length + (parseResult?.unparsedSections.length ?? 0),
    [cards, parseResult?.unparsedSections.length],
  );
  const recognizedCount = cards.filter((card) => !card.needsReview).length;
  const targetStudySet = studySets.find((studySet) => studySet.id === targetStudySetId);

  async function createSet() {
    setIsCreatingSet(true);
    const result = await createStudySetAction({ title: newSetTitle, description: newSetDescription });
    setIsCreatingSet(false);
    if (!result.ok || !result.id) {
      setTargetError(result.message);
      return;
    }
    setTargetError(null);
    setTargetStudySetId(result.id);
    router.push(`/sets/${result.id}/items/import`);
  }

  if (sourceFormat === "json" && targetStudySet) {
    return <JsonStudySetImport studySetId={targetStudySet.id} title={targetStudySet.title} backHref="/import" backLabel="Back to import formats" targetOptions={studySets} onTargetChange={setTargetStudySetId} onRequestCreateNew={() => setTargetStudySetId("")} />;
  }

  function parseContent() {
    if (!content.trim()) {
      setError("Paste some study material before parsing.");
      return;
    }

    setError(null);
    setParseResult(parseStudyMaterial(content));
    setStage("review");
  }

  function updateCard(cardId: string, update: Partial<ImportDraftCard>) {
    setParseResult((current) => {
      if (!current) return current;
      return {
        ...current,
        draftCards: current.draftCards.map((card) =>
          card.id === cardId ? withReviewState({ ...card, ...update }) : card,
        ),
      };
    });
  }

  function deleteCard(cardId: string) {
    setParseResult((current) =>
      current
        ? { ...current, draftCards: current.draftCards.filter((card) => card.id !== cardId) }
        : current,
    );
  }

  function addCard() {
    setParseResult((current) =>
      current
        ? { ...current, draftCards: [...current.draftCards, createBlankCard(current.draftCards.length)] }
        : current,
    );
  }

  async function markImported() {
    if (cards.length === 0) return;
    if (!targetStudySetId) {
      setError("Choose or create a study set before importing.");
      return;
    }

    setIsImporting(true);
    setError(null);
    const result = await importStudyItemsAction(targetStudySetId, cards.map((card) => ({
      type: card.type === "multiple-choice" ? "multiple_choice" : card.type === "debug-code" ? "debug_code" : card.type,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
      tags: card.tags,
      choices: card.choices,
      codeSnippet: card.codeSnippet,
      language: card.language,
    })));
    setIsImporting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setImportedCount(result.imported ?? cards.length);
    setStage("imported");
  }

  if (stage === "imported") {
    return (
      <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <Link href="/dashboard" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">View dashboard</Link>
          <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-6 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Import ready</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{importedCount} cards imported.</h1>
            <p className="mt-4 text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">The reviewed cards are now persisted in {targetStudySet?.title ?? "your study set"}. Unrecognized material remains available in the review record below.</p>
            {parseResult && parseResult.unparsedSections.length > 0 && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><p className="font-semibold">{parseResult.unparsedSections.length} section still needs review</p><p className="mt-1">Nothing was silently discarded. Return to review if you want to turn it into another card.</p></div>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setStage("review")} className="min-h-12 flex-1 rounded-xl border border-[#b9cfca] px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">Review Cards</button>
              <button type="button" onClick={() => { setContent(""); setParseResult(null); setStage("compose"); setImportedCount(0); }} className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Import More</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (stage === "review" && parseResult) {
    return (
      <ImportReview
        cards={cards}
        parseResult={parseResult}
        recognizedCount={recognizedCount}
        needsReviewCount={needsReviewCount}
        onUpdate={updateCard}
        onDelete={deleteCard}
        onAdd={addCard}
        onImport={markImported}
        isImporting={isImporting}
        importError={error}
        onBack={() => setStage("compose")}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header>
          <Link href="/dashboard" className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to dashboard</Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Import study material</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Turn notes into recall prompts.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#55716a] dark:text-[#a8bdb7]">Paste plain text, Markdown, or portable JSON. Review everything before it becomes part of a study set.</p>
        </header>

        <section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 shadow-[0_18px_60px_rgba(27,64,57,0.08)] dark:border-[#2d4440] dark:bg-[#182320] dark:shadow-none sm:p-8">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Material format">
            {(["text", "markdown", "json"] as SourceFormat[]).map((format) => <button key={format} type="button" aria-pressed={sourceFormat === format} onClick={() => setSourceFormat(format)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition active:translate-y-px ${sourceFormat === format ? "bg-[#e3f2ee] text-[#0f5f58] dark:bg-[#1f4039] dark:text-[#c4f4e8]" : "text-[#66807a] hover:bg-[#edf5f2] dark:text-[#94aea7] dark:hover:bg-[#20332f]"}`}>{format === "text" ? "Raw Text" : format === "markdown" ? "Markdown" : "JSON"}</button>)}
          </div>
          <div className="mt-6 rounded-2xl bg-[#f3f8f6] p-4 dark:bg-[#1e2d2a]"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Add to study set<select value={targetStudySetId} onChange={(event) => setTargetStudySetId(event.target.value)} className="mt-2 editor-input"><option value="">Choose a study set</option>{studySets.map((studySet) => <option key={studySet.id} value={studySet.id}>{studySet.title}</option>)}</select></label><div><p className="text-sm font-semibold">Need a new set?</p><button type="button" onClick={() => setShowCreateSet((value) => !value)} className="mt-2 text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">{showCreateSet ? "Hide new set form" : "Create a new study set"}</button></div></div>{showCreateSet && <div className="mt-4 grid gap-3 border-t border-[#d5e2df] pt-4 dark:border-[#2d4440] sm:grid-cols-2"><label className="block text-sm font-semibold">New set title<input value={newSetTitle} onChange={(event) => setNewSetTitle(event.target.value)} className="mt-2 editor-input" /></label><label className="block text-sm font-semibold">Description<input value={newSetDescription} onChange={(event) => setNewSetDescription(event.target.value)} className="mt-2 editor-input" /></label><button type="button" onClick={createSet} disabled={isCreatingSet} className="min-h-11 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#2dd4bf] dark:text-[#10221f] sm:col-span-2">{isCreatingSet ? "Creating..." : "Create and continue"}</button></div>}{targetError && <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300" role="alert">{targetError}</p>}</div>
          {sourceFormat !== "json" && <><label htmlFor="study-material" className="mt-6 block text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]">Paste {sourceFormat === "markdown" ? "Markdown" : "raw text"}</label><textarea id="study-material" value={content} onChange={(event) => setContent(event.target.value)} rows={16} className="mt-2 w-full resize-y rounded-2xl border border-[#c8d9d5] bg-[#fbfdfc] px-4 py-3 font-mono text-sm leading-7 text-[#16322e] outline-none transition placeholder:text-[#91aaa3] focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 dark:border-[#3b5a54] dark:bg-[#1e2d2a] dark:text-[#edf5f1] dark:placeholder:text-[#66807a] dark:focus:border-[#5eead4]" placeholder={sourceFormat === "markdown" ? "## React useEffect\n\nAn effect synchronizes a component with an external system.\n\nQuestion: What causes a render loop?\nAnswer: An effect that updates a value in its own dependency list." : "Question: ...\nAnswer: ..."} /></>}
          {sourceFormat === "json" && !targetStudySet && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><p className="font-semibold">Choose a study set before importing JSON.</p><p className="mt-1">You can create a new set from the Study Sets page, then return here.</p></div>}
          {error && <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#66807a] dark:text-[#94aea7]">{sourceFormat === "json" ? "JSON validates into a reviewable database import." : "Recognizes Q/A labels, headings, numbered questions, definitions, and fenced code."}</p>
            {sourceFormat !== "json" && <button type="button" onClick={parseContent} className="min-h-12 rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4]">Parse Material</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

function ImportReview({
  cards,
  parseResult,
  recognizedCount,
  needsReviewCount,
  onUpdate,
  onDelete,
  onAdd,
  onImport,
  isImporting,
  importError,
  onBack,
}: {
  cards: ImportDraftCard[];
  parseResult: ImportParseResult;
  recognizedCount: number;
  needsReviewCount: number;
  onUpdate: (cardId: string, update: Partial<ImportDraftCard>) => void;
  onDelete: (cardId: string) => void;
  onAdd: () => void;
  onImport: () => void | Promise<void>;
  isImporting: boolean;
  importError: string | null;
  onBack: () => void;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button type="button" onClick={onBack} className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to material</button>
            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Import review</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Check every card before import.</h1>
          </div>
          <button type="button" onClick={onImport} disabled={isImporting || cards.length === 0} className="min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#2dd4bf] dark:text-[#10221f] dark:hover:bg-[#5eead4] sm:w-auto">{isImporting ? "Importing..." : `Import ${cards.length} Cards`}</button>
        </header>

        {importError && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{importError}</p>}

        <section className="grid gap-3 sm:grid-cols-2">
          <ReviewSummary label="Successfully recognized" value={recognizedCount} tone="emerald" />
          <ReviewSummary label="Needs review" value={needsReviewCount} tone="amber" />
        </section>

        {parseResult.unparsedSections.length > 0 && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><h2 className="text-lg font-semibold">Content that needs review</h2><p className="mt-2 text-sm leading-6">These sections did not match a supported structure, so they remain here instead of being discarded.</p><div className="mt-4 flex flex-col gap-3">{parseResult.unparsedSections.map((section) => <details key={section.id} className="rounded-xl border border-amber-300/70 bg-amber-100/50 p-3 dark:border-amber-700 dark:bg-amber-950/30"><summary className="cursor-pointer text-sm font-semibold">{section.reason}</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">{section.content}</pre></details>)}</div></section>}

        <div className="flex flex-col gap-5">
          {cards.map((card, index) => <DraftCardEditor key={card.id} card={card} index={index} onUpdate={onUpdate} onDelete={onDelete} />)}
        </div>

        <button type="button" onClick={onAdd} className="min-h-12 rounded-xl border border-dashed border-[#9ebbb3] bg-transparent px-5 py-3 font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#4d7167] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">+ Add Card</button>
      </div>
    </main>
  );
}

function DraftCardEditor({ card, index, onUpdate, onDelete }: { card: ImportDraftCard; index: number; onUpdate: (cardId: string, update: Partial<ImportDraftCard>) => void; onDelete: (cardId: string) => void }) {
  const update = (fields: Partial<ImportDraftCard>) => onUpdate(card.id, fields);
  const setCode = (isCode: boolean) => update({ isCode, type: isCode ? "debug-code" : card.type === "debug-code" ? "flashcard" : card.type });

  return (
    <article className={`rounded-[1.5rem] border bg-[#fbfdfc] p-5 dark:bg-[#182320] sm:p-6 ${card.needsReview ? "border-amber-300 dark:border-amber-800" : "border-[#d5e2df] dark:border-[#2d4440]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#66807a] dark:text-[#94aea7]">Draft {index + 1}</p>{card.needsReview && <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{card.reviewReasons.join(" · ")}</p>}</div>
        <button type="button" onClick={() => onDelete(card.id)} className="min-h-10 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Delete</button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field label="Question"><textarea value={card.question} onChange={(event) => update({ question: event.target.value })} rows={4} className="editor-input" /></Field>
        <Field label="Answer / expected explanation"><textarea value={card.answer} onChange={(event) => update({ answer: event.target.value })} rows={4} className="editor-input" /></Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Tags / topics"><input value={card.tags.join(", ")} onChange={(event) => update({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} className="editor-input" /></Field>
        <Field label="Question type"><select value={card.type} onChange={(event) => update({ type: event.target.value as ImportedQuestionType, isCode: event.target.value === "debug-code" || card.isCode })} className="editor-input">{QUESTION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      </div>

      {card.type === "multiple-choice" && <Field label="Answer choices (comma separated)"><input value={(card.choices ?? []).join(", ")} onChange={(event) => update({ choices: event.target.value.split(",").map((choice) => choice.trim()).filter(Boolean) })} className="editor-input" placeholder="Correct answer, distractor, distractor" /></Field>}

      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]"><input type="checkbox" checked={card.isCode} onChange={(event) => setCode(event.target.checked)} className="h-4 w-4 accent-[#0f766e]" /> Mark as code question</label>

      {card.isCode && <div className="mt-4 grid gap-5 sm:grid-cols-[10rem_1fr]"><Field label="Language"><input value={card.language ?? "javascript"} onChange={(event) => update({ language: event.target.value })} className="editor-input" /></Field><Field label="Code"><textarea value={card.codeSnippet ?? ""} onChange={(event) => update({ codeSnippet: event.target.value })} rows={6} className="editor-input font-mono text-sm" /></Field></div>}

      {card.sourceText && <details className="mt-5 text-sm text-[#66807a] dark:text-[#94aea7]"><summary className="cursor-pointer font-semibold">View source excerpt</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#f3f8f6] p-3 text-xs leading-6 dark:bg-[#1e2d2a]">{card.sourceText}</pre></details>}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-[#35645c] dark:text-[#b8e4da]"><span>{label}</span><div className="mt-2">{children}</div></label>;
}

function ReviewSummary({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" }) {
  return <div className="rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] px-5 py-5 dark:border-[#2d4440] dark:bg-[#182320]"><p className="text-sm text-[#66807a] dark:text-[#94aea7]">{label}</p><p className={`mt-2 text-4xl font-semibold ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{value}</p></div>;
}
