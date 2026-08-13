import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createStudyItem: vi.fn(),
  deleteStudyItem: vi.fn(),
  ensureStudySet: vi.fn(),
  exportStudySet: vi.fn(),
  importStudyItems: vi.fn(),
  moveStudyItem: vi.fn(),
  updateStudyItem: vi.fn(),
  updateStudySet: vi.fn(),
}));

vi.mock("@/lib/study/repository", () => repository);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createStudyItemAction, updateStudyItemAction } from "./actions";

describe("study item server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a normalized basic item with tags", async () => {
    const result = await createStudyItemAction("set-1", {
      type: "flashcard",
      question: "  What is React?  ",
      answer: "  A UI library. ",
      tags: ["React", " Core "],
    });

    expect(result.ok).toBe(true);
    expect(repository.createStudyItem).toHaveBeenCalledWith("set-1", expect.objectContaining({
      question: "What is React?",
      answer: "A UI library.",
      tags: ["React", "Core"],
    }));
  });

  it("preserves code fields and explicit choices when creating", async () => {
    await createStudyItemAction("set-1", {
      type: "debug_code",
      task: "identify-bug",
      question: "What is wrong with this effect?",
      answer: "It creates an update loop.",
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "tsx",
      choices: ["It creates an update loop.", "It is pure.", "It cannot run."],
    });

    expect(repository.createStudyItem).toHaveBeenCalledWith("set-1", expect.objectContaining({
      type: "debug-code",
      task: "identify-bug",
      codeSnippet: "useEffect(() => setCount(count + 1), [count]);",
      language: "tsx",
      choices: ["It creates an update loop.", "It is pure.", "It cannot run."],
    }));
  });

  it("updates the existing canonical ID instead of creating a replacement", async () => {
    const result = await updateStudyItemAction("set-1", "item-42", {
      type: "write",
      question: "Updated question",
      answer: "Updated answer",
      explanation: "Updated explanation",
      tags: ["React", "Hooks", "useEffect"],
      codeSnippet: "const value = 1;",
      language: "tsx",
      task: "explain-behavior",
    });

    expect(result.ok).toBe(true);
    expect(repository.updateStudyItem).toHaveBeenCalledWith("set-1", "item-42", expect.objectContaining({
      question: "Updated question",
      tags: ["React", "Hooks", "useEffect"],
      codeSnippet: "const value = 1;",
    }));
    expect(repository.createStudyItem).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const result = await createStudyItemAction("set-1", {
      type: "flashcard",
      question: "",
      answer: "Answer",
    });

    expect(result).toEqual({ ok: false, message: 'missing "question"' });
    expect(repository.createStudyItem).not.toHaveBeenCalled();
  });
});
