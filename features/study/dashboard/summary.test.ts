import { describe, expect, it, vi } from "vitest";

import { loadDashboardStudySets } from "./summary";

describe("loadDashboardStudySets", () => {
  it("loads database-backed item counts and omits unavailable progress", async () => {
    const getProgress = vi.fn(async (studySetId: string) => studySetId === "react" ? [] : [{ mastery: 80, lastReviewedAt: "2026-08-10T10:00:00.000Z" }]);
    const getDueItems = vi.fn(async () => [{ id: "due-1" }]);

    await expect(loadDashboardStudySets([
      { id: "react", title: "React Interview Prep", description: undefined, questions: [{}, {}] },
      { id: "other", title: "Other", description: "A set", questions: [{}] },
    ], getProgress, getDueItems)).resolves.toEqual([
      { id: "react", title: "React Interview Prep", description: "", itemCount: 2 },
      { id: "other", title: "Other", description: "A set", itemCount: 1, mastery: 80, dueCount: 1, lastStudiedAt: "2026-08-10T10:00:00.000Z" },
    ]);
    expect(getDueItems).toHaveBeenCalledTimes(1);
  });

  it("returns an empty dashboard collection without inventing a set", async () => {
    await expect(loadDashboardStudySets([], vi.fn(async () => []), vi.fn(async () => []))).resolves.toEqual([]);
  });
});
