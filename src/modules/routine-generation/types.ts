/**
 * routine-generation (Feature B) — owned domain types. Leaf module: imports
 * nothing. These are the app's execution model; the AI response schema
 * (`api/ai/schema.ts`) is a separate, isomorphic shape assembled into these.
 */

/** A single planned set within an exercise. */
export interface SetPlan {
  reps: number;
  /** Prescribed rest after this set, in seconds — feeds the rest timer. */
  restSeconds: number;
  targetWeightKg?: number;
}

/** One exercise and its planned sets. */
export interface Exercise {
  id: string;
  name: string;
  sets: SetPlan[];
}

/** One day of the split (e.g. "Push"). */
export interface RoutineDay {
  id: string;
  name: string;
  exercises: Exercise[];
}

/**
 * The active routine. Only ONE may be active at a time (invariant enforced in
 * `logic/model`). `days.length` derives the weekly session target.
 */
export interface Routine {
  id: string;
  name: string;
  /** Short AI-authored motivational line for this split — shown in the home
   * identity header. Optional: a model may omit it and generation still succeeds. */
  subtitle?: string;
  createdAt: number;
  active: boolean;
  days: RoutineDay[];
}
