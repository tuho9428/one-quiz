import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { convertMarketingInterview, marketingInterviewSources, canonicalImportItem } from "./marketing-interviews";
import { parsePortableStudyJson, portableItemFromStudyQuestion, toStudyQuestion } from "./portable";
const read = (name: string) => readFileSync(new URL(`../../../imports/${name}`, import.meta.url), "utf8");

describe("Q09–Q17 import conversion", () => {
  it("converts the exact nine fixtures into 11 flashcards and 9 complete answers without changing source data", () => {
    const counts = [7, 6, 7, 6, 7, 7, 6, 2, 2];
    const sentenceCounts = [6, 5, 5, 5, 5, 6, 5, 1, 1];
    const plans = marketingInterviewSources.map((source, index) => {
      const before = read(source[0]);
      const plan = convertMarketingInterview(source, before);
      expect(plan.errors).toEqual([]);
      expect(plan.originalItemCount).toBe(counts[index]);
      expect(plan.sentenceCounts).toEqual([sentenceCounts[index]]);
      const original = JSON.parse(before);
      const sourceVerbatim = original.filter((item: { type: string }) => item.type === "verbatim");
      const combined = plan.items.find(item => item.type === "verbatim")!;
      expect(combined.sentences?.map(s => s.text)).toEqual(sourceVerbatim.map((item: { answer: string }) => item.answer));
      expect(combined.sentences?.map(s => s.chunks)).toEqual(sourceVerbatim.map((item: { chunks: string[] }) => item.chunks));
      expect(combined.sentences?.map(s => s.memoryHook)).toEqual(sourceVerbatim.map((item: { memoryHook: string }) => item.memoryHook));
      expect(combined.answer).toBe(sourceVerbatim.map((item: { answer: string }) => item.answer).join(" "));
      for (const sourceItem of sourceVerbatim) expect(combined.memoryHook).toContain(sourceItem.memoryHook);
      expect(parsePortableStudyJson(JSON.stringify(plan.items)).errors).toEqual([]);
      const exported = plan.items.map((item, i) => portableItemFromStudyQuestion(toStudyQuestion(item, `q-${i}`, plan.id)));
      expect(parsePortableStudyJson(JSON.stringify(exported)).validItems.map(canonicalImportItem)).toEqual(plan.items.map(canonicalImportItem));
      expect(read(source[0])).toBe(before);
      expect(convertMarketingInterview(source, before)).toEqual(plan);
      return plan;
    });
    expect(new Set(plans.map(p => p.sourceKey)).size).toBe(9);
    expect(plans.reduce((n, p) => n + p.flashcardCount, 0)).toBe(11);
    expect(plans.reduce((n, p) => n + p.verbatimItemCount, 0)).toBe(9);
    expect(plans.reduce((n, p) => n + p.items.length, 0)).toBe(20);
  });
  it("retains Q11's optional manager card outside the coworker answer", () => {
    const source = marketingInterviewSources[2];
    const plan = convertMarketingInterview(source, read(source[0]));
    expect(plan.items.map(i => i.type)).toEqual(["flashcard", "verbatim", "flashcard"]);
    expect(plan.items[2].question).toContain("optional manager");
    expect(plan.items[2].explanation).toContain("only if");
    expect(plan.items[1].question).toContain("coworker");
    expect(plan.items[1].answer).not.toContain("Manager suggested search");
  });
  it("preserves every source flashcard including semicolon answers", () => {
    for (const source of marketingInterviewSources) {
      const raw = JSON.parse(read(source[0]));
      const plan = convertMarketingInterview(source, JSON.stringify(raw));
      const expected = parsePortableStudyJson(JSON.stringify(raw.filter((item: { type: string }) => item.type === "flashcard"))).validItems;
      expect(plan.items.filter(i => i.type === "flashcard")).toEqual(expected);
    }
  });
  it("refuses to merge a card belonging to a different question", () => {
    const source = marketingInterviewSources[0];
    const raw = JSON.parse(read(source[0]));
    raw[2].tags = ["Q10"]; raw[2].question = "Q10: Other question";
    expect(convertMarketingInterview(source, JSON.stringify(raw)).errors.join(" ")).toContain("refusing to merge questions");
  });
  it.each(["{}", "[]", "[", '[{"type":"verbatim","question":"Q9: Test","answer":"x","tags":["Q09"]}]'])("reports invalid input safely: %s", input => {
    expect(convertMarketingInterview(marketingInterviewSources[0], input).errors.length).toBeGreaterThan(0);
  });
  it("rejects missing hooks, invalid chunks, and unsupported types", () => {
    const source = marketingInterviewSources[0];
    for (const mutation of [{ memoryHook: 9 }, { chunks: [2] }, { type: "write" }]) {
      const raw = JSON.parse(read(source[0])); Object.assign(raw[1], mutation);
      expect(convertMarketingInterview(source, JSON.stringify(raw)).errors.length).toBeGreaterThan(0);
    }
  });
});
