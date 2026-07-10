/**
 * workout-mode (Feature D) — PUBLIC BARREL. Seam hooks + public domain types.
 * `CompletedSession` is read cross-feature by calendar via this barrel.
 * Internals (incl. the Zustand hot-state store) are private.
 */

export type { RestTimer } from "./logic/useRestTimer";
export { useRestTimer } from "./logic/useRestTimer";
export type {
  WorkoutSessionApi,
  WorkoutStatus,
} from "./logic/useWorkoutSession";
export { useWorkoutSession } from "./logic/useWorkoutSession";
export type {
  CompletedSession,
  SetLog,
  WorkoutSession,
} from "./types";
