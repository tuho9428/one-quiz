"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { importStudyItemsAction } from "@/app/sets/[setId]/actions";
import type { PortableQuestionType, PortableStudyItem } from "./portable";

const types: Array<{ value: PortableQuestionType; label: string }> = [
  { value: "flashcard", label: "Flashcard" },
  { value: "write", label: "Write" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "debug_code", label: "Debug / Code" },
];

export function ManualStudyItem({ studySetId, title }: { studySetId: string; title: string }) {
  const [type, setType] = useState<PortableQuestionType>("flashcard");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tags, setTags] = useState("");
  const [explanation, setExplanation] = useState("");
  const [choices, setChoices] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [language, setLanguage] = useState("jsx");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const item: PortableStudyItem = {
      type,
      question,
      answer,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      explanation: explanation || undefined,
      choices: type === "multiple_choice" ? choices.split("\n").map((choice) => choice.trim()).filter(Boolean) : undefined,
      codeSnippet: type === "debug_code" ? codeSnippet : undefined,
      language: type === "debug_code" ? language : undefined,
    };
    startTransition(async () => {
      const result = await importStudyItemsAction(studySetId, [item]);
      setStatus(result.message);
      if (result.ok) {
        setQuestion("");
        setAnswer("");
        setExplanation("");
        setCodeSnippet("");
      }
    });
  }

  return <main className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12"><div className="mx-auto flex w-full max-w-3xl flex-col gap-8"><header><Link href={`/sets/${studySetId}`} className="text-sm font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Back to set</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Add manually</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Add an item to {title}.</h1></header><section className="rounded-[1.75rem] border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-8"><label className="block text-sm font-semibold">Question type<select value={type} onChange={(event) => setType(event.target.value as PortableQuestionType)} className="mt-2 editor-input">{types.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="mt-5 block text-sm font-semibold">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} className="mt-2 editor-input" /></label><label className="mt-5 block text-sm font-semibold">Answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} className="mt-2 editor-input" /></label><label className="mt-5 block text-sm font-semibold">Explanation <span className="font-normal text-[#66807a]">optional</span><textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} className="mt-2 editor-input" /></label><label className="mt-5 block text-sm font-semibold">Tags <span className="font-normal text-[#66807a]">comma separated</span><input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-2 editor-input" /></label>{type === "multiple_choice" && <label className="mt-5 block text-sm font-semibold">Choices <span className="font-normal text-[#66807a]">one per line, including the answer</span><textarea value={choices} onChange={(event) => setChoices(event.target.value)} rows={5} className="mt-2 editor-input" /> </label>}{type === "debug_code" && <><label className="mt-5 block text-sm font-semibold">Language<input value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-2 editor-input" /></label><label className="mt-5 block text-sm font-semibold">Code snippet<textarea value={codeSnippet} onChange={(event) => setCodeSnippet(event.target.value)} rows={8} className="mt-2 editor-input font-mono" /></label></>}<button type="button" onClick={save} disabled={isPending} className="mt-6 min-h-12 w-full rounded-xl bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0b625b] active:translate-y-px disabled:cursor-wait disabled:opacity-50 dark:bg-[#2dd4bf] dark:text-[#10221f]">{isPending ? "Saving..." : "Save item"}</button>{status && <p className="mt-4 text-sm text-[#55716a] dark:text-[#a8bdb7]" role="status">{status}</p>}</section></div></main>;
}
