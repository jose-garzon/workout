/**
 * workout-mode (Feature D) — owned domain types. Leaf module: imports nothing.
 * (Cross-feature types like `Exercise`/`SetPlan` are pulled from
 * routine-generation's barrel in `logic/`, never here.)
 */

/** The actual result of one performed set — weight, reps, and rest taken. */
export interface SetLog {
  exerciseId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  /** Actual rest taken after the set, in seconds. */
  restSeconds: number;
  completedAt: number;
}

/**
 * An in-progress session. The `current*Index` cursor is persisted per set so a
 * reload resumes at the exact set after interruption (design.md §4).
 */
export interface WorkoutSession {
  id: string;
  routineId: string;
  dayId: string;
  startedAt: number;
  currentExerciseIndex: number;
  currentSetIndex: number;
  logs: SetLog[];
}

/**
 * A finished session. `completedAt` is what the calendar aggregates (it tracks
 * COMPLETED sessions only — no planned/missed dates). Read cross-feature by
 * `calendar` via this module's barrel.
 */
export interface CompletedSession {
  id: string;
  routineId: string;
  completedAt: number;
  logs: SetLog[];
}
