"use client";

import type { Exercise, SetPlan } from "@/modules/routine-generation";

/**
 * The workout-session seam — resumes at the exact set after interruption.
 * Signature per design.md §4. `Exercise`/`SetPlan` come from routine-generation's
 * public barrel (cross-feature, downstream import — direction D ← B).
 *
 * Foundation stub — signature only; the resume-at-set + set-logging engine lands
 * in the workout-mode feature change (D).
 */

export type WorkoutStatus = "idle" | "active" | "resting" | "complete";

export interface WorkoutSessionApi {
  status: WorkoutStatus;
  currentExercise: Exercise;
  currentSet: SetPlan;
  logSet: (actual: { weight: number; reps: number }) => Promise<void>;
  startRest: () => void;
}

export function useWorkoutSession(routineId: string): WorkoutSessionApi {
  void routineId;
  throw new Error(
    "useWorkoutSession is implemented in the workout-mode feature change (D).",
  );
}
