/**
 * routine-generation (Feature B) — PUBLIC BARREL. Seam hooks + public domain
 * types + the AI error contract (part of the generation hook's signature).
 * Internals are private.
 */

export type { AiError } from "./api/ai/errors";
export type { ActiveRoutineApi } from "./logic/useActiveRoutine";
export { useActiveRoutine } from "./logic/useActiveRoutine";
export type {
  GenStatus,
  RoutineGeneration,
} from "./logic/useRoutineGeneration";
export { useRoutineGeneration } from "./logic/useRoutineGeneration";
export type {
  Exercise,
  Routine,
  RoutineDay,
  SetPlan,
} from "./types";
