import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return {
    client,
    pool: { query: vi.fn(), connect: vi.fn(async () => client) },
    getCurrentUserId: vi.fn(async () => "owner-1"),
  };
});

vi.mock("../db", () => ({ pool: mocks.pool }));
vi.mock("../auth", () => ({ getCurrentUserId: mocks.getCurrentUserId }));

import { updateStudyItem } from "./repository";

const setRow = {
  id: "set-1",
  owner_id: "owner-1",
  title: "Set",
  description: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  items: [],
};

function configureAccessibleSet(itemExists = true) {
  mocks.pool.query.mockImplementation(async (sql: string) => {
    if (sql.includes("from study_sets ss")) return { rows: [setRow] };
    return { rows: [], rowCount: 1 };
  });
  mocks.client.query.mockImplementation(async (sql: string) => {
    if (sql.includes("select id from study_items")) return { rows: itemExists ? [{ id: "item-1" }] : [] };
    return { rows: [], rowCount: 1 };
  });
}

describe("study item mutation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureAccessibleSet();
  });

  it("keeps the existing item ID while updating its canonical content", async () => {
    await updateStudyItem("set-1", "item-1", {
      type: "write",
      question: "Updated question",
      answer: "Updated answer",
      tags: [],
    });

    expect(mocks.client.query).toHaveBeenCalledWith(
      expect.stringContaining("where id = $9 and study_set_id = $10"),
      expect.arrayContaining(["item-1", "set-1"]),
    );
    expect(mocks.client.query).toHaveBeenCalledWith("commit");
  });

  it("rejects an item that is not part of the owned study set", async () => {
    configureAccessibleSet(false);

    await expect(updateStudyItem("set-1", "other-item", {
      type: "flashcard",
      question: "Question",
      answer: "Answer",
      tags: [],
    })).rejects.toThrow("Study item not found or not accessible");

    expect(mocks.client.query).toHaveBeenCalledWith("rollback");
    expect(mocks.client.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("update study_items"))).toBe(false);
  });
});
