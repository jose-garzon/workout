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
 * `reps` is the ACTUAL reps the user entered for this set (progressive-overload
 * tracking) — a set cannot start until they are entered.
 */
export interface SeriesLog {
  /** Actual reps performed, as confirmed by the user before the set started. */
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
  /** Reps entered for the CURRENT set. Seeded on set 1 from the last session's final set (or the plan), then CARRIED to each following set — only `advanceExercise` clears it, so the next exercise re-seeds. */
  enteredReps: number | null;
  /** Sets already completed within THIS exercise, in order (§D1 revised). */
  currentSeries: SeriesLog[];
  /** Rest banked from completed rests this exercise, seconds. */
  accumRestSeconds: number;
  phase: SessionPhase;
  /** `Date.now()` at the current phase's start — all displayed time derives from this (§D3/§D4). */
  anchorTs: number;
}

/**
 * One logged set reduced to the two numbers history needs (prefill-sets design D1).
 */
export interface HistorySet {
  reps: number;
  /** Canonical kg. 0 is the unset/bodyweight sentinel. */
  weightKg: number;
}

/**
 * What one scan of `completedSessions` answers for an exercise (prefill-sets
 * design D1). The two fields deliberately DISAGREE when the last session ended
 * on a weight-0 set — the caption is a reference, the prefill is a seed.
 */
export interface ExerciseHistory {
  /** Last set of the MOST RECENT completed session that logged this exercise.
   *  `weightKg` may be 0. This is the PREFILL seed. */
  lastSet: HistorySet;
  /** Last set with `weightKg > 0`, scanning sessions newest-first and
   *  continuing into OLDER sessions when a matching log has none.
   *  `null` when no session ever logged a positive weight for it.
   *  This is the CAPTION reference. */
  lastWeighted: HistorySet | null;
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

/** A per-set entry field that gates starting the set. Order is focus order. */
export type SetField = "reps" | "weight";

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
  /** The reps actually performed in this set. */
  reps: number;
  /** DISPLAY unit (kg→lb converted at the seam, §D11); 0 if unset. */
  weight: number;
  /** That set's elapsed work time, seconds. */
  workSeconds: number;
  /** Display-unit volume = `weight × reps`. */
  volume: number;
}

/**
 * The "Last time" reference in DISPLAY units (prefill-sets design D4). The UI
 * does no unit math and no zero-checking: `weight == null` is its only test.
 */
export interface PreviousSetView {
  reps: number;
  /** DISPLAY unit. `null` when the referenced set carried no weight
   *  (bodyweight) — render the reps-only caption. */
  weight: number | null;
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
