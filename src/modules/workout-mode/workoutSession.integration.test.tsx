import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { useWorkoutStore } from "./logic/store";
import { useWorkoutSession } from "./logic/useWorkoutSession";

/**
 * Full-seam integration (design.md §D3–§D5, tasks 8.1/8.2): a real Zustand store
 * + real Dexie over fake-indexeddb, driving overview → start → work/rest/overtime
 * → finish → success, then a reload-resume. Session tracking is purely local, so
 * `fetch` must never fire across the whole flow.
 */

const SESSION_ID = "active:d1";

/**
 * Bench = 2 series (rest 120), Squat = 1 series — enough to exercise every phase.
 * Seeded straight into Dexie (singleton id "active"); using the other feature's
 * repo here would be a cross-feature deep import (firewall rule 3).
 */
async function seedRoutine() {
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: [
          {
            id: "e1",
            name: "Bench",
            sets: [
              { reps: 8, restSeconds: 120 },
              { reps: 8, restSeconds: 120 },
            ],
          },
          { id: "e2", name: "Squat", sets: [{ reps: 5, restSeconds: 120 }] },
        ],
      },
    ],
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  useWorkoutStore.getState().reset();
  await Promise.all([
    db.sessions.clear(),
    db.completedSessions.clear(),
    db.routines.clear(),
    db.profile.clear(),
  ]);
  await db.profile.put({ id: "me", gender: "male", age: 30, unit: "metric" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("full session (§D3–§D5, no network)", () => {
  it("runs overview → start → work/rest/overtime → finish, persisting correct per-series logs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedRoutine();
    vi.setSystemTime(0);

    const { result, rerender } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));

    // Overview surfaces the plan + the seeded default rest (mode = 120).
    expect(result.current.exercises).toEqual([
      { id: "e1", name: "Bench", plannedSeries: 2, plannedReps: 8 },
      { id: "e2", name: "Squat", plannedSeries: 1, plannedReps: 5 },
    ]);
    expect(result.current.defaultRestSeconds).toBe(120);

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("in-progress");
    expect(result.current.currentExercise?.id).toBe("e1");

    act(() => result.current.setWeight(60));

    // Armed → tap to START series 1 (§D12).
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("work");

    // Series 1 work → rest (40s of work banked).
    vi.setSystemTime(40_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("rest");

    // Let the rest run 10s past the 120s limit → derived overtime.
    vi.setSystemTime(40_000 + 130_000);
    rerender();
    expect(result.current.timer.phase).toBe("overtime");
    expect(result.current.timer.overtimeSeconds).toBe(10);

    // Tap out of overtime → series 2 ARMED (130s of rest banked, §D12).
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("ready");

    // Weight carries over; tap to START series 2.
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("work");

    // Series 2 work → exercise complete (50s of work banked; no trailing rest).
    vi.setSystemTime(170_000 + 50_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("exercise-complete");
    expect(result.current.currentExercise?.isLast).toBe(false);

    // Advance to Squat, weigh it, and finish on its single series.
    await act(async () => {
      await result.current.nextExercise();
    });
    expect(result.current.currentExercise?.id).toBe("e2");
    act(() => result.current.setWeight(80));

    // Armed → tap to START, then finish on the single series.
    await act(async () => {
      await result.current.tap();
    });
    vi.setSystemTime(220_000 + 30_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.status).toBe("success");

    // Exactly one completed record, with per-SET series logs and aggregate rest.
    const completed = await db.completedSessions.toArray();
    expect(completed).toHaveLength(1);
    const [record] = completed;
    expect(record.dayId).toBe("d1");
    expect(record.exerciseLogs).toEqual([
      {
        exerciseId: "e1",
        name: "Bench",
        series: [
          { reps: 8, weightKg: 60, workSeconds: 40, volumeKg: 480 }, // 60 × 8
          { reps: 8, weightKg: 60, workSeconds: 50, volumeKg: 480 },
        ],
        restSeconds: 130, // aggregate across the one inter-set rest
      },
      {
        exerciseId: "e2",
        name: "Squat",
        series: [{ reps: 5, weightKg: 80, workSeconds: 30, volumeKg: 400 }], // 80 × 5
        restSeconds: 0,
      },
    ]);
    // Each SeriesLog's volume is exactly weightKg × reps.
    for (const log of record.exerciseLogs as Array<{
      series: Array<{ reps: number; weightKg: number; volumeKg: number }>;
    }>) {
      for (const set of log.series) {
        expect(set.volumeKg).toBe(set.weightKg * set.reps);
      }
    }

    // The resume row was cleared on finish, and nothing ever hit the network.
    expect(await db.sessions.get(SESSION_ID)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("reload resume (§D4)", () => {
  it("rehydrates the same exercise with weight, series progress, and an exact timer", async () => {
    await seedRoutine();
    vi.setSystemTime(0);

    // First mount: start, weigh, and land mid-rest after series 1.
    const first = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(first.result.current.status).toBe("overview"));
    await act(async () => {
      await first.result.current.start();
    });
    act(() => first.result.current.setWeight(72.5));
    // Tap to START series 1, then end it → rest.
    await act(async () => {
      await first.result.current.tap();
    });
    vi.setSystemTime(35_000);
    await act(async () => {
      await first.result.current.tap();
    });
    expect(first.result.current.timer.phase).toBe("rest");

    // Simulate a page reload: the hot store is gone, Dexie persists.
    first.unmount();
    act(() => useWorkoutStore.getState().reset());

    // 20s pass while "away", then the fresh mount resumes.
    vi.setSystemTime(35_000 + 20_000);
    const second = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() =>
      expect(second.result.current.status).toBe("in-progress"),
    );

    expect(second.result.current.currentExercise?.id).toBe("e1");
    expect(second.result.current.weight).toBe(72.5); // display unit (metric)
    // Series 1's log restored intact (§9.8): 35s of work at 72.5 kg × 8 reps.
    expect(second.result.current.completedSets).toEqual([
      { reps: 8, weight: 72.5, workSeconds: 35, volume: 72.5 * 8 },
    ]);
    // Series 1 done → resting before series 2. The rest anchor (t=35_000) is
    // restored verbatim, so 20s of elapsed rest → remaining = 120 − 20 = 100.
    expect(second.result.current.timer.phase).toBe("rest");
    expect(second.result.current.timer.displaySeconds).toBe(100);
    expect(second.result.current.timer.currentSeries).toBe(2);
  });
});
