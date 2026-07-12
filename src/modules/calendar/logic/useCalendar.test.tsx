import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { useCalendar } from "./useCalendar";

/**
 * Seam-level behavior against real Dexie + fake-indexeddb (design.md §8). The
 * clock is pinned to Fri 11 Jul 2025 12:00 local so the current week is Mon 7 →
 * Sun 13 Jul and sessions can be seeded relative to it.
 */

const NOW = new Date(2025, 6, 11, 12, 0).getTime(); // Fri 11 Jul 2025

/** Local ms for a day of the current week. */
function day(d: number, h = 12): number {
  return new Date(2025, 6, d, h).getTime();
}

async function seedSession(id: string, completedAt: number, dayId: string) {
  await db.completedSessions.put({
    id,
    routineId: "active",
    dayId,
    completedAt,
    exerciseLogs: [],
  });
}

async function seedRoutine() {
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      { id: "push", name: "Push", exercises: [] },
      { id: "pull", name: "Pull", exercises: [] },
      { id: "legs", name: "Legs", exercises: [] },
    ],
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await Promise.all([db.completedSessions.clear(), db.routines.clear()]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCalendar", () => {
  it("null weeklyProgress and joined names when there is no active routine", async () => {
    await seedSession("a", day(8), "push");

    const { result } = renderHook(() => useCalendar());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weeklyProgress).toBeNull();
    // No routine → no dayId→name map, so the worked day carries a null name.
    expect(result.current.week[1].worked).toBe(true);
    expect(result.current.week[1].sessionName).toBeNull();
  });

  it("counts distinct worked days, not sessions", async () => {
    await seedRoutine();
    await seedSession("a", day(8, 7), "push"); // Tue morning
    await seedSession("b", day(8, 19), "pull"); // Tue evening — same day
    await seedSession("c", day(10), "legs"); // Thu

    const { result } = renderHook(() => useCalendar());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 3 sessions across 2 days → completed = 2 (of the 3 routine days).
    expect(result.current.weeklyProgress).toEqual({ completed: 2, target: 3 });
    // Most-recent session that day wins the name.
    expect(result.current.week[1].sessionName).toBe("Pull");
  });

  it("re-buckets against a live clock: a session after midnight shifts the week", async () => {
    await seedRoutine();
    // Mount late on Sunday 13 Jul — the current week is Mon 7 → Sun 13.
    vi.setSystemTime(new Date(2025, 6, 13, 23, 59).getTime());

    const { result } = renderHook(() => useCalendar());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.week[0].date).toBe("2025-07-07");

    // Cross midnight into a NEW ISO week, then complete a session on Monday 14.
    // Its Dexie emit re-renders us; the week must follow the live clock, not the
    // pinned query bound (frozen `now` would keep showing Mon 7 → Sun 13 and
    // hide the new session).
    vi.setSystemTime(new Date(2025, 6, 14, 0, 5).getTime());
    await seedSession("mon", new Date(2025, 6, 14, 0, 5).getTime(), "push");

    await waitFor(() => expect(result.current.week[0].date).toBe("2025-07-14"));
    expect(result.current.week[6].date).toBe("2025-07-20");
    expect(result.current.week[0].worked).toBe(true);
    expect(result.current.week[0].sessionName).toBe("Push");
  });

  it("exposes the full current-month name from the live clock", async () => {
    const { result } = renderHook(() => useCalendar());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Clock pinned to Fri 11 Jul 2025.
    expect(result.current.month).toBe("July");
  });

  it("exposes exactly 7 Monday→Sunday cells and a year grid", async () => {
    await seedRoutine();

    const { result } = renderHook(() => useCalendar());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.week).toHaveLength(7);
    expect(result.current.week[0].date).toBe("2025-07-07");
    expect(result.current.week[6].date).toBe("2025-07-13");
    // 2025 → 365 days + 2 leading pad cells (Jan 1 is a Wednesday).
    expect(result.current.yearGrid).toHaveLength(367);
    expect(result.current.yearGrid[0].date).toBeNull();
  });
});
