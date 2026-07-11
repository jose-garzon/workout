/**
 * workout-mode (Feature D) — owned domain types. Leaf module: imports nothing.
 * (Cross-feature types like `Exercise`/`SetPlan` are pulled from
 * routine-generation's barrel in `logic/`, never here.)
 *
 * Per-SERIES (per-set) model (design.md §D1, revised 2026-07-11): a session
 * records a `SeriesLog` per completed set, collected into an `ExerciseLog` per
 * exercise. Rest stays an exercise-level aggregate. Weights are stored
 * canonically in kg; the seam converts to the user's unit (§D11).
 */

/**
 * One completed set — captured on the work→rest (or work→complete) tap (§D3).
 * `reps`/`volumeKg` are PLANNED figures (the plan's reps for this set index),
 * never counted output.
 */
export interface SeriesLog {
  /** The plan's reps for this set index (`sets[i].reps`) — not counted. */
  reps: number;
  /** The weight used for THIS set, canonical kg (0 if unset). */
  weightKg: number;
  /** Elapsed work time of this set (from `anchorTs` → tap), seconds. */
  workSeconds: number;
  /** = `weightKg × reps` (kg·reps) — the headline per-set number. */
  volumeKg: number;
}

/**
 * The record for one worked exercise (design.md §D1, revised): one `SeriesLog`
 * per completed set plus the exercise's aggregate rest. No denormalized totals —
 * readers derive them from `series` via pure helpers in `logic/model.ts`.
 */
export interface ExerciseLog {
  /** The routine's exercise id — the previous-weight history key (§D6). */
  exerciseId: string;
  /** Denormalized so history/calendar need no routine join. */
  name: string;
  /** One entry per completed set, in order — the record. */
  series: SeriesLog[];
  /** TOTAL rest across the exercise's inter-set rests (aggregate), seconds. */
  restSeconds: number;
}

/**
 * Stored phase of the stopwatch. `ready` = a set is armed but the clock is not
 * running (tap-to-start, §D12). `overtime` is DERIVED at the seam, never stored (§D3).
 */
export type SessionPhase = "ready" | "work" | "rest" | "exercise-complete";

/**
 * An in-progress session — at most one resumable per (routine, day), keyed
 * `${routineId}:${dayId}` (§D5). Carries the in-flight state of the CURRENT
 * exercise so a reload resumes exactly (§D4).
 */
export interface WorkoutSession {
  id: string;
  routineId: string;
  dayId: string;
  startedAt: number;
  defaultRestSeconds: number;
  /** Exercises already completed, in order. */
  exerciseLogs: ExerciseLog[];
  currentExerciseIndex: number;
  enteredWeightKg: number | null;
  /** Sets already completed within THIS exercise, in order (§D1 revised). */
  currentSeries: SeriesLog[];
  /** Rest banked from completed rests this exercise, seconds. */
  accumRestSeconds: number;
  phase: SessionPhase;
  /** `Date.now()` at the current phase's start — all displayed time derives from this (§D3/§D4). */
  anchorTs: number;
}

/**
 * A finished session — what the calendar (Feature C) aggregates via the barrel.
 * `completedAt` is indexed for calendar range queries.
 */
export interface CompletedSession {
  id: string;
  routineId: string;
  dayId: string;
  completedAt: number;
  exerciseLogs: ExerciseLog[];
  /** 1–5, optional (session-completion spec). */
  difficulty?: number;
  /** 1–5, optional. */
  fatigue?: number;
}

/* --- Seam view-models (design.md "Logic↔UI seam contract"). Defined here in
   the leaf so `logic/model.ts` and `logic/useWorkoutSession.ts` both depend
   downward on them — no logic↔logic cycle. Re-exported through the barrel via
   useWorkoutSession. --- */

/** The one screen's high-level state — the UI picks its view off this alone. */
export type SessionStatus =
  | "loading"
  | "no-routine"
  | "overview"
  | "in-progress"
  | "success";

/**
 * Stopwatch phase as the UI sees it — `ready` (armed, tap-to-start) plus the
 * DERIVED `overtime` (§D3/§D12).
 */
export type TimerPhase =
  | "ready"
  | "work"
  | "rest"
  | "overtime"
  | "exercise-complete";

/** A day's exercise, for the overview list. */
export interface OverviewExercise {
  id: string;
  name: string;
  plannedSeries: number;
  /** Representative reps (`sets[0].reps`). */
  plannedReps: number;
}

/** The current exercise + its plan, for the per-exercise view. */
export interface CurrentExerciseView {
  id: string;
  name: string;
  /** 0-based position in the day. */
  index: number;
  /** Exercises in the day. */
  total: number;
  plannedSeries: number;
  plannedReps: number;
  /** Full plan, for a "8–12" style display; never recorded. */
  repsPerSet: number[];
  isLast: boolean;
}

/**
 * One completed set of the CURRENT exercise, in DISPLAY units (§D11) — for the
 * per-set progress list. The UI does no math: `weight`/`volume` arrive converted.
 */
export interface SeriesView {
  /** The plan's reps for this set index. */
  reps: number;
  /** DISPLAY unit (kg→lb converted at the seam, §D11); 0 if unset. */
  weight: number;
  /** That set's elapsed work time, seconds. */
  workSeconds: number;
  /** Display-unit volume = `weight × reps`. */
  volume: number;
}

/** Everything the stopwatch renders (§D3). */
export interface TimerView {
  phase: TimerPhase;
  /** work: elapsed↑ · rest: remaining↓ · overtime: 0 · complete: 0. */
  displaySeconds: number;
  /** For the ring fill fraction (= the session default rest). */
  restTotalSeconds: number;
  /** >0 only in overtime. */
  overtimeSeconds: number;
  /** 1-based. */
  currentSeries: number;
  plannedSeries: number;
}
