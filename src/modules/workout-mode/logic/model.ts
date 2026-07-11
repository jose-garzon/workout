/**
 * workout-mode pure model (design.md §D1/§D3/§D7/§D11). No Dexie, no React —
 * just functions over the session state + the day's plan, so every transition
 * and every derived timer value is deterministic and unit-testable with an
 * injected `now`. Cross-feature types come from barrels (legal from `logic/`).
 */

import type { MeasurementUnit } from "@/modules/profile-goals";
import type { RoutineDay } from "@/modules/routine-generation";
import type {
  CurrentExerciseView,
  ExerciseLog,
  OverviewExercise,
  SeriesLog,
  SeriesView,
  TimerView,
  WorkoutSession,
} from "../types";

/** 1 kg = 2.2046226 lb (design.md §D11). */
const LB_PER_KG = 2.2046226;
/** Fallback rest when the plan prescribes none (design.md §D7). */
const FALLBACK_REST_SECONDS = 90;

/* ------------------------------------------------------------------ *
 * Default rest (§D7): the mode of every set's restSeconds across the
 * day. Ties resolve to the SMALLER value; empty plan → the fallback.
 * ------------------------------------------------------------------ */

export function defaultRestFor(day: RoutineDay): number {
  const counts = new Map<number, number>();
  for (const exercise of day.exercises) {
    for (const set of exercise.sets) {
      counts.set(set.restSeconds, (counts.get(set.restSeconds) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return FALLBACK_REST_SECONDS;

  let bestValue = FALLBACK_REST_SECONDS;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < bestValue)) {
      bestValue = value;
      bestCount = count;
    }
  }
  return bestValue;
}

/* ------------------------------------------------------------------ *
 * Plan → seam view-models (§D1). `plannedReps` is the representative
 * `sets[0].reps`; `repsPerSet` is the full plan for a range display.
 * ------------------------------------------------------------------ */

export function toOverviewExercises(day: RoutineDay): OverviewExercise[] {
  return day.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    plannedSeries: exercise.sets.length,
    plannedReps: exercise.sets[0]?.reps ?? 0,
  }));
}

export function toCurrentExerciseView(
  day: RoutineDay,
  index: number,
): CurrentExerciseView | null {
  const exercise = day.exercises[index];
  if (!exercise) return null;
  return {
    id: exercise.id,
    name: exercise.name,
    index,
    total: day.exercises.length,
    plannedSeries: exercise.sets.length,
    plannedReps: exercise.sets[0]?.reps ?? 0,
    repsPerSet: exercise.sets.map((set) => set.reps),
    isLast: index === day.exercises.length - 1,
  };
}

/* ------------------------------------------------------------------ *
 * Weight conversion (§D11): the record is canonical kg; the seam
 * exposes the user's display unit, rounded to a 0.5 step.
 * ------------------------------------------------------------------ */

export function unitLabel(unit: MeasurementUnit): string {
  return unit === "imperial" ? "lb" : "kg";
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** kg → the user's display unit, rounded to a 0.5 step. */
export function kgToDisplay(kg: number, unit: MeasurementUnit): number {
  const value = unit === "imperial" ? kg * LB_PER_KG : kg;
  return roundToHalf(value);
}

/** A value the user typed in their display unit → canonical kg. */
export function displayToKg(value: number, unit: MeasurementUnit): number {
  return unit === "imperial" ? value / LB_PER_KG : value;
}

/** A stored `SeriesLog` (canonical kg) → the display-unit seam view-model (§D11). */
export function toSeriesView(
  series: SeriesLog,
  unit: MeasurementUnit,
): SeriesView {
  const weight = kgToDisplay(series.weightKg, unit);
  return {
    reps: series.reps,
    weight,
    workSeconds: series.workSeconds,
    // Display-unit volume is `weight × reps` so the UI shows exactly the product
    // of the two numbers it renders (no separate rounding of the kg·reps figure).
    volume: weight * series.reps,
  };
}

/* ------------------------------------------------------------------ *
 * Per-exercise total derivations (§D1 revised): no denormalized total
 * is stored, so readers sum the `series[]` here.
 * ------------------------------------------------------------------ */

/** Σ of every set's volume (kg·reps). */
export function exerciseVolumeKg(log: ExerciseLog): number {
  return log.series.reduce((sum, s) => sum + s.volumeKg, 0);
}

/** Σ of every set's work time (seconds). */
export function exerciseWorkSeconds(log: ExerciseLog): number {
  return log.series.reduce((sum, s) => sum + s.workSeconds, 0);
}

/** Completed-set count. */
export function seriesCount(log: ExerciseLog): number {
  return log.series.length;
}

/* ------------------------------------------------------------------ *
 * Session lifecycle (§D3).
 * ------------------------------------------------------------------ */

/** A fresh session at the first exercise's first series, armed but not running (§D12). */
export function initialSession(params: {
  routineId: string;
  dayId: string;
  defaultRestSeconds: number;
  now: number;
}): WorkoutSession {
  return {
    id: `${params.routineId}:${params.dayId}`,
    routineId: params.routineId,
    dayId: params.dayId,
    startedAt: params.now,
    defaultRestSeconds: params.defaultRestSeconds,
    exerciseLogs: [],
    currentExerciseIndex: 0,
    enteredWeightKg: null,
    currentSeries: [],
    accumRestSeconds: 0,
    phase: "ready",
    anchorTs: params.now,
  };
}

function elapsedSeconds(anchorTs: number, now: number): number {
  return Math.max(0, Math.floor((now - anchorTs) / 1000));
}

/**
 * The single stopwatch reducer (§D3 table). Pure: takes the session, the day's
 * plan (for planned series + the completing exercise's log fields), and `now`;
 * returns the next session. On a `work` tap that finishes the last series it
 * appends the `ExerciseLog` and moves to `exercise-complete` (the seam decides
 * finish-vs-advance from `isLast`). `exercise-complete` taps are inert.
 */
export function tap(
  session: WorkoutSession,
  day: RoutineDay,
  now: number,
): WorkoutSession {
  const exercise = day.exercises[session.currentExerciseIndex];
  const plannedSeries = exercise?.sets.length ?? 0;
  const banked = elapsedSeconds(session.anchorTs, now);

  if (session.phase === "ready") {
    // Tap-to-start (§D12): arm → work, but ONLY with a weight entered for the
    // set (the seam also gates this; the reducer stays safe as a no-op).
    if (session.enteredWeightKg === null) return session;
    return { ...session, phase: "work", anchorTs: now };
  }

  if (session.phase === "work") {
    // The set that just finished is at index `currentSeries.length` (§D3 table):
    // bank its own weight + the plan's reps for that index into a `SeriesLog`.
    const i = session.currentSeries.length;
    const reps = exercise?.sets[i]?.reps ?? 0;
    const weightKg = session.enteredWeightKg ?? 0;
    const setLog: SeriesLog = {
      reps,
      weightKg,
      workSeconds: banked,
      volumeKg: weightKg * reps,
    };
    const currentSeries = [...session.currentSeries, setLog];

    if (currentSeries.length < plannedSeries) {
      return {
        ...session,
        currentSeries,
        phase: "rest",
        anchorTs: now,
      };
    }

    // Last series → the exercise is done; roll the series into an `ExerciseLog`
    // with aggregate rest. There is no trailing rest after the final set (§D1/§D3).
    const log: ExerciseLog = {
      exerciseId: exercise?.id ?? "",
      name: exercise?.name ?? "",
      series: currentSeries,
      restSeconds: session.accumRestSeconds,
    };
    return {
      ...session,
      currentSeries,
      exerciseLogs: [...session.exerciseLogs, log],
      phase: "exercise-complete",
    };
  }

  if (session.phase === "rest") {
    // rest OR the derived overtime — both are the same stored `rest` row. The
    // next set is ARMED, not auto-running (§D12); its weight carries over from
    // this set (kept on the session) and stays editable.
    return {
      ...session,
      accumRestSeconds: session.accumRestSeconds + banked,
      phase: "ready",
      anchorTs: now,
    };
  }

  // exercise-complete: tap is inert; advance is `advanceExercise` (§D3).
  return session;
}

/** Advance to the next exercise's first series, armed but not running, weight cleared. */
export function advanceExercise(
  session: WorkoutSession,
  now: number,
): WorkoutSession {
  return {
    ...session,
    currentExerciseIndex: session.currentExerciseIndex + 1,
    enteredWeightKg: null,
    currentSeries: [],
    accumRestSeconds: 0,
    phase: "ready",
    anchorTs: now,
  };
}

/**
 * Derive the whole stopwatch view from `anchorTs + now` (§D3) — never a counter.
 * work counts up; rest counts down; a rest past zero is the derived `overtime`.
 */
export function deriveTimer(
  session: WorkoutSession,
  day: RoutineDay,
  now: number,
): TimerView {
  const exercise = day.exercises[session.currentExerciseIndex];
  const plannedSeries = exercise?.sets.length ?? 0;
  const restTotalSeconds = session.defaultRestSeconds;

  if (session.phase === "exercise-complete") {
    return {
      phase: "exercise-complete",
      displaySeconds: 0,
      restTotalSeconds,
      overtimeSeconds: 0,
      currentSeries: session.currentSeries.length,
      plannedSeries,
    };
  }

  const currentSeries = session.currentSeries.length + 1;

  if (session.phase === "ready") {
    // Armed, clock not running (§D12) — the digits sit at 0 until the start tap.
    return {
      phase: "ready",
      displaySeconds: 0,
      restTotalSeconds,
      overtimeSeconds: 0,
      currentSeries,
      plannedSeries,
    };
  }

  const elapsed = elapsedSeconds(session.anchorTs, now);

  if (session.phase === "work") {
    return {
      phase: "work",
      displaySeconds: elapsed,
      restTotalSeconds,
      overtimeSeconds: 0,
      currentSeries,
      plannedSeries,
    };
  }

  // rest → maybe overtime
  const remaining = session.defaultRestSeconds - elapsed;
  if (remaining > 0) {
    return {
      phase: "rest",
      displaySeconds: remaining,
      restTotalSeconds,
      overtimeSeconds: 0,
      currentSeries,
      plannedSeries,
    };
  }
  return {
    phase: "overtime",
    displaySeconds: 0,
    restTotalSeconds,
    overtimeSeconds: -remaining,
    currentSeries,
    plannedSeries,
  };
}
