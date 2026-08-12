import { getQuestionText } from "../domain/eligibility";
import type { StudyQuestion } from "../domain/types";

export const STUDY_ITEMS_PAGE_SIZE = 5;

export function getStudyItemsPageCount(
  itemCount: number,
  pageSize = STUDY_ITEMS_PAGE_SIZE,
): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

export function getStudyItemsPage<T>(
  items: T[],
  page: number,
  pageSize = STUDY_ITEMS_PAGE_SIZE,
): T[] {
  const safePage = Math.max(1, page);
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function getStudyItemsPageRange(
  itemCount: number,
  page: number,
  pageSize = STUDY_ITEMS_PAGE_SIZE,
): { start: number; end: number } {
  if (itemCount === 0) return { start: 0, end: 0 };
  const safePage = Math.max(1, page);
  return {
    start: (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, itemCount),
  };
}

export function getStudyItemsPageWindow(
  currentPage: number,
  pageCount: number,
): number[] {
  if (pageCount <= 0) return [];
  const safePage = Math.min(Math.max(1, currentPage), pageCount);
  const start = Math.max(1, safePage - 1);
  const end = Math.min(pageCount, safePage + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function filterStudyQuestions(
  questions: StudyQuestion[],
  search: string,
): StudyQuestion[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return questions;

  return questions.filter((question) => {
    const searchableText = [
      getQuestionText(question),
      ...(question.concepts ?? []),
    ].join(" ").toLocaleLowerCase();
    return searchableText.includes(normalizedSearch);
  });
}

export function toggleStudyQuestionSelection(
  selectedIds: string[],
  questionId: string,
): string[] {
  return selectedIds.includes(questionId)
    ? selectedIds.filter((id) => id !== questionId)
    : [...selectedIds, questionId];
}

export function selectVisibleStudyQuestions(
  selectedIds: string[],
  visibleQuestions: StudyQuestion[],
): string[] {
  return [...new Set([...selectedIds, ...visibleQuestions.map((question) => question.id)])];
}

export function clearStudyQuestionSelection(): string[] {
  return [];
}

export function getSelectedStudyQuestions(
  questions: StudyQuestion[],
  selectedIds: string[],
): StudyQuestion[] {
  const selected = new Set(selectedIds);
  return questions.filter((question) => selected.has(question.id));
}
