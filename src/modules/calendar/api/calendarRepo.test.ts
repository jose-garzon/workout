import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { getCompletedInRange } from "./calendarRepo";

/**
 * Real Dexie against fake-indexeddb (design.md §8): the range read returns only
 * in-range sessions, both bounds inclusive, projected to `{ completedAt, dayId }`.
 */

async function seed(id: string, completedAt: number, dayId: string) {
  await db.completedSessions.put({
    id,
    routineId: "active",
    dayId,
    completedAt,
    exerciseLogs: [],
  });
}

beforeEach(async () => {
  await db.completedSessions.clear();
});

describe("getCompletedInRange", () => {
  it("returns only sessions inside the inclusive range, projected", async () => {
    await seed("a", 100, "push");
    await seed("b", 200, "pull");
    await seed("c", 300, "legs");

    const refs = await getCompletedInRange(100, 200);

    expect(refs).toEqual([
      { completedAt: 100, dayId: "push" },
      { completedAt: 200, dayId: "pull" },
    ]);
  });

  it("returns an empty array when nothing falls in range", async () => {
    await seed("a", 100, "push");
    expect(await getCompletedInRange(500, 900)).toEqual([]);
  });
});
