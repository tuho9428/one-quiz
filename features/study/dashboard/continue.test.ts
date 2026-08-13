import { describe, expect, it } from "vitest";

import { selectContinueStudying, type ContinueStudyingCandidate } from "./continue";

function candidate(
  overrides: Partial<ContinueStudyingCandidate> = {},
): ContinueStudyingCandidate {
  return {
    studySetId: "react",
    studySetTitle: "React Interview Prep",
    sessionId: null,
    mode: "flashcard",
    lastStudiedAt: "2026-08-12T12:00:00.000Z",
    completedItems: 0,
    totalItems: 52,
    incomplete: false,
    resumable: false,
    ...overrides,
  };
}

describe("selectContinueStudying", () => {
  it("prefers an incomplete session over newer activity from another set", () => {
    expect(selectContinueStudying([
      candidate({
        studySetId: "react",
        incomplete: true,
        sessionId: "session-react",
        lastStudiedAt: "2026-08-12T10:00:00.000Z",
        completedItems: 18,
      }),
      candidate({
        studySetId: "javascript",
        studySetTitle: "JavaScript Prep",
        lastStudiedAt: "2026-08-12T11:00:00.000Z",
      }),
    ])?.studySetId).toBe("react");
  });

  it("chooses the most recently studied set instead of the newest created set", () => {
    expect(selectContinueStudying([
      candidate({
        studySetId: "older-studied",
        lastStudiedAt: "2026-08-12T12:00:00.000Z",
      }),
      candidate({
        studySetId: "newer-never-studied",
        lastStudiedAt: "",
      }),
    ])?.studySetId).toBe("older-studied");
  });

  it("chooses the latest activity when multiple sets have study history", () => {
    expect(selectContinueStudying([
      candidate({ studySetId: "older", lastStudiedAt: "2026-08-10T12:00:00.000Z" }),
      candidate({ studySetId: "latest", lastStudiedAt: "2026-08-12T12:00:00.000Z" }),
    ])?.studySetId).toBe("latest");
  });

  it("returns no continuation target when there is no study history", () => {
    expect(selectContinueStudying([
      candidate({ lastStudiedAt: "" }),
    ])).toBeNull();
  });

  it("does not treat a completed session as an incomplete session", () => {
    const selected = selectContinueStudying([
      candidate({
        sessionId: null,
        incomplete: false,
        lastStudiedAt: "2026-08-12T12:00:00.000Z",
      }),
    ]);

    expect(selected).toMatchObject({ incomplete: false, sessionId: null });
  });

  it("preserves the incomplete session progress for the dashboard", () => {
    expect(selectContinueStudying([
      candidate({
        incomplete: true,
        sessionId: "session-1",
        completedItems: 18,
        totalItems: 52,
      }),
    ])).toMatchObject({ sessionId: "session-1", completedItems: 18, totalItems: 52 });
  });
});
