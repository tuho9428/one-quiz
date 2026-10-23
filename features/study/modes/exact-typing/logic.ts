import type { CardLearningStats, GradeResult, VerbatimQuestion } from "../../domain/types";

/** Apostrophes are punctuation: don't, don’t and dont have the same word form. */
export function normalizeExactText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/['’‘ʼ]/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().replace(/\s+/gu, " ");
}
export function exactWords(text: string): string[] {
  return normalizeExactText(text).split(" ").filter(Boolean);
}
export function firstLetterCues(text: string): string {
  return exactWords(text).map(word => word[0] + "_".repeat([...word].length - 1)).join(" ");
}
export function fillGapCues(text: string): string {
  return text.replace(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu, (word, offset: number) => {
    const preceding = text.slice(0, offset).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    return preceding % 2 === 0 ? "_".repeat([...word].length) : word;
  });
}
export interface WordFeedback {
  kind: "correct" | "missing" | "extra" | "replaced";
  expected?: string;
  actual?: string;
}
/** Minimum-edit alignment preserves repeated words and identifies substitutions. */
export function wordDiff(target: string, answer: string): WordFeedback[] {
  const expected = exactWords(target), actual = exactWords(answer);
  const costs = Array.from({ length: expected.length + 1 }, () => new Array<number>(actual.length + 1).fill(0));
  for (let i = 0; i <= expected.length; i++) costs[i][actual.length] = expected.length - i;
  for (let j = 0; j <= actual.length; j++) costs[expected.length][j] = actual.length - j;
  // A replacement costs two edits. This favors retaining known correct words.
  for (let i = expected.length - 1; i >= 0; i--) for (let j = actual.length - 1; j >= 0; j--) {
    costs[i][j] = Math.min(costs[i + 1][j] + 1, costs[i][j + 1] + 1, costs[i + 1][j + 1] + 2 * Number(expected[i] !== actual[j]));
  }
  const feedback: WordFeedback[] = [];
  let i = 0, j = 0;
  while (i < expected.length || j < actual.length) {
    if (i < expected.length && j < actual.length && costs[i][j] === costs[i + 1][j + 1] + 2 * Number(expected[i] !== actual[j])) {
      feedback.push({ kind: expected[i] === actual[j] ? "correct" : "replaced", expected: expected[i++], actual: actual[j++] });
    } else if (i < expected.length && costs[i][j] === costs[i + 1][j] + 1) {
      feedback.push({ kind: "missing", expected: expected[i++] });
    } else feedback.push({ kind: "extra", actual: actual[j++] });
  }
  return feedback;
}
export function gradeExactText(target: string, answer: string): GradeResult {
  const feedback = wordDiff(target, answer);
  const correct = feedback.filter(word => word.kind === "correct").length;
  const exact = feedback.length > 0 && feedback.every(word => word.kind === "correct");
  return { outcome: exact ? "correct" : "incorrect", score: exact ? 100 : Math.round(correct / Math.max(1, feedback.length) * 100) };
}
export const sentenceStages = ["copy", "fill-gaps", "first-letters", "exact"] as const;
export type ExactStage = typeof sentenceStages[number] | "cumulative";
export const stageLabels: Record<ExactStage, string> = { copy: "Copy", "fill-gaps": "Fill Gaps", "first-letters": "First-Letter Cues", exact: "Exact Sentence", cumulative: "Cumulative Recall" };
export interface ExactTask { questionId: string; sentenceId: string; stage: ExactStage; sentenceNumber: number; target: string; }
export interface ExactProgress { completed: boolean; stats: CardLearningStats; }
export type ExactProgressMap = Record<string, ExactProgress>;
export function taskKey(task: ExactTask): string {
  // Include content so edits invalidate only affected exercises, including cumulative prefixes.
  return JSON.stringify([task.questionId, task.sentenceId, task.stage, task.target]);
}
export function buildExactTasks(questions: VerbatimQuestion[]): ExactTask[] {
  return questions.flatMap(question => [
    ...question.sentences.flatMap((sentence, index) => sentenceStages.map(stage => ({ questionId: question.id, sentenceId: sentence.id, stage, sentenceNumber: index + 1, target: sentence.text }))),
    ...question.sentences.map((sentence, index) => ({ questionId: question.id, sentenceId: sentence.id, stage: "cumulative" as const, sentenceNumber: index + 1, target: question.sentences.slice(0, index + 1).map(s => s.text).join(" ") })),
  ]);
}
export function selectExactTask(tasks: ExactTask[], progress: ExactProgressMap): ExactTask | undefined {
  return tasks.find(task => !progress[taskKey(task)]?.completed);
}
