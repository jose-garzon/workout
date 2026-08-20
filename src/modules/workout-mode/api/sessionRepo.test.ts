import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import type { CompletedSession, ExerciseLog, WorkoutSession } from "../types";
import {
  clearInProgress,
  getCompletedForRoutine,
  getExerciseHistory,
  getInProgress,
  saveCompleted,
  saveInProgress,
  updateRatings,
} from "./sessionRepo";

/**
 * Real Dexie against fake-indexeddb (design.md §6). Proves the two id spaces
 * (§D5), the ratings update, and the one history scan (prefill-sets D1).
 */

/**
 * An `ExerciseLog` whose sets carry the given weights at a fixed 8 reps — enough
 * to exercise the history scan. Pass several weights to build several sets.
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

describe("getExerciseHistory (prefill-sets D1)", () => {
  /** Sets as `[reps, weightKg]` pairs — reps matter to both answers here. */
  function setsLog(
    exerciseId: string,
    ...sets: Array<[number, number]>
  ): ExerciseLog {
    return {
      exerciseId,
      name: exerciseId,
      series: sets.map(([reps, weightKg]) => ({
        reps,
        weightKg,
        workSeconds: 30,
        volumeKg: reps * weightKg,
      })),
      restSeconds: 90,
    };
  }

  it("returns null when no completed session contains the exercise", async () => {
    await saveCompleted(completed("c1", 1000, [log("e1", 70)]));
    expect(await getExerciseHistory("nope")).toBeNull();
  });

  it("reads both answers off the tail of the most recent matching log", async () => {
    await saveCompleted(completed("c1", 1000, [setsLog("e1", [12, 70])]));
    // Newest: finished on 9 × 85 → that's both the seed and the reference.
    await saveCompleted(
      completed("c2", 2000, [setsLog("e1", [12, 75], [10, 80], [9, 85])]),
    );
    expect(await getExerciseHistory("e1")).toEqual({
      lastSet: { reps: 9, weightKg: 85 },
      lastWeighted: { reps: 9, weightKg: 85 },
    });
  });

  it("DIVERGES when the last set was logged at weight 0 after a real one", async () => {
    await saveCompleted(
      completed("c1", 2000, [setsLog("e1", [12, 75], [10, 80], [8, 0])]),
    );
    // The seed is what you finished on (weight 0 → the field stays empty);
    // the caption still references the last set that carried a weight.
    expect(await getExerciseHistory("e1")).toEqual({
      lastSet: { reps: 8, weightKg: 0 },
      lastWeighted: { reps: 10, weightKg: 80 },
    });
  });

  it("has no reference at all when every logged set was bodyweight", async () => {
    await saveCompleted(completed("c1", 1000, [setsLog("e1", [12, 0])]));
    await saveCompleted(completed("c2", 2000, [setsLog("e1", [15, 0])]));
    expect(await getExerciseHistory("e1")).toEqual({
      lastSet: { reps: 15, weightKg: 0 },
      lastWeighted: null,
    });
  });

  it("finds the reference in an OLDER session than the one that seeds", async () => {
    await saveCompleted(completed("c1", 1000, [setsLog("e1", [12, 60])]));
    await saveCompleted(completed("c2", 2000, [setsLog("e1", [15, 0])]));
    // Newest matching log is all-zero → the seed comes from it, the reference
    // keeps scanning back.
    expect(await getExerciseHistory("e1")).toEqual({
      lastSet: { reps: 15, weightKg: 0 },
      lastWeighted: { reps: 12, weightKg: 60 },
    });
  });

  it("skips a matching log that recorded no sets", async () => {
    await saveCompleted(completed("c1", 1000, [setsLog("e1", [12, 60])]));
    await saveCompleted(completed("c2", 2000, [setsLog("e1")]));
    expect(await getExerciseHistory("e1")).toEqual({
      lastSet: { reps: 12, weightKg: 60 },
      lastWeighted: { reps: 12, weightKg: 60 },
    });
  });
});
