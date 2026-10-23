import { describe, expect, it } from "vitest";
import { buildExactTasks, fillGapCues, firstLetterCues, gradeExactText, normalizeExactText, selectExactTask, taskKey, wordDiff } from "./logic";
import { createInitialLearningStats } from "../../domain/engine";
import type { VerbatimQuestion } from "../../domain/types";

const question: VerbatimQuestion = { id: "q09", studySetId: "set", type: "verbatim", question: "What was challenging?", answer: "I compared components. We migrated in phases.", sentences: [{ id: "s1", text: "I compared components." }, { id: "s2", text: "We migrated in phases." }] };
describe("exact text grading", () => {
  it("ignores case, punctuation, curly apostrophes and whitespace", () => {
    expect(normalizeExactText("  I’m READY; let’s go!  ")).toBe("im ready lets go");
    expect(gradeExactText("I’m ready; let’s go!", "I'M   READY lets go")).toEqual({ outcome: "correct", score: 100 });
    expect(gradeExactText("Compare; validate; fix.", "compare, validate fix").outcome).toBe("correct");
  });
  it("requires order, all words, repetitions, and exact spelling", () => {
    for (const answer of ["components compared I", "I compare components", "I compared", "I I compared components"]) expect(gradeExactText("I compared components", answer).outcome).toBe("incorrect");
    expect(gradeExactText("", "").outcome).toBe("incorrect");
  });
  it("generates first-letter cues including one-letter words", () => {
    expect(firstLetterCues("One of the UI issues.")).toBe("o__ o_ t__ u_ i_____");
    expect(firstLetterCues("I’m ready!")).toBe("i_ r____");
    expect(firstLetterCues(" ")).toBe("");
    expect(fillGapCues("I compared components.")).toBe("_ compared __________.");
  });
  it("identifies correct, missing, extra and replaced words", () => {
    expect(wordDiff("we migrated in phases", "we moved phases today")).toEqual([
      { kind: "correct", expected: "we", actual: "we" },
      { kind: "replaced", expected: "migrated", actual: "moved" },
      { kind: "missing", expected: "in" },
      { kind: "correct", expected: "phases", actual: "phases" },
      { kind: "extra", actual: "today" },
    ]);
    expect(wordDiff("we we test", "we test").filter(w => w.kind === "missing")).toHaveLength(1);
    expect(wordDiff("a b", "").every(w => w.kind === "missing")).toBe(true);
    expect(wordDiff("", "a b").every(w => w.kind === "extra")).toBe(true);
  });
});
describe("sentence and cumulative progression", () => {
  it("learns each sentence through all stages, then grows cumulative prefixes", () => {
    const tasks = buildExactTasks([question]);
    expect(tasks.map(t => t.stage)).toEqual(["copy", "fill-gaps", "first-letters", "exact", "copy", "fill-gaps", "first-letters", "exact", "cumulative", "cumulative"]);
    expect(tasks.slice(-2).map(t => t.target)).toEqual(["I compared components.", question.answer]);
    const stats = createInitialLearningStats(question.id, question.studySetId);
    const progress = Object.fromEntries(tasks.slice(0, 8).map(t => [taskKey(t), { completed: true, stats }]));
    expect(selectExactTask(tasks, progress)).toEqual(tasks[8]);
    progress[taskKey(tasks[8])] = { completed: false, stats };
    expect(selectExactTask(tasks, progress)).toEqual(tasks[8]);
    for (const task of tasks) progress[taskKey(task)] = { completed: true, stats };
    expect(selectExactTask(tasks, progress)).toBeUndefined();
  });
  it("resumes the first unfinished exercise and invalidates edited targets", () => {
    const tasks = buildExactTasks([question]);
    const progress = { [taskKey(tasks[0])]: { completed: true, stats: createInitialLearningStats(question.id, question.studySetId) } };
    expect(selectExactTask(tasks, progress)?.stage).toBe("fill-gaps");
    expect(selectExactTask(buildExactTasks([{ ...question, sentences: [{ id: "s1", text: "New sentence." }] }]), progress)?.stage).toBe("copy");
    expect(selectExactTask([], {})).toBeUndefined();
  });
});
