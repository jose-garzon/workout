import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { saveInProgress } from "../api/sessionRepo";
import type { WorkoutSession } from "../types";
import { useWorkoutStore } from "./store";
import { useWorkoutSession } from "./useWorkoutSession";

/**
 * Seam-level behavior against a real store + fake-indexeddb (design.md
 * §D4/§D5/§D11, tasks 4.7): timestamp resume, the work-anchor reset, the finish
 * write ordering, and the display-unit weight round-trip. The clock is faked
 * (Date only) so timer derivation is deterministic while Dexie's real
 * microtasks/timers keep working.
 */

// `saveActive` stores the routine under the singleton id "active", so
// `useActiveRoutine()` always reports `routine.id === "active"` — which is what
// the seam uses to key the in-progress session (`active:<dayId>`).
const ROUTINE_ID = "active";
const SESSION_ID = "active:d1";

/**
 * Seed the active routine straight into Dexie (the singleton row id is "active",
 * matching `routineRepo`). Written directly rather than through the other
 * feature's repo, which would be a cross-feature deep import (firewall rule 3).
 */
async function seedRoutine() {
  await db.routines.put({
    id: ROUTINE_ID,
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: [
          { id: "e1", name: "Bench", sets: [{ reps: 8, restSeconds: 120 }] },
          { id: "e2", name: "Squat", sets: [{ reps: 5, restSeconds: 120 }] },
        ],
      },
    ],
  });
}

function persistedSession(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: SESSION_ID,
    routineId: ROUTINE_ID,
    dayId: "d1",
    startedAt: 0,
    defaultRestSeconds: 120,
    exerciseLogs: [],
    currentExerciseIndex: 0,
    enteredWeightKg: null,
    currentSeries: [],
    accumRestSeconds: 0,
    phase: "work",
    anchorTs: 0,
    ...overrides,
  };
}

async function seedProfile(unit: "metric" | "imperial") {
  await db.profile.put({ id: "me", gender: "male", age: 30, unit });
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resume (§D4)", () => {
  it("reproduces the exact remaining time from a persisted mid-rest row", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // Rest started at t=1_000_000; 30s have since elapsed.
    await saveInProgress(
      persistedSession({
        phase: "rest",
        anchorTs: 1_000_000,
        currentSeries: [
          { reps: 8, weightKg: 60, workSeconds: 40, volumeKg: 480 },
        ],
      }),
    );
    vi.setSystemTime(1_030_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));

    expect(result.current.timer.phase).toBe("rest");
    expect(result.current.timer.displaySeconds).toBe(90); // 120 − 30
  });

  it("resets the work anchor on resume so a long gap does not inflate workSeconds", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // Work on set 1 (e1 is single-series) abandoned an hour ago.
    await saveInProgress(
      persistedSession({
        phase: "work",
        anchorTs: 1_000_000 - 3_600_000,
        enteredWeightKg: 60,
        currentSeries: [],
      }),
    );
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));

    // The current series' stopwatch restarts from ~0, not ~3600.
    expect(result.current.timer.phase).toBe("work");
    expect(result.current.timer.displaySeconds).toBe(0);

    // The persisted row's anchor moved to now; the in-flight set is not yet
    // banked (a work set is only pushed on the ending tap), so no inflated
    // `workSeconds` can ever land in `currentSeries`.
    const row = await db.sessions.get(SESSION_ID);
    expect(row?.anchorTs).toBe(1_000_000);
    expect(row?.currentSeries).toEqual([]);
  });
});

describe("finish sequence (§D5)", () => {
  it("writes the completed record BEFORE clearing the in-progress row", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // Land already in-progress on the LAST exercise (e2, single series).
    await saveInProgress(
      persistedSession({
        phase: "work",
        currentExerciseIndex: 1,
        anchorTs: 2_000_000,
        enteredWeightKg: 80,
        exerciseLogs: [
          {
            exerciseId: "e1",
            name: "Bench",
            series: [{ reps: 8, weightKg: 60, workSeconds: 40, volumeKg: 480 }],
            restSeconds: 0,
          },
        ],
      }),
    );
    vi.setSystemTime(2_000_000);

    // Record the order of the two durable writes by wrapping the real Dexie
    // methods (captured first, then called through).
    const seq: string[] = [];
    const realPut = db.completedSessions.put.bind(db.completedSessions);
    const realDelete = db.sessions.delete.bind(db.sessions);
    vi.spyOn(db.completedSessions, "put").mockImplementation((row) => {
      seq.push("completed.put");
      return realPut(row);
    });
    vi.spyOn(db.sessions, "delete").mockImplementation((key) => {
      seq.push("sessions.delete");
      return realDelete(key);
    });

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));

    await act(async () => {
      await result.current.tap();
    });

    expect(result.current.status).toBe("success");
    expect(seq).toEqual(["completed.put", "sessions.delete"]);
    // The finished record is durable; the resume row is gone.
    expect(await db.completedSessions.count()).toBe(1);
    expect(await db.sessions.get(SESSION_ID)).toBeUndefined();
  });
});

describe("weight in the display unit (§D11)", () => {
  it("round-trips imperial: enter lb → store kg → display lb", async () => {
    await seedProfile("imperial");
    await seedRoutine();
    vi.setSystemTime(3_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));

    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.setWeight(225);
    });

    // The seam echoes the display unit exactly…
    expect(result.current.unit).toBe("imperial");
    expect(result.current.weight).toBe(225);
    // …while the record stores canonical kg (~102.06).
    const row = await db.sessions.get(SESSION_ID);
    expect(row?.enteredWeightKg).toBeCloseTo(102.06, 1);
  });
});
