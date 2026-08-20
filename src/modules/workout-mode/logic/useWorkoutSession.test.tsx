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
  vi.restoreAllMocks();
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

describe("set 1 seed (prefill-sets D2)", () => {
  /** A completed session for `exerciseId`, sets as `[reps, weightKg]`. */
  async function seedHistory(
    exerciseId: string,
    ...sets: Array<[number, number]>
  ) {
    await db.completedSessions.put({
      id: `prev-${exerciseId}`,
      routineId: ROUTINE_ID,
      dayId: "d1",
      completedAt: 0,
      exerciseLogs: [
        {
          exerciseId,
          name: exerciseId,
          series: sets.map(([reps, weightKg]) => ({
            reps,
            weightKg,
            workSeconds: 30,
            volumeKg: reps * weightKg,
          })),
          restSeconds: 0,
        },
      ],
    });
  }

  it("seeds BOTH fields from the last set of the last session", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // Opened at 12×30, finished at 10×65 — the finish is the seed (plan says 8).
    await seedHistory("e1", [12, 30], [10, 65]);
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.reps).toBe(10));
    expect(result.current.weight).toBe(65);

    // Still fully editable, and the edit persists.
    act(() => result.current.setReps(12));
    expect(result.current.reps).toBe(12);
    const row = await db.sessions.get(SESSION_ID);
    expect(row?.enteredReps).toBe(12);
  });

  it("falls back to the plan when the history read REJECTS", async () => {
    await seedProfile("metric");
    await seedRoutine();
    // A blocked upgrade / quota / private-mode failure, i.e. the read rejects.
    vi.spyOn(db.completedSessions, "orderBy").mockImplementation(() => {
      throw new Error("IndexedDB unavailable");
    });
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    // The effect owns the plan fallback, so a rejected read must still resolve
    // the cache key — otherwise the set arms with both fields empty and no way
    // to start. e1's plan reps is 8.
    await waitFor(() => expect(result.current.reps).toBe(8));
    expect(result.current.previousSet).toBeNull();
  });

  it("seeds reps only when the last set was bodyweight", async () => {
    await seedProfile("metric");
    await seedRoutine();
    await seedHistory("e1", [15, 0]);
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.reps).toBe(15));
    expect(result.current.weight).toBeNull();
  });

  it("does not stomp a field the user filled before the read landed", async () => {
    await seedProfile("metric");
    await seedRoutine();
    await seedHistory("e1", [10, 65]);
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    // Type reps BEFORE starting — i.e. before the seed can commit.
    act(() => result.current.setReps(20));
    await act(async () => {
      await result.current.start();
    });

    // Their reps survive; the weight is still seeded (per-field guard).
    await waitFor(() => expect(result.current.weight).toBe(65));
    expect(result.current.reps).toBe(20);
  });

  it("reseeds from the NEXT exercise's own history on nextExercise", async () => {
    await seedProfile("metric");
    await seedRoutine();
    await seedHistory("e1", [10, 65]);
    await seedHistory("e2", [3, 100]);
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.reps).toBe(10));

    // Finish e1's single set.
    await act(async () => {
      await result.current.tap();
    });
    vi.setSystemTime(1_030_000);
    await act(async () => {
      await result.current.tap();
    });
    await act(async () => {
      await result.current.nextExercise();
    });

    await waitFor(() => expect(result.current.reps).toBe(3));
    expect(result.current.weight).toBe(100);
  });

  it("is a no-op on a resumed session that already holds values", async () => {
    await seedProfile("metric");
    await seedRoutine();
    await seedHistory("e1", [10, 65]);
    // Resumed at set 1, armed, with what the user had entered last time.
    await saveInProgress(
      persistedSession({ phase: "ready", enteredReps: 7, enteredWeightKg: 40 }),
    );
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));
    // Let the history read land, then confirm nothing was overwritten.
    await waitFor(() => expect(result.current.previousSet).not.toBeNull());
    expect(result.current.reps).toBe(7);
    expect(result.current.weight).toBe(40);
  });

  it("moves seedKey on a seed commit but NEVER on a user edit", async () => {
    await seedProfile("metric");
    await seedRoutine();
    await seedHistory("e1", [10, 65]);
    await seedHistory("e2", [3, 100]);
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));
    await waitFor(() => expect(result.current.reps).toBe(10));
    await act(async () => {
      await result.current.start();
    });
    const seeded = result.current.seedKey;

    // Editing either field must not remount the UI's uncontrolled weight input.
    act(() => result.current.setReps(11));
    act(() => result.current.setWeight(70));
    expect(result.current.seedKey).toBe(seeded);

    // …but the next seed commit does move it, stamp included.
    await act(async () => {
      await result.current.tap();
    });
    vi.setSystemTime(1_030_000);
    await act(async () => {
      await result.current.tap();
    });
    await act(async () => {
      await result.current.nextExercise();
    });
    // e2 seeds a different WEIGHT, which is what the stamp exists to signal.
    await waitFor(() => expect(result.current.reps).toBe(3));
    const stamp = (key: string) => Number(key.split(":")[1]);
    expect(stamp(result.current.seedKey)).toBeGreaterThan(stamp(seeded));
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

  it("lets every set of a first-ever session start: the plan's reps per set index", async () => {
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

    // No history ⇒ set 2 takes the plan's index-1 reps (6), NOT set 1's carried
    // 8 (prefill-sets D9). The weight has no per-set plan, so it still carries.
    await waitFor(() => expect(result.current.reps).toBe(6));
    expect(result.current.weight).toBe(60);
    expect(result.current.missingSetFields).toEqual([]);
    expect(result.current.canStartSet).toBe(true);
  });

  /** Three sets, descending plan, never logged — a carried value is unmistakable. */
  async function seedDescendingRoutine() {
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
                { reps: 12, restSeconds: 120 },
                { reps: 10, restSeconds: 120 },
                { reps: 8, restSeconds: 120 },
              ],
            },
          ],
        },
      ],
    });
  }

  it("a resume MID-REST still applies the plan when the next set arms", async () => {
    await seedProfile("metric");
    await seedDescendingRoutine();
    // `tap` banks the finished set on work → rest, so a mid-rest row already
    // counts set 1 — but set 2 has never been armed and is still owed its write.
    await saveInProgress(
      persistedSession({
        phase: "rest",
        anchorTs: 1_000_000,
        currentSeries: [
          { reps: 12, weightKg: 40, workSeconds: 30, volumeKg: 480 },
        ],
        enteredReps: 12,
        enteredWeightKg: 40,
      }),
    );
    vi.setSystemTime(1_030_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));
    expect(result.current.timer.phase).toBe("rest");

    // Tap out of rest → set 2 arms for the first time.
    await act(async () => {
      await result.current.tap();
    });

    // The plan's index-1 reps, NOT the 12 the reducer carried.
    await waitFor(() => expect(result.current.reps).toBe(10));
    expect(result.current.weight).toBe(40);
  });

  it("a resume at set 3 of an unlogged exercise keeps the reps the user typed", async () => {
    await seedProfile("metric");
    await seedDescendingRoutine();
    const done = { reps: 12, weightKg: 40, workSeconds: 30, volumeKg: 480 };
    await saveInProgress(
      persistedSession({
        // ARMED at set 3 — the write it is owed already happened pre-reload.
        phase: "ready",
        currentSeries: [done, done],
        enteredReps: 15, // typed before the reload
        enteredWeightKg: 40,
      }),
    );
    vi.setSystemTime(1_000_000);

    const { result } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("in-progress"));
    // Give the history read time to land and (wrongly) re-apply the plan's 8.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.reps).toBe(15);
    expect(result.current.weight).toBe(40);
  });

  it("leaves seedKey alone when only the reps are re-applied", async () => {
    await seedProfile("metric");
    // No history, so set 2 re-applies the plan's reps — but the weight carries
    // unchanged, and remounting `WeightField` for that would be pointless (D9).
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
                { reps: 12, restSeconds: 120 },
                { reps: 10, restSeconds: 120 },
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
    await waitFor(() => expect(result.current.reps).toBe(12));
    act(() => result.current.setWeight(40));
    const armedKey = result.current.seedKey;

    await act(async () => {
      await result.current.tap(); // ready → work
    });
    vi.setSystemTime(1_030_000);
    await act(async () => {
      await result.current.tap(); // work → rest
    });
    await act(async () => {
      await result.current.tap(); // rest → set 2 armed
    });

    await waitFor(() => expect(result.current.reps).toBe(10));
    expect(result.current.weight).toBe(40);
    expect(result.current.seedKey).toBe(armedKey);
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
