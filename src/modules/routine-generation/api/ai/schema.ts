import { z } from "zod";

/**
 * Zod schema for the AI's routine payload — ISOMORPHIC and server-safe (pure,
 * no Dexie). Imported by both the proxy route (server, to build the strict
 * `response_format` JSON schema) and the client hook (browser, to validate the
 * assembled payload before it becomes a domain `Routine`). Never trust the
 * model's shape — always validate at the boundary (design.md §2).
 *
 * This describes the GENERATED shape only: ids/createdAt/active are added
 * client-side when assembling into the domain `Routine` (see `../../types`).
 */

export const setPlanSchema = z.object({
  reps: z.number().int().positive(),
  restSeconds: z.number().int().nonnegative(),
  targetWeightKg: z.number().positive().optional(),
});

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.array(setPlanSchema).min(1),
});

export const routineDaySchema = z.object({
  name: z.string().min(1),
  exercises: z.array(exerciseSchema).min(1),
});

export const routineSchema = z.object({
  name: z.string().min(1),
  /** Short motivational line for the split (design.md §7). */
  subtitle: z.string().min(1).optional(),
  days: z.array(routineDaySchema).min(1),
});

/** The validated AI payload (pre-domain — no ids yet). */
export type RoutinePayload = z.infer<typeof routineSchema>;

/**
 * JSON Schema form of {@link routineSchema}, precomputed for the proxy route's
 * strict `response_format`. Exposing it here keeps `zod` out of the route's
 * import list.
 */
export const routineJsonSchema = z.toJSONSchema(routineSchema);
