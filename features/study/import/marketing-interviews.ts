import { parsePortableStudyJson, type NormalizedPortableStudyItem } from "./portable";

export const marketingInterviewSources = [
  ["Q09_challenging_project.json", "Q09", "Challenging Project", "What was the most challenging part of your recent project?"],
  ["Q10_learn_new_technology.json", "Q10", "Learning a New Technology", "Tell me about a time you had to learn a new technology."],
  ["Q11_conflict_disagreement.json", "Q11", "Coworker Disagreement", "Tell me about a disagreement with a coworker."],
  ["Q12_deadline_risk.json", "Q12", "Deadline at Risk", "What did you do when a deadline was at risk?"],
  ["Q13_day_to_day.json", "Q13", "Day-to-Day Work", "What does your typical workday look like?"],
  ["Q14_multitasking.json", "Q14", "Multitasking", "How do you manage multiple tasks and priorities?"],
  ["Q15_onshore_offshore.json", "Q15", "Onshore and Offshore Collaboration", "How did you work in an onshore and offshore model?"],
  ["Q16_agile_scrum.json", "Q16", "Agile and Scrum", "Does your company work in a Sprint, Agile, or Scrum style?"],
  ["Q17_sprint_length.json", "Q17", "Sprint Length", "How long is your sprint?"],
] as const;
export type MarketingInterviewSource = typeof marketingInterviewSources[number];
export interface MarketingImportPlan {
  filename: string;
  id: string;
  sourceKey: string;
  title: string;
  description: string;
  ownerId: string | null;
  originalItemCount: number;
  flashcardCount: number;
  verbatimItemCount: number;
  sentenceCounts: number[];
  items: NormalizedPortableStudyItem[];
  errors: string[];
  warnings: string[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Explicit Q09–Q17 manifest prevents accidentally combining different interview questions. */
export function convertMarketingInterview(source: MarketingInterviewSource, input: string): MarketingImportPlan {
  const [filename, code, topic, question] = source;
  const plan: MarketingImportPlan = {
    filename, id: `marketing-interview-${code.toLowerCase()}`,
    sourceKey: `marketing-interview-q09-q17:${code.toLowerCase()}`,
    title: `Marketing Interview ${code}: ${topic}`,
    description: `${code} interview practice: bullet recall and a complete sentence-by-sentence answer.`,
    ownerId: null, originalItemCount: 0, flashcardCount: 0, verbatimItemCount: 0,
    sentenceCounts: [], items: [], errors: [], warnings: [],
  };
  let raw: unknown;
  try { raw = JSON.parse(input.replace(/^\uFEFF/, "")); }
  catch { plan.errors.push("Invalid JSON syntax"); return plan; }
  if (!Array.isArray(raw) || raw.length === 0) { plan.errors.push("Expected a non-empty JSON array"); return plan; }
  plan.originalItemCount = raw.length;
  const verbatim: Record<string, unknown>[] = [];
  const flashcards: unknown[] = [];
  for (const [index, item] of raw.entries()) {
    if (!record(item)) { plan.errors.push(`Item ${index + 1}: expected an object`); continue; }
    const prefix = typeof item.question === "string" ? item.question.match(/^Q0?(\d+):/i)?.[1] : undefined;
    if (prefix !== String(Number(code.slice(1))) || !Array.isArray(item.tags) || !item.tags.includes(code)) {
      plan.errors.push(`Item ${index + 1}: question prefix and tags must identify ${code}; refusing to merge questions`);
    }
    if (item.type === "flashcard") { flashcards.push(item); continue; }
    if (item.type !== "verbatim") { plan.errors.push(`Item ${index + 1}: unsupported source type`); continue; }
    if (code === "Q11" && Array.isArray(item.tags) && item.tags.includes("Manager Variant")) plan.errors.push("Q11 manager variant must remain an optional flashcard");
    if (typeof item.answer !== "string" || !item.answer.trim()) plan.errors.push(`Item ${index + 1}: missing answer`);
    if (!Array.isArray(item.chunks) || item.chunks.length === 0 || item.chunks.some(c => typeof c !== "string" || !c.trim())) plan.errors.push(`Item ${index + 1}: invalid chunks`);
    if (typeof item.memoryHook !== "string" || !item.memoryHook.trim()) plan.errors.push(`Item ${index + 1}: missing memory hook`);
    if (item.sentences !== undefined) plan.errors.push(`Item ${index + 1}: unexpected pre-converted sentences`);
    verbatim.push(item);
  }
  if (verbatim.length === 0) plan.errors.push("No primary verbatim answer found");
  if (plan.errors.length) return plan;
  const sentences = verbatim.map((item, index) => ({
    id: `${code.toLowerCase()}-s${String(index + 1).padStart(2, "0")}`,
    text: item.answer as string, chunks: [...item.chunks as string[]], memoryHook: item.memoryHook as string,
  }));
  const combined = {
    type: "verbatim", question,
    answer: sentences.map(s => s.text).join(" "), sentences,
    memoryHook: sentences.map((s, i) => `${i + 1}. ${s.memoryHook}`).join("\n"),
    tags: [...new Set(verbatim.flatMap(item => item.tags as string[]))],
  };
  // Keep flashcards in their original positions relative to the first verbatim card.
  let inserted = false;
  const converted = raw.flatMap(item => {
    if (item.type === "flashcard") return [item];
    if (inserted) return [];
    inserted = true; return [combined];
  });
  const parsed = parsePortableStudyJson(JSON.stringify(converted));
  plan.errors.push(...parsed.errors.map(error => `Converted item ${error.index + 1}: ${error.message}`));
  if (parsed.syntaxError) plan.errors.push(parsed.syntaxError);
  if (plan.errors.length) return plan;
  plan.items = parsed.validItems;
  // This source uses exact strings. Reject lossy whitespace normalization rather than silently changing it.
  const savedSentences = plan.items.find(item => item.type === "verbatim")?.sentences ?? [];
  if (JSON.stringify(savedSentences) !== JSON.stringify(sentences.map(s => ({ id: s.id, text: s.text, memoryHook: s.memoryHook, chunks: s.chunks })))) {
    plan.errors.push("Source sentence whitespace would be normalized; review before importing");
  }
  plan.flashcardCount = flashcards.length;
  plan.verbatimItemCount = 1;
  plan.sentenceCounts = [sentences.length];
  plan.warnings.push("Legacy top-level chunks converted into ordered sentence records; individual hooks retained and combined for cumulative recall.");
  if (code === "Q11") {
    const manager = flashcards.filter(item => record(item) && Array.isArray(item.tags) && item.tags.includes("Manager Variant"));
    if (manager.length !== 1) plan.errors.push("Expected exactly one separate Q11 manager-variant flashcard");
    plan.warnings.push("Coworker story is the primary verbatim answer; manager variant remains an optional flashcard.");
  }
  return plan;
}

/** Compare content, never IDs, timestamps, source hashes or progress. Tag order/case is shared DB presentation. */
export function canonicalImportItem(item: NormalizedPortableStudyItem): unknown {
  return {
    type: item.type, question: item.question, answer: item.answer,
    explanation: item.explanation ?? "", tags: [...new Set(item.tags.map(tag => tag.toLowerCase()))].sort(),
    choices: item.choices ?? [], codeSnippet: item.codeSnippet ?? "", language: item.language ?? "", task: item.task ?? "",
    memoryHook: item.memoryHook ?? "",
    sentences: (item.sentences ?? []).map(s => ({ id: s.id, text: s.text, chunks: s.chunks ?? [], memoryHook: s.memoryHook ?? "" })),
  };
}
