import { describe, expect, it } from "vitest";

import type { StudyQuestion } from "../domain/types";
import {
  clearStudyQuestionSelection,
  filterStudyQuestions,
  getStudyItemsPage,
  getStudyItemsPageCount,
  getStudyItemsPageRange,
  getStudyItemsPageWindow,
  getSelectedStudyQuestions,
  selectVisibleStudyQuestions,
  toggleStudyQuestionSelection,
} from "./selection";

const questions: StudyQuestion[] = [
  { id: "react", studySetId: "set", type: "write", question: "What is React?", expectedAnswer: "A UI library", importantKeywords: [], concepts: ["React"] },
  { id: "effects", studySetId: "set", type: "write", question: "Explain useEffect", expectedAnswer: "Synchronizes with external systems", importantKeywords: [], concepts: ["React", "Effects"] },
  { id: "api", studySetId: "set", type: "write", question: "What is an API?", expectedAnswer: "A contract", importantKeywords: [], concepts: ["API"] },
];

describe("study item selection", () => {
  it("toggles one or multiple canonical IDs", () => {
    expect(toggleStudyQuestionSelection([], "react")).toEqual(["react"]);
    expect(toggleStudyQuestionSelection(["react"], "effects")).toEqual(["react", "effects"]);
    expect(toggleStudyQuestionSelection(["react", "effects"], "react")).toEqual(["effects"]);
  });

  it("selects all currently visible items without dropping hidden selections", () => {
    expect(selectVisibleStudyQuestions(["api"], questions.slice(0, 2))).toEqual(["api", "react", "effects"]);
  });

  it("filters by question text and tags", () => {
    expect(filterStudyQuestions(questions, "useEffect").map((question) => question.id)).toEqual(["effects"]);
    expect(filterStudyQuestions(questions, "api").map((question) => question.id)).toEqual(["api"]);
  });

  it("returns selected questions in canonical set order and clears all", () => {
    expect(getSelectedStudyQuestions(questions, ["api", "react"]).map((question) => question.id)).toEqual(["react", "api"]);
    expect(clearStudyQuestionSelection()).toEqual([]);
  });

  it("paginates filtered results in five-item pages", () => {
    expect(getStudyItemsPageCount(12)).toBe(3);
    expect(getStudyItemsPage(["a", "b", "c", "d", "e", "f"], 2)).toEqual(["f"]);
    expect(getStudyItemsPageRange(12, 2)).toEqual({ start: 6, end: 10 });
    expect(getStudyItemsPageRange(0, 1)).toEqual({ start: 0, end: 0 });
    expect(getStudyItemsPageWindow(5, 8)).toEqual([4, 5, 6]);
    expect(getStudyItemsPageWindow(1, 8)).toEqual([1, 2]);
    expect(getStudyItemsPageWindow(8, 8)).toEqual([7, 8]);
  });
});
