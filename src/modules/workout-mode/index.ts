/**
 * workout-mode (Feature D) — PUBLIC BARREL. The single seam
 * (`useWorkoutSession`) + its view-model types + public domain types.
 * `CompletedSession` is read cross-feature by calendar (C) via this barrel.
 * Internals (Zustand hot store, display tick, repo) are private.
 */

export type {
  CurrentExerciseView,
  OverviewExercise,
  SeriesView,
  SessionStatus,
  TimerPhase,
  TimerView,
  WorkoutSessionApi,
} from "./logic/useWorkoutSession";
export { useWorkoutSession } from "./logic/useWorkoutSession";
export type {
  CompletedSession,
  ExerciseLog,
  SeriesLog,
  SessionPhase,
  WorkoutSession,
} from "./types";
