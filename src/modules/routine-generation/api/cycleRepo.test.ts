import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { getCompletedDayIdsSince } from "./cycleRepo";

/** Real Dexie against fake-indexeddb: the bound is inclusive and the order is
 *  the `completedAt` index order (oldest → newest), which the fold depends on. */

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

describe("getCompletedDayIdsSince", () => {
  it("returns [] on an empty table", async () => {
    expect(await getCompletedDayIdsSince(0)).toEqual([]);
  });

  it("excludes rows below the bound, includes a row exactly at it", async () => {
    await seed("below", 999, "day-1");
    await seed("at", 1000, "day-2");
    await seed("above", 1001, "day-3");

    expect(await getCompletedDayIdsSince(1000)).toEqual(["day-2", "day-3"]);
  });

  it("returns dayIds oldest → newest regardless of insertion order", async () => {
    await seed("c", 300, "day-3");
    await seed("a", 100, "day-1");
    await seed("b", 200, "day-2");

    expect(await getCompletedDayIdsSince(0)).toEqual([
      "day-1",
      "day-2",
      "day-3",
    ]);
  });
});
