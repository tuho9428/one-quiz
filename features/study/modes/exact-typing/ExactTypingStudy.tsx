"use client";

import { useRef, useState } from "react";
import type { FlashcardRating, VerbatimQuestion } from "../../domain/types";
import { saveExactAttempt } from "./actions";
import { buildExactTasks, fillGapCues, firstLetterCues, gradeExactText, selectExactTask, stageLabels, taskKey, wordDiff, type ExactProgressMap, type ExactTask } from "./logic";

function elapsedTime(start: number | null): number {
  return start === null ? 0 : Math.max(0, Date.now() - start);
}

const button = "min-h-11 rounded-xl border border-[#b9cfca] px-4 py-2 font-semibold hover:bg-[#e8f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:opacity-50 dark:border-[#3b5a54] dark:hover:bg-[#20332f]";
const ratingOrder: FlashcardRating[] = ["again", "hard", "good", "easy"];
const panel = "rounded-2xl border border-[#d5e2df] bg-[#fbfdfc] p-5 dark:border-[#2d4440] dark:bg-[#182320] sm:p-8";

export function ExactTypingStudy({ questions, title, initialProgress }: { questions: VerbatimQuestion[]; title: string; initialProgress: ExactProgressMap }) {
  const [progress, setProgress] = useState(initialProgress);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<ExactTask>();
  const sessionId = useRef<string | null>(null);
  const attemptId = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const tasks = buildExactTasks(questions);
  const task = review ?? selectExactTask(tasks, progress);
  const question = questions.find(q => q.id === task?.questionId);
  const completed = tasks.filter(t => progress[taskKey(t)]?.completed).length;
  const grade = task && checked ? gradeExactText(task.target, answer) : undefined;
  const showHook = task && (task.stage === "copy" || task.stage === "fill-gaps" || hint || grade?.outcome === "incorrect");
  const sentence = question?.sentences.find(s => s.id === task?.sentenceId);
  const memoryHook = task?.stage === "cumulative" ? question?.memoryHook : sentence?.memoryHook ?? question?.memoryHook;

  async function rate(rating: FlashcardRating) {
    if (!task || !question || !checked || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError("");
    try {
      sessionId.current ??= crypto.randomUUID();
      attemptId.current ??= crypto.randomUUID();
      const next = await saveExactAttempt({ setId: question.studySetId, task, answer, rating, attemptId: attemptId.current, sessionId: sessionId.current, responseTimeMs: elapsedTime(startedAt.current) });
      setProgress(next); setAnswer(""); setChecked(false); setHint(false); setReview(undefined);
      attemptId.current = null; startedAt.current = null;
      inputRef.current?.focus();
    } catch { setError("Progress could not be saved. Your answer is still here. Try the rating again, or reload if this item was edited."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <main onKeyDown={event => {
    if (!checked || saving || event.repeat || event.nativeEvent.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!/^[0-3]$/.test(event.key)) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    event.preventDefault();
    void rate(ratingOrder[Number(event.key)]);
  }} className="min-h-[100dvh] bg-[#f3f6f5] px-4 py-8 text-[#16322e] dark:bg-[#101817] dark:text-[#edf5f1] sm:px-8 sm:py-12">
    <div className="mx-auto grid max-w-3xl gap-6">
      <header><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f766e] dark:text-[#5eead4]">Exact Typing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 text-[#55716a] dark:text-[#a8bdb7]">Build exact sentences gradually with copy, hints, and recall.</p></header>
      {tasks.length > 0 && <div><label htmlFor="exact-progress">{completed} / {tasks.length} exercises learned · Progress saves after each rating</label><progress id="exact-progress" className="mt-2 h-2 w-full accent-[#0f766e]" value={completed} max={tasks.length} /></div>}
      {!task || !question ? <section className={panel}><h2 className="text-xl font-semibold">{tasks.length ? "Answer practice complete" : "No verbatim items in this selection"}</h2><p className="mt-3">{tasks.length ? "You have recalled every sentence and cumulative answer. You can review an exercise below." : "Import an item with type verbatim and a sentences array to begin."}</p></section> : <section className={panel} aria-labelledby="exact-question">
        <p className="text-sm font-semibold text-[#0f766e] dark:text-[#5eead4]">{stageLabels[task.stage]} · {task.stage === "cumulative" ? `Sentences 1–${task.sentenceNumber}` : `Sentence ${task.sentenceNumber} of ${question.sentences.length}`}</p>
        <h2 id="exact-question" className="mt-3 text-xl font-semibold leading-8">{question.question}</h2>
        {memoryHook && (showHook ? <p className="mt-4 rounded-xl bg-[#e8f1ee] p-3 dark:bg-[#20332f]"><strong>Memory hook:</strong> {memoryHook}</p> : <button type="button" className={`${button} mt-4`} onClick={() => setHint(true)}>Show hint</button>)}
        {task.stage === "copy" && <div className="mt-5"><p className="text-lg leading-8">{task.target}</p>{sentence?.chunks?.length ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sentence chunks">{sentence.chunks.map((chunk, i) => <li className="rounded-lg bg-[#e8f1ee] px-3 py-2 dark:bg-[#20332f]" key={i}>{chunk}</li>)}</ul> : null}</div>}
        {task.stage === "fill-gaps" && <p className="mt-5 break-words font-mono text-lg leading-8">{fillGapCues(task.target)}</p>}
        {task.stage === "first-letters" && <p className="mt-5 break-words font-mono text-lg leading-8">{firstLetterCues(task.target)}</p>}
        <form className="mt-5" onSubmit={event => { event.preventDefault(); if (!checked && answer.trim()) setChecked(true); }}>
          <label htmlFor="exact-answer" className="font-semibold">{task.stage === "cumulative" ? `Type sentences 1–${task.sentenceNumber} in order` : task.stage === "fill-gaps" ? "Type the complete sentence, filling in the gaps" : "Type the complete sentence"}</label>
          <textarea ref={inputRef} id="exact-answer" className="editor-input mt-2 w-full" rows={task.stage === "cumulative" ? 7 : 4} value={answer} maxLength={20000} readOnly={checked} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={event => { startedAt.current ??= Date.now(); setAnswer(event.target.value); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); if (answer.trim() && !checked) setChecked(true); } }} />
          <p className="mt-2 text-sm text-[#55716a] dark:text-[#a8bdb7]">Correct words and order matter. Capitalization, punctuation, and extra spaces are ignored. Ctrl/⌘ + Enter checks.</p>
          {!checked && <button className={`${button} mt-4 bg-[#0f766e] text-white hover:bg-[#115e59]`} disabled={!answer.trim()} type="submit">Check answer</button>}
        </form>
        {grade && <div className="mt-6 border-t border-[#d5e2df] pt-5 dark:border-[#2d4440]" aria-live="polite">
          <h3 className="font-semibold">{grade.outcome === "correct" ? "Exact match" : "Compare the words below, then try again"}</h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Word feedback">{wordDiff(task.target, answer).map((word, index) => <li key={index} className={`rounded-lg border px-2 py-1 text-sm ${word.kind === "correct" ? "border-emerald-500 text-emerald-800 dark:text-emerald-200" : "border-rose-400 text-rose-800 dark:text-rose-200"}`}>{word.kind === "correct" ? `Correct: ${word.actual}` : word.kind === "missing" ? `Missing: ${word.expected}` : word.kind === "extra" ? `Extra: ${word.actual}` : `Replace “${word.actual}” with “${word.expected}”`}</li>)}</ul>
          {grade.outcome !== "correct" && <p className="mt-4 leading-7"><strong>Target:</strong> {task.target}</p>}
          <p className="mt-4 text-sm">{grade.outcome === "correct" ? "Good or Easy advances. Again or Hard repeats this exercise." : "Rate the difficulty. This exercise repeats until you match it exactly and choose Good or Easy."}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{ratingOrder.map((rating, index) => <button key={rating} type="button" className={button} disabled={saving} aria-keyshortcuts={String(index)} title={`Press ${index} after feedback`} onClick={() => void rate(rating)}>{rating[0].toUpperCase() + rating.slice(1)}<kbd className="ml-2 rounded border border-current px-1.5 py-0.5 font-mono text-xs opacity-70">{index}</kbd></button>)}</div>
          <p className="mt-3 text-sm text-[#55716a] dark:text-[#a8bdb7]">After feedback, press 0 (Again), 1 (Hard), 2 (Good), or 3 (Easy).</p>
          {saving && <p role="status" className="mt-3">Saving progress…</p>}
          {error && <p role="alert" className="mt-3 text-rose-700 dark:text-rose-300">{error}</p>}
        </div>}
      </section>}
      {tasks.length > 0 && <details className={panel}><summary className="cursor-pointer font-semibold">Review learned exercises</summary><div className="mt-4 grid gap-2">{tasks.filter(t => progress[taskKey(t)]?.completed).map(t => <button className={`${button} text-left`} type="button" disabled={saving} key={taskKey(t)} onClick={() => { setReview(t); setChecked(false); setAnswer(""); setHint(false); setError(""); attemptId.current = null; startedAt.current = null; }}>{questions.find(q => q.id === t.questionId)?.question} · {t.stage === "cumulative" ? "1–" : ""}{t.sentenceNumber} · {stageLabels[t.stage]}</button>)}</div></details>}
    </div>
  </main>;
}
