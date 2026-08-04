import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import type { CompletedSession, ExerciseLog, WorkoutSession } from "../types";
import {
  clearInProgress,
  getCompletedForRoutine,
  getInProgress,
  getPreviousReps,
  getPreviousWeight,
  saveCompleted,
  saveInProgress,
  updateRatings,
} from "./sessionRepo";

/**
 * Real Dexie against fake-indexeddb (design.md §6). Proves the two id spaces
 * (§D5), the ratings update, and the previous-weight scan (§D6).
 */

/**
 * An `ExerciseLog` whose single series carries `weightKg` — enough to exercise
 * the previous-weight scan (§D6). Pass a list of weights to build multiple sets.
 */
function log(exerciseId: string, ...weightsKg: number[]): ExerciseLog {
  return {
    exerciseId,
    name: exerciseId,
    series: weightsKg.map((weightKg) => ({
      reps: 8,
      weightKg,
      workSeconds: 30,
      volumeKg: weightKg * 8,
    })),
    restSeconds: 180,
  };
}

function inProgress(): WorkoutSession {
  return {
    id: "r1:d1",
    routineId: "r1",
    dayId: "d1",
    startedAt: 1000,
    defaultRestSeconds: 90,
    exerciseLogs: [],
    currentExerciseIndex: 0,
    enteredWeightKg: 60,
    enteredReps: null,
    currentSeries: [{ reps: 8, weightKg: 60, workSeconds: 45, volumeKg: 480 }],
    accumRestSeconds: 0,
    phase: "rest",
    anchorTs: 2000,
  };
}

function completed(
  id: string,
  completedAt: number,
  logs: ExerciseLog[],
  routineId = "r1",
): CompletedSession {
  return { id, routineId, dayId: "d1", completedAt, exerciseLogs: logs };
}

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.completedSessions.clear()]);
});

describe("in-progress session (keyed by routine:day)", () => {
  it("saves, reads, and clears a single resumable row per day", async () => {
    expect(await getInProgress("r1", "d1")).toBeNull();

    await saveInProgress(inProgress());
    const read = await getInProgress("r1", "d1");
    expect(read?.phase).toBe("rest");
    expect(read?.enteredWeightKg).toBe(60);
    expect(read?.currentSeries).toEqual([
      { reps: 8, weightKg: 60, workSeconds: 45, volumeKg: 480 },
    ]);

    // A second save for the same day overwrites (one resumable row).
    await saveInProgress({ ...inProgress(), phase: "work" });
    expect(await db.sessions.count()).toBe(1);
    expect((await getInProgress("r1", "d1"))?.phase).toBe("work");

    await clearInProgress("r1", "d1");
    expect(await getInProgress("r1", "d1")).toBeNull();
  });

  it("survives a db close/reopen", async () => {
    await saveInProgress(inProgress());
    db.close();
    await db.open();
    expect((await getInProgress("r1", "d1"))?.enteredWeightKg).toBe(60);
  });
});

describe("completed session + ratings", () => {
  it("saves a completion, then attaches ratings by id", async () => {
    await saveCompleted(completed("c1", 5000, [log("e1", 80)]));
    await updateRatings("c1", { difficulty: 4, fatigue: 3 });

    const row = await db.completedSessions.get("c1");
    expect(row?.difficulty).toBe(4);
    expect(row?.fatigue).toBe(3);
  });
});

describe("getCompletedForRoutine (edit-history §Decision 1)", () => {
  it("filters by routineId, orders newest-first, and caps at the limit", async () => {
    await saveCompleted(completed("a", 1000, [log("e1", 60)], "active"));
    await saveCompleted(completed("b", 3000, [log("e1", 65)], "active"));
    await saveCompleted(completed("c", 2000, [log("e1", 70)], "active"));
    // Different routine — must be excluded.
    await saveCompleted(completed("x", 4000, [log("e1", 99)], "other"));

    const all = await getCompletedForRoutine("active", 20);
    expect(all.map((s) => s.id)).toEqual(["b", "c", "a"]);

    const capped = await getCompletedForRoutine("active", 2);
    expect(capped.map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("returns an empty array when the routine has no completed sessions", async () => {
    await saveCompleted(completed("x", 1000, [log("e1", 60)], "other"));
    expect(await getCompletedForRoutine("active", 20)).toEqual([]);
  });
});

describe("getPreviousWeight (§D6)", () => {
  it("returns the LAST positive-weight series of the most recent matching log", async () => {
    await saveCompleted(completed("c1", 1000, [log("e1", 70)]));
    // Newest: three sets, finishing on 85 → that's the reference.
    await saveCompleted(completed("c2", 2000, [log("e1", 75, 80, 85)]));
    expect(await getPreviousWeight("e1")).toBe(85);
  });

  it("returns null when no completed session contains the exercise", async () => {
    await saveCompleted(completed("c1", 1000, [log("e1", 70)]));
    expect(await getPreviousWeight("nope")).toBeNull();
  });

  it("skips trailing 0-weight sets and falls back to the last real one", async () => {
    // The finishing set is bodyweight (0) → skip it, return the prior 80.
    await saveCompleted(completed("c1", 2000, [log("e1", 75, 80, 0)]));
    expect(await getPreviousWeight("e1")).toBe(80);
  });

  it("scans older sessions when the newest matching log has no positive weight", async () => {
    await saveCompleted(completed("c1", 1000, [log("e1", 60)]));
    await saveCompleted(completed("c2", 2000, [log("e1", 0)]));
    // Newest matching log is all-zero → keep scanning → the earlier real weight.
    expect(await getPreviousWeight("e1")).toBe(60);
  });
});

describe("getPreviousReps (progressive-overload reps default)", () => {
  /** A log whose sets carry explicit varying reps, for the per-index scan. */
  function repsLog(exerciseId: string, ...reps: number[]): ExerciseLog {
    return {
      exerciseId,
      name: exerciseId,
      series: reps.map((r) => ({
        reps: r,
        weightKg: 60,
        workSeconds: 30,
        volumeKg: 60 * r,
      })),
      restSeconds: 90,
    };
  }

  it("returns the per-set reps array from the most recent matching session", async () => {
    await saveCompleted(completed("c1", 1000, [repsLog("e1", 8, 8, 8)]));
    await saveCompleted(completed("c2", 2000, [repsLog("e1", 10, 9, 8)]));
    expect(await getPreviousReps("e1")).toEqual([10, 9, 8]);
  });

  it("returns null when no completed session contains the exercise", async () => {
    await saveCompleted(completed("c1", 1000, [repsLog("e1", 8)]));
    expect(await getPreviousReps("nope")).toBeNull();
  });
});
