import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { saveCompleted } from "./api/sessionRepo";
import { useSessionSummary } from "./logic/useSessionSummary";
import type { CompletedSession } from "./types";

/**
 * `useSessionSummary` over real Dexie (fake-indexeddb) + a legal D→B read of the
 * active routine (routine-edit-history design.md §Decision 3): no routine → null;
 * routine + zero sessions → null; routine + sessions → non-null; and the live
 * query re-emits when a completed session is logged mid-mount.
 */

async function seedActiveRoutine() {
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      {
        id: "day-push",
        name: "Push",
        exercises: [
          {
            id: "ex-bench",
            name: "Bench Press",
            sets: [{ reps: 8, restSeconds: 120 }],
          },
        ],
      },
    ],
  });
}

function benchSession(
  id: string,
  completedAt: number,
  weightKg: number,
): CompletedSession {
  return {
    id,
    routineId: "active",
    dayId: "day-push",
    completedAt,
    exerciseLogs: [
      {
        exerciseId: "ex-bench",
        name: "Bench Press",
        series: [
          { reps: 8, weightKg, workSeconds: 30, volumeKg: weightKg * 8 },
        ],
        restSeconds: 120,
      },
    ],
  };
}

beforeEach(async () => {
  await Promise.all([db.routines.clear(), db.completedSessions.clear()]);
});

afterEach(() => {
  cleanup();
});

describe("useSessionSummary", () => {
  it("returns null when there is no active routine", async () => {
    const { result } = renderHook(() => useSessionSummary());
    // Give the live query a chance to emit; it must stay null with no routine.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeNull();
  });

  it("returns null for an active routine with zero completed sessions", async () => {
    await seedActiveRoutine();
    const { result } = renderHook(() => useSessionSummary());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeNull();
  });

  it("returns a non-null summary once history exists", async () => {
    await seedActiveRoutine();
    await saveCompleted(benchSession("s1", 1000, 60));

    const { result } = renderHook(() => useSessionSummary());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toContain("Bench Press");
  });

  it("re-emits when a completed session is added mid-mount", async () => {
    await seedActiveRoutine();
    const { result } = renderHook(() => useSessionSummary());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeNull();

    await saveCompleted(benchSession("s1", 1000, 60));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toContain("Bench Press");
  });
});
