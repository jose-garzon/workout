import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import type { Routine } from "../types";
import { getActive, saveActive } from "./routineRepo";

/**
 * Real Dexie against fake-indexeddb (design.md §6). Proves the singleton-row
 * invariant (§D6): save→read round-trips, a second save leaves exactly one row,
 * and an empty store reads null.
 */

function makeRoutine(name: string): Routine {
  return {
    id: crypto.randomUUID(),
    name,
    subtitle: `${name} — let's go`,
    createdAt: Date.now(),
    active: true,
    days: [
      {
        id: crypto.randomUUID(),
        name: "Push",
        exercises: [
          {
            id: crypto.randomUUID(),
            name: "Bench Press",
            sets: [{ reps: 8, restSeconds: 120 }],
          },
        ],
      },
    ],
  };
}

beforeEach(async () => {
  await db.routines.clear();
});

describe("getActive", () => {
  it("returns null when no routine has been saved", async () => {
    expect(await getActive()).toBeNull();
  });
});

describe("saveActive", () => {
  it("round-trips the routine through the singleton row", async () => {
    const routine = makeRoutine("PPL");
    await saveActive(routine);

    const read = await getActive();
    expect(read?.name).toBe("PPL");
    expect(read?.subtitle).toBe("PPL — let's go");
    expect(read?.days).toHaveLength(1);
    expect(read?.days[0].exercises[0].sets[0].restSeconds).toBe(120);
  });

  it("keeps exactly one active routine after a replacement", async () => {
    await saveActive(makeRoutine("First"));
    await saveActive(makeRoutine("Second"));

    expect(await db.routines.count()).toBe(1);
    expect((await getActive())?.name).toBe("Second");
  });

  it("survives a db close/reopen (reload)", async () => {
    await saveActive(makeRoutine("Persisted"));

    db.close();
    await db.open();

    expect((await getActive())?.name).toBe("Persisted");
  });

  it("omits subtitle on the row when the routine has none", async () => {
    const { subtitle: _omit, ...noSubtitle } = makeRoutine("NoSub");
    await saveActive(noSubtitle);

    const row = await db.routines.get("active");
    expect(row).toBeDefined();
    expect("subtitle" in (row as object)).toBe(false);
  });
});
