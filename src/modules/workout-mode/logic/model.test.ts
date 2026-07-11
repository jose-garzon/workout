import { describe, expect, it } from "vitest";
import type { RoutineDay } from "@/modules/routine-generation";
import type { ExerciseLog, SeriesLog, WorkoutSession } from "../types";
import {
  advanceExercise,
  defaultRestFor,
  deriveTimer,
  displayToKg,
  exerciseVolumeKg,
  exerciseWorkSeconds,
  initialSession,
  kgToDisplay,
  seriesCount,
  tap,
  toCurrentExerciseView,
  toOverviewExercises,
  toSeriesView,
  unitLabel,
} from "./model";

/**
 * Pure model coverage (design.md §D1/§D3/§D7/§D11, tasks 3.3). Every function is
 * deterministic given an injected `now`, so no clock or Dexie is needed.
 */

function day(
  exercises: RoutineDay["exercises"],
  overrides: Partial<RoutineDay> = {},
): RoutineDay {
  return { id: "d1", name: "Push", exercises, ...overrides };
}

/** A 2-exercise day: Bench (2 series) then Squat (1 series). */
const TWO_EX_DAY = day([
  {
    id: "e1",
    name: "Bench",
    sets: [
      { reps: 8, restSeconds: 120 },
      { reps: 8, restSeconds: 120 },
    ],
  },
  { id: "e2", name: "Squat", sets: [{ reps: 5, restSeconds: 180 }] },
]);

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    ...initialSession({
      routineId: "r1",
      dayId: "d1",
      defaultRestSeconds: 120,
      now: 0,
    }),
    ...overrides,
  };
}

/** A completed-set stub for seeding `currentSeries`. */
function seriesLog(overrides: Partial<SeriesLog> = {}): SeriesLog {
  return {
    reps: 8,
    weightKg: 60,
    workSeconds: 45,
    volumeKg: 480,
    ...overrides,
  };
}

describe("defaultRestFor (§D7)", () => {
  it("returns the mode of every set's restSeconds", () => {
    const d = day([
      { id: "a", name: "A", sets: [{ reps: 8, restSeconds: 90 }] },
      {
        id: "b",
        name: "B",
        sets: [
          { reps: 8, restSeconds: 120 },
          { reps: 8, restSeconds: 120 },
        ],
      },
    ]);
    expect(defaultRestFor(d)).toBe(120);
  });

  it("breaks a tie toward the smaller value", () => {
    const d = day([
      {
        id: "a",
        name: "A",
        sets: [
          { reps: 8, restSeconds: 120 },
          { reps: 8, restSeconds: 60 },
        ],
      },
    ]);
    expect(defaultRestFor(d)).toBe(60);
  });

  it("falls back to 90 when the plan prescribes no rest", () => {
    expect(defaultRestFor(day([]))).toBe(90);
  });
});

describe("plan → view mappers (§D1)", () => {
  it("maps overview exercises with representative reps", () => {
    expect(toOverviewExercises(TWO_EX_DAY)).toEqual([
      { id: "e1", name: "Bench", plannedSeries: 2, plannedReps: 8 },
      { id: "e2", name: "Squat", plannedSeries: 1, plannedReps: 5 },
    ]);
  });

  it("exposes repsPerSet + plannedReps = sets[0].reps and isLast", () => {
    const varied = day([
      {
        id: "e1",
        name: "Bench",
        sets: [
          { reps: 12, restSeconds: 90 },
          { reps: 10, restSeconds: 90 },
          { reps: 8, restSeconds: 90 },
        ],
      },
    ]);
    const view = toCurrentExerciseView(varied, 0);
    expect(view).toMatchObject({
      plannedReps: 12,
      repsPerSet: [12, 10, 8],
      total: 1,
      isLast: true,
    });
  });

  it("returns null for an out-of-range index", () => {
    expect(toCurrentExerciseView(TWO_EX_DAY, 5)).toBeNull();
  });
});

describe("weight conversion (§D11)", () => {
  it("labels the unit", () => {
    expect(unitLabel("metric")).toBe("kg");
    expect(unitLabel("imperial")).toBe("lb");
  });

  it("passes kg through unchanged for metric", () => {
    expect(kgToDisplay(60, "metric")).toBe(60);
    expect(displayToKg(60, "metric")).toBe(60);
  });

  it("round-trips imperial to a stable 0.5-step value", () => {
    const kg = displayToKg(225, "imperial"); // 225 lb → ~102.06 kg
    expect(kgToDisplay(kg, "imperial")).toBe(225);
  });

  it("rounds the display value to a 0.5 step", () => {
    // 100 kg → 220.46 lb → rounds to 220.5
    expect(kgToDisplay(100, "imperial")).toBe(220.5);
  });
});

describe("tap reducer (§D3)", () => {
  it("work → rest when a non-final series ends, banking the set as a SeriesLog", () => {
    const s = session({
      phase: "work",
      anchorTs: 0,
      defaultRestSeconds: 120,
      enteredWeightKg: 60,
    });
    const next = tap(s, TWO_EX_DAY, 45_000); // 45s of work on series 1 of 2

    expect(next.phase).toBe("rest");
    expect(next.currentSeries).toEqual([
      { reps: 8, weightKg: 60, workSeconds: 45, volumeKg: 480 }, // 60 × 8
    ]);
    expect(next.anchorTs).toBe(45_000);
    expect(next.exerciseLogs).toHaveLength(0);
  });

  it("records varied per-set reps exactly (12/10/8) with weight×reps volume", () => {
    const varied = day([
      {
        id: "e1",
        name: "Bench",
        sets: [
          { reps: 12, restSeconds: 90 },
          { reps: 10, restSeconds: 90 },
          { reps: 8, restSeconds: 90 },
        ],
      },
    ]);
    let s = session({ phase: "work", anchorTs: 0, enteredWeightKg: 100 });
    // Set 1 (12 reps).
    s = tap(s, varied, 30_000);
    expect(s.currentSeries[0]).toEqual({
      reps: 12,
      weightKg: 100,
      workSeconds: 30,
      volumeKg: 1200,
    });
    // Rest → ready → work, then set 2 (10 reps) at a heavier weight.
    s = tap(
      { ...s, phase: "work", anchorTs: 30_000, enteredWeightKg: 105 },
      varied,
      55_000,
    );
    expect(s.currentSeries[1]).toEqual({
      reps: 10,
      weightKg: 105,
      workSeconds: 25,
      volumeKg: 1050,
    });
    // Set 3 (8 reps) completes the exercise.
    const done = tap(
      { ...s, phase: "work", anchorTs: 55_000, enteredWeightKg: 110 },
      varied,
      75_000,
    );
    expect(done.phase).toBe("exercise-complete");
    expect(done.exerciseLogs[0]?.series).toEqual([
      { reps: 12, weightKg: 100, workSeconds: 30, volumeKg: 1200 },
      { reps: 10, weightKg: 105, workSeconds: 25, volumeKg: 1050 },
      { reps: 8, weightKg: 110, workSeconds: 20, volumeKg: 880 },
    ]);
  });

  it("rest/overtime → ready (armed) for the next series, banking rest", () => {
    const s = session({
      phase: "rest",
      anchorTs: 45_000,
      currentSeries: [seriesLog()],
    });
    const next = tap(s, TWO_EX_DAY, 45_000 + 200_000); // 200s of rest (past the 120s → overtime)

    // §D12: the next set is ARMED (tap-to-start), not auto-running.
    expect(next.phase).toBe("ready");
    expect(next.accumRestSeconds).toBe(200);
    expect(next.currentSeries).toHaveLength(1);
  });

  it("ready → work only when a weight is entered (§D12)", () => {
    const armed = session({
      phase: "ready",
      currentSeries: [seriesLog()],
      anchorTs: 0,
    });

    // No weight → no-op.
    expect(tap({ ...armed, enteredWeightKg: null }, TWO_EX_DAY, 5_000)).toEqual(
      {
        ...armed,
        enteredWeightKg: null,
      },
    );

    // Weight set → starts the work clock.
    const started = tap({ ...armed, enteredWeightKg: 60 }, TWO_EX_DAY, 5_000);
    expect(started.phase).toBe("work");
    expect(started.anchorTs).toBe(5_000);
  });

  it("last series of a NON-final exercise → exercise-complete, rolling series into an ExerciseLog with aggregate rest", () => {
    const s = session({
      phase: "work",
      anchorTs: 0,
      // First series already banked; this tap ends the second (final) series.
      currentSeries: [seriesLog({ workSeconds: 45 })],
      accumRestSeconds: 90,
      enteredWeightKg: 60,
    });
    const next = tap(s, TWO_EX_DAY, 40_000);

    expect(next.phase).toBe("exercise-complete");
    expect(next.exerciseLogs).toHaveLength(1);
    expect(next.exerciseLogs[0]).toEqual<ExerciseLog>({
      exerciseId: "e1",
      name: "Bench",
      series: [
        { reps: 8, weightKg: 60, workSeconds: 45, volumeKg: 480 },
        { reps: 8, weightKg: 60, workSeconds: 40, volumeKg: 480 },
      ],
      restSeconds: 90, // aggregate; no trailing rest after the final set
    });
  });

  it("records weight 0 (and volume 0) when none was entered", () => {
    const s = session({
      phase: "work",
      currentSeries: [],
      enteredWeightKg: null,
    });
    // Squat (index 1) is a single-series exercise → completes on the first tap.
    const onSquat = { ...s, currentExerciseIndex: 1, anchorTs: 0 };
    const next = tap(onSquat, TWO_EX_DAY, 30_000);
    expect(next.phase).toBe("exercise-complete");
    expect(next.exerciseLogs[0]?.series[0]).toEqual({
      reps: 5,
      weightKg: 0,
      workSeconds: 30,
      volumeKg: 0,
    });
  });

  it("is inert on an exercise-complete tap", () => {
    const s = session({ phase: "exercise-complete" });
    expect(tap(s, TWO_EX_DAY, 10_000)).toEqual(s);
  });
});

describe("per-exercise derivations + toSeriesView (§D1 revised)", () => {
  const log: ExerciseLog = {
    exerciseId: "e1",
    name: "Bench",
    series: [
      { reps: 12, weightKg: 100, workSeconds: 30, volumeKg: 1200 },
      { reps: 10, weightKg: 105, workSeconds: 25, volumeKg: 1050 },
      { reps: 8, weightKg: 110, workSeconds: 20, volumeKg: 880 },
    ],
    restSeconds: 180,
  };

  it("sums volume, work, and counts sets", () => {
    expect(exerciseVolumeKg(log)).toBe(3130); // 1200 + 1050 + 880
    expect(exerciseWorkSeconds(log)).toBe(75); // 30 + 25 + 20
    expect(seriesCount(log)).toBe(3);
  });

  it("maps a SeriesLog to display units (metric = identity, volume = weight × reps)", () => {
    expect(
      toSeriesView(seriesLog({ weightKg: 80, reps: 8 }), "metric"),
    ).toEqual({ reps: 8, weight: 80, workSeconds: 45, volume: 640 });
  });

  it("converts to imperial at the seam", () => {
    // 100 kg → 220.5 lb (0.5 step); volume = 220.5 × 8.
    const view = toSeriesView(
      { reps: 8, weightKg: 100, workSeconds: 30, volumeKg: 800 },
      "imperial",
    );
    expect(view.weight).toBe(220.5);
    expect(view.volume).toBe(220.5 * 8);
  });
});

describe("advanceExercise (§D3)", () => {
  it("moves to the next exercise's first series (armed), resetting in-flight state", () => {
    const s = session({
      currentExerciseIndex: 0,
      currentSeries: [seriesLog(), seriesLog()],
      accumRestSeconds: 90,
      enteredWeightKg: 60,
      phase: "exercise-complete",
    });
    const next = advanceExercise(s, 500_000);
    expect(next).toMatchObject({
      currentExerciseIndex: 1,
      currentSeries: [],
      accumRestSeconds: 0,
      enteredWeightKg: null,
      phase: "ready",
      anchorTs: 500_000,
    });
  });
});

describe("deriveTimer (§D3)", () => {
  it("counts work up from the anchor", () => {
    const s = session({ phase: "work", anchorTs: 10_000 });
    const t = deriveTimer(s, TWO_EX_DAY, 10_000 + 37_400);
    expect(t.phase).toBe("work");
    expect(t.displaySeconds).toBe(37);
    expect(t.currentSeries).toBe(1);
    expect(t.plannedSeries).toBe(2);
  });

  it("counts rest down toward zero", () => {
    const s = session({
      phase: "rest",
      anchorTs: 0,
      currentSeries: [seriesLog()],
      defaultRestSeconds: 120,
    });
    const t = deriveTimer(s, TWO_EX_DAY, 30_000);
    expect(t.phase).toBe("rest");
    expect(t.displaySeconds).toBe(90); // 120 − 30
    expect(t.restTotalSeconds).toBe(120);
    expect(t.overtimeSeconds).toBe(0);
    expect(t.currentSeries).toBe(2);
  });

  it("derives overtime once rest passes zero", () => {
    const s = session({ phase: "rest", anchorTs: 0, defaultRestSeconds: 120 });
    const t = deriveTimer(s, TWO_EX_DAY, 155_000); // 35s past the 120s rest
    expect(t.phase).toBe("overtime");
    expect(t.displaySeconds).toBe(0);
    expect(t.overtimeSeconds).toBe(35);
  });

  it("reports a static complete state", () => {
    const s = session({
      phase: "exercise-complete",
      currentSeries: [seriesLog(), seriesLog()],
    });
    const t = deriveTimer(s, TWO_EX_DAY, 999_000);
    expect(t.phase).toBe("exercise-complete");
    expect(t.displaySeconds).toBe(0);
    expect(t.currentSeries).toBe(2);
  });
});
