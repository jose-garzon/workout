import { describe, expect, it } from "vitest";
import type { DayState, RoutineDay } from "../types";
import { buildDayCards, buildIdleDayCards } from "./model";

/**
 * Every proposal scenario as a unit test against the pure fold (design.md §D2).
 * Days are named `day-N`; a scenario is written as the completed day numbers
 * (oldest → newest) and the expected `[day number, state]` list IN CARD ORDER.
 */

const routineDays = (count: number): RoutineDay[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `day-${i + 1}`,
    name: `Day ${i + 1}`,
    // A distinct exercise count per day, so `exerciseCount` can't accidentally
    // read off the wrong day after reordering.
    exercises: Array.from({ length: i + 1 }, (_, e) => ({
      id: `ex-${i}-${e}`,
      name: "Bench",
      sets: [{ reps: 8, restSeconds: 60 }],
    })),
  }));

/** The cards of a 5-day routine after the given completions, as [day, state]. */
function cycle(
  completed: number[],
  dayCount = 5,
): [number, DayState, number][] {
  const days = routineDays(dayCount);
  return buildDayCards(
    days,
    completed.map((n) => `day-${n}`),
  ).map((card) => [card.position, card.state, card.exerciseCount]);
}

describe("buildDayCards — proposal scenarios", () => {
  it("fresh routine: day 1 is next and first, nothing finished", () => {
    expect(cycle([])).toEqual([
      [1, "next", 1],
      [2, "idle", 2],
      [3, "idle", 3],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("after day 1: day 2 is next, tail stays in routine order", () => {
    expect(cycle([1])).toEqual([
      [2, "next", 2],
      [1, "finished", 1],
      [3, "idle", 3],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("mid-cycle 1,2,3: day 4 is next", () => {
    expect(cycle([1, 2, 3])).toEqual([
      [4, "next", 4],
      [1, "finished", 1],
      [2, "finished", 2],
      [3, "finished", 3],
      [5, "idle", 5],
    ]);
  });

  it("the full set completed on day 5 resets to day 1", () => {
    expect(cycle([1, 2, 3, 4, 5])).toEqual([
      [1, "next", 1],
      [2, "idle", 2],
      [3, "idle", 3],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("the full set completed out of order still resets to day 1, not day 4", () => {
    expect(cycle([1, 2, 4, 5, 3])).toEqual([
      [1, "next", 1],
      [2, "idle", 2],
      [3, "idle", 3],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("re-finishing day 1 at 3/5 restarts the cycle from day 1", () => {
    expect(cycle([1, 2, 3, 1])).toEqual([
      [2, "next", 2],
      [1, "finished", 1],
      [3, "idle", 3],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("re-finishing day 2 at 3/5 restarts the cycle from day 2", () => {
    expect(cycle([1, 2, 3, 2])).toEqual([
      [3, "next", 3],
      [1, "idle", 1],
      [2, "finished", 2],
      [4, "idle", 4],
      [5, "idle", 5],
    ]);
  });

  it("next wins when the pointer wraps onto a finished day", () => {
    expect(cycle([1, 2, 3, 5])).toEqual([
      [1, "next", 1],
      [2, "finished", 2],
      [3, "finished", 3],
      [4, "idle", 4],
      [5, "finished", 5],
    ]);
  });
});

describe("buildDayCards — edges", () => {
  it("returns [] for an empty routine", () => {
    expect(buildDayCards([], ["day-1"])).toEqual([]);
  });

  it("ignores a completed id absent from days and keeps the surviving cycle", () => {
    // An edit renamed day 3 (its id was reminted) — the cycle for the days that
    // survived the edit is kept, NOT reset (design.md §D2).
    const days = routineDays(5).filter((d) => d.id !== "day-3");
    expect(
      buildDayCards(days, ["day-1", "day-2", "day-3"]).map((c) => [
        c.id,
        c.state,
      ]),
    ).toEqual([
      ["day-4", "next"],
      ["day-1", "finished"],
      ["day-2", "finished"],
      ["day-5", "idle"],
    ]);
  });

  it("resets a 1-day routine on every completion", () => {
    expect(cycle([], 1)).toEqual([[1, "next", 1]]);
    expect(cycle([1], 1)).toEqual([[1, "next", 1]]);
    expect(cycle([1, 1], 1)).toEqual([[1, "next", 1]]);
  });

  it("carries the routine position, not the list index", () => {
    const cards = buildDayCards(routineDays(3), ["day-1", "day-2"]);
    expect(cards.map((c) => [c.id, c.position])).toEqual([
      ["day-3", 3],
      ["day-1", 1],
      ["day-2", 2],
    ]);
  });
});

describe("buildIdleDayCards", () => {
  it("returns every day in routine order, all idle", () => {
    expect(buildIdleDayCards(routineDays(3))).toEqual([
      {
        id: "day-1",
        name: "Day 1",
        position: 1,
        exerciseCount: 1,
        state: "idle",
      },
      {
        id: "day-2",
        name: "Day 2",
        position: 2,
        exerciseCount: 2,
        state: "idle",
      },
      {
        id: "day-3",
        name: "Day 3",
        position: 3,
        exerciseCount: 3,
        state: "idle",
      },
    ]);
  });
});
