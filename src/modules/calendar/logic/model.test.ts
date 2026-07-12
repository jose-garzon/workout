import { describe, expect, it } from "vitest";
import type { CompletedRef } from "../types";
import {
  buildWeek,
  buildYearGrid,
  dayLabel,
  localDayKey,
  monthName,
  startOfWeek,
  weeklyProgress,
} from "./model";

/**
 * Pure aggregation (design.md §3/§8). All bucketing is LOCAL time — these run in
 * the runner's local zone, so refs are built from local `Date` constructions,
 * not UTC millisecond literals.
 */

/** Local `ms` for a given calendar day + optional time. */
function at(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

function ref(ms: number, dayId: string): CompletedRef {
  return { completedAt: ms, dayId };
}

describe("startOfWeek", () => {
  it("returns Monday 00:00 for a mid-week day", () => {
    // Fri 11 Jul 2025 → Mon 7 Jul 2025.
    const monday = startOfWeek(new Date(2025, 6, 11, 15, 30));
    expect(monday.getFullYear()).toBe(2025);
    expect(monday.getMonth()).toBe(6);
    expect(monday.getDate()).toBe(7);
    expect(monday.getHours()).toBe(0);
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    // Sun 13 Jul 2025 → Mon 7 Jul 2025 (not 14 Jul).
    const monday = startOfWeek(new Date(2025, 6, 13, 9, 0));
    expect(monday.getDate()).toBe(7);
  });

  it("is idempotent on a Monday", () => {
    const monday = startOfWeek(new Date(2025, 6, 7, 0, 0));
    expect(monday.getDate()).toBe(7);
  });
});

describe("localDayKey", () => {
  it("keeps a late-night session on its local calendar day", () => {
    // 23:30 local on 12 Jul stays 12 Jul (never rolls to 13 Jul via UTC).
    expect(localDayKey(at(2025, 7, 12, 23, 30))).toBe("2025-07-12");
  });

  it("zero-pads month and day", () => {
    expect(localDayKey(at(2025, 3, 4, 8))).toBe("2025-03-04");
  });
});

describe("dayLabel", () => {
  it("renders 'weekday day' without a month or a leading zero on the day", () => {
    expect(dayLabel("2025-07-12")).toBe("Sat 12");
    expect(dayLabel("2025-07-01")).toBe("Tue 1");
  });
});

describe("monthName", () => {
  it("renders the full current-month name", () => {
    expect(monthName("2025-07-12")).toBe("July");
    expect(monthName("2025-01-01")).toBe("January");
    expect(monthName("2025-12-31")).toBe("December");
  });
});

describe("buildWeek", () => {
  const names = new Map([
    ["push", "Push"],
    ["pull", "Pull"],
  ]);

  it("marks the worked day and carries its session name", () => {
    const now = at(2025, 7, 11); // Fri
    const week = buildWeek([ref(at(2025, 7, 8), "push")], names, now);

    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2025-07-07"); // Monday first
    expect(week[6].date).toBe("2025-07-13"); // Sunday last

    const tue = week[1];
    expect(tue.date).toBe("2025-07-08");
    expect(tue.worked).toBe(true);
    expect(tue.sessionName).toBe("Push");
  });

  it("uses the most-recent session's name when a day has two", () => {
    const now = at(2025, 7, 11);
    const week = buildWeek(
      [
        ref(at(2025, 7, 8, 7), "push"), // morning
        ref(at(2025, 7, 8, 19), "pull"), // evening — most recent
      ],
      names,
      now,
    );
    expect(week[1].sessionName).toBe("Pull");
  });

  it("yields all placeholders for an empty week", () => {
    const now = at(2025, 7, 11);
    const week = buildWeek([], names, now);
    expect(week.every((d) => !d.worked && d.sessionName === null)).toBe(true);
  });

  it("worked but null name when the routine no longer has that day", () => {
    const now = at(2025, 7, 11);
    const week = buildWeek([ref(at(2025, 7, 8), "legs")], names, now);
    expect(week[1].worked).toBe(true);
    expect(week[1].sessionName).toBeNull();
  });
});

describe("weeklyProgress", () => {
  const week = buildWeek(
    [ref(at(2025, 7, 8), "push"), ref(at(2025, 7, 10), "pull")],
    new Map([
      ["push", "Push"],
      ["pull", "Pull"],
    ]),
    at(2025, 7, 11),
  );

  it("is null without an active routine", () => {
    expect(weeklyProgress(week, null)).toBeNull();
  });

  it("counts distinct worked days against the routine day count", () => {
    expect(weeklyProgress(week, { days: [0, 1, 2] })).toEqual({
      completed: 2,
      target: 3,
    });
  });
});

describe("buildYearGrid", () => {
  it("pads with null cells to align Jan 1 under its Monday column", () => {
    // 1 Jan 2025 is a Wednesday → 2 pad cells (Mon, Tue) before it.
    const grid = buildYearGrid([], 2025);
    const pad = grid.filter((c) => c.date === null);
    expect(pad).toHaveLength(2);
    expect(grid[2].date).toBe("2025-01-01");
  });

  it("has no pad when Jan 1 is a Monday", () => {
    // 1 Jan 2024 is a Monday → zero pad cells.
    const grid = buildYearGrid([], 2024);
    expect(grid[0].date).toBe("2024-01-01");
  });

  it("covers exactly the days of the year plus the pad", () => {
    const grid = buildYearGrid([], 2025); // 365 days + 2 pad
    expect(grid).toHaveLength(367);
    expect(grid.at(-1)?.date).toBe("2025-12-31");
  });

  it("marks a worked day and ignores refs outside the year", () => {
    const grid = buildYearGrid(
      [
        ref(at(2025, 7, 12), "push"), // in-year
        ref(at(2024, 12, 31), "push"), // prior December (from the week lower bound)
      ],
      2025,
    );
    const jul12 = grid.find((c) => c.date === "2025-07-12");
    expect(jul12?.worked).toBe(true);
    // The prior-December ref never appears as a 2025 square.
    expect(grid.some((c) => c.date === "2024-12-31")).toBe(false);
  });
});
