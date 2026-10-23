import { describe, expect, it } from "vitest";
import { parsePortableStudyJson, portableItemFromStudyQuestion, toStudyQuestion } from "./portable";
import { editableItemFromQuestion, portableItemFromEditable } from "../edit/model";
import { canStudyItemInMode, toFlashcardQuestion, toWriteQuestion } from "../domain/eligibility";
import { gradeQuestion } from "../domain/engine";

const item = { type: "verbatim", question: "What was challenging?", memoryHook: "UI migration; phased rollout", answer: "I compared components. We migrated in phases.", sentences: [{ id: "q09-s01", text: "I compared components.", chunks: ["I compared", "components"] }, { id: "q09-s02", text: "We migrated in phases." }], tags: ["Marketing Interview", "Q09", "Verbatim"] };
describe("verbatim import and export", () => {
  it("round-trips JSON, domain, editor, and export without losing metadata", () => {
    const parsed = parsePortableStudyJson(JSON.stringify(item));
    expect(parsed.errors).toEqual([]);
    const question = toStudyQuestion(parsed.validItems[0], "q09", "set");
    expect(JSON.parse(JSON.stringify(portableItemFromStudyQuestion(question)))).toEqual(item);
    expect(JSON.parse(JSON.stringify(portableItemFromEditable(editableItemFromQuestion(question))))).toEqual(item);
    expect(canStudyItemInMode(question, "exact-typing")).toBe(true);
    expect(toFlashcardQuestion(question).answer).toBe(item.answer);
    expect(toWriteQuestion(question).expectedAnswer).toBe(item.answer);
  });
  it.each([
    { sentences: [] }, { sentences: [{ id: "s", text: "" }] },
    { sentences: [{ id: "s", text: "I compared components." }, { id: "s", text: "We migrated in phases." }] },
    { memoryHook: 42 }, { sentences: [{ id: "s", text: item.answer, chunks: [1] }] },
    { answer: "Unrelated answer." },
  ])("rejects invalid metadata: %j", overrides => {
    expect(parsePortableStudyJson(JSON.stringify({ ...item, ...overrides })).errors.length).toBeGreaterThan(0);
  });
  it("accepts semicolon-separated normal flashcards without arrows", () => {
    const answer = "Compare components; migrate in phases; start with lower-impact modules; validate; trace differences; fix";
    const parsed = parsePortableStudyJson(JSON.stringify({ type: "flashcard", question: "How did you migrate?", answer }));
    expect(parsed.errors).toEqual([]);
    const question = toStudyQuestion(parsed.validItems[0], "q1", "set");
    expect(portableItemFromStudyQuestion(question).answer).toBe(answer);
    expect(canStudyItemInMode(question, "exact-typing")).toBe(false);
    expect(gradeQuestion(toWriteQuestion(question), answer.replaceAll(";", ",")).outcome).toBe("correct");
  });
});
