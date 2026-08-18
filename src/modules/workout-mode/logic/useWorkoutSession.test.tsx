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
    enteredReps: null,
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
        enteredReps: 5,
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

describe("reps default (progressive overload)", () => {
  it("prefills the armed set's reps from the previous session's reps at that set index", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // A prior completed session on e1 finished at 10 reps — one more than plan's 8.
    await db.completedSessions.put({
      id: "prev",
      routineId: ROUTINE_ID,
      dayId: "d1",
      completedAt: 0,
      exerciseLogs: [
        {
          exerciseId: "e1",
          name: "Bench",
          series: [{ reps: 10, weightKg: 60, workSeconds: 30, volumeKg: 600 }],
          restSeconds: 0,
        },
      ],
    });
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.reps).toBe(10));

    act(() => result.current.setReps(12));
    expect(result.current.reps).toBe(12);
    const row = await db.sessions.get(SESSION_ID);
    expect(row?.enteredReps).toBe(12);
  });

  it("does not re-stomp a cleared/retyped reps field back to the default (regression)", async () => {
    await seedProfile("metric");
    await seedRoutine();
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });
    // Auto-filled from the plan (no previous session): 8.
    await waitFor(() => expect(result.current.reps).toBe(8));

    // User clears the field to retype it — must STAY null, not snap back to 8.
    act(() => result.current.setReps(null));
    expect(result.current.reps).toBeNull();
    // Give any stray effect a chance to (wrongly) re-fire before asserting.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.reps).toBeNull();

    // Typing a fresh value sticks too.
    act(() => result.current.setReps(1));
    expect(result.current.reps).toBe(1);
    act(() => result.current.setReps(12));
    expect(result.current.reps).toBe(12);
  });

  it("falls back to the plan's reps when there is no previous session", async () => {
    await seedProfile("metric");
    await seedRoutine();
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    // e1's plan reps is 8 (seedRoutine).
    await waitFor(() => expect(result.current.reps).toBe(8));
  });
});

describe("missingSetFields (the start gate)", () => {
  it("lists reps before weight, shrinks as each is filled, and agrees with canStartSet", async () => {
    await seedProfile("metric");
    await seedRoutine();
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.reps).toBe(8));

    // Both empty → both listed, reps first (focus order).
    act(() => result.current.setReps(null));
    expect(result.current.missingSetFields).toEqual(["reps", "weight"]);
    expect(result.current.canStartSet).toBe(false);

    act(() => result.current.setWeight(60));
    expect(result.current.missingSetFields).toEqual(["reps"]);
    expect(result.current.canStartSet).toBe(false);

    act(() => result.current.setReps(8));
    expect(result.current.missingSetFields).toEqual([]);
    expect(result.current.canStartSet).toBe(true);
  });

  it("is empty outside the ready phase — nothing is armed to block", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // Resume mid-work with neither field entered.
    await saveInProgress(
      persistedSession({ phase: "work", anchorTs: 1_000_000 }),
    );
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));

    expect(result.current.timer.phase).toBe("work");
    expect(result.current.reps).toBeNull();
    expect(result.current.weight).toBeNull();
    expect(result.current.missingSetFields).toEqual([]);
    expect(result.current.canStartSet).toBe(false);
  });

  it("refuses to start the set while reps are empty", async () => {
    await seedProfile("metric");
    await seedRoutine();
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.reps).toBe(8));
    act(() => {
      result.current.setWeight(60);
      result.current.setReps(null);
    });

    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("ready");
  });

  it("lets every set of a first-ever session start: reps prefill from the plan per set index", async () => {
    await seedProfile("metric");
    // A two-set exercise with DIFFERENT reps per set, and no session history.
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
            {
              id: "e1",
              name: "Bench",
              sets: [
                { reps: 8, restSeconds: 120 },
                { reps: 6, restSeconds: 120 },
              ],
            },
          ],
        },
      ],
    });
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    // Set 1: reps come from the plan, weight is the only thing the user enters.
    await waitFor(() => expect(result.current.reps).toBe(8));
    expect(result.current.missingSetFields).toEqual(["weight"]);
    act(() => result.current.setWeight(60));
    expect(result.current.missingSetFields).toEqual([]);
    expect(result.current.canStartSet).toBe(true);

    await act(async () => {
      await result.current.tap(); // ready → work
    });
    vi.setSystemTime(1_030_000);
    await act(async () => {
      await result.current.tap(); // work → rest
    });
    vi.setSystemTime(1_060_000);
    await act(async () => {
      await result.current.tap(); // rest → ready (set 2)
    });

    // Set 2 arms with the plan's reps for INDEX 1 and the carried-over weight,
    // so nothing blocks it.
    await waitFor(() => expect(result.current.reps).toBe(6));
    expect(result.current.weight).toBe(60);
    expect(result.current.missingSetFields).toEqual([]);
    expect(result.current.canStartSet).toBe(true);
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
