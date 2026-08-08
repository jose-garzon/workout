/**
 * The day-cycle's session read (design.md §D1) — a second Dexie caller for this
 * feature, alongside `routineRepo`, on the `calendarRepo` precedent: it needs
 * only the scalar coordinates `dayId` + `completedAt`, so it reads them itself
 * rather than importing `workout-mode` (which would close a dependency cycle —
 * `workout-mode` already imports this feature). Imports `@/shared/db` only.
 */

import { db } from "@/shared/db";

/**
 * dayIds of completed sessions with `completedAt >= sinceMs`, oldest → newest
 * (the `completedAt` index order). No upper bound: sessions are never in the
 * future, and an unbounded upper end is what keeps the live query re-emitting
 * after a completion.
 *
 * DELIBERATELY NOT filtered by `routineId` (design.md §D2): `routineRepo` writes
 * every routine to the singleton id "active", so every row's `routineId` is the
 * constant "active" and cannot discriminate one routine's sessions from
 * another's. `completedAt >= routine.createdAt` is the only discriminator there
 * is — do not "fix" this into a `routineId` filter.
 */
export async function getCompletedDayIdsSince(
  sinceMs: number,
): Promise<string[]> {
  const rows = await db.completedSessions
    .where("completedAt")
    .aboveOrEqual(sinceMs)
    .toArray();
  return rows.map((r) => r.dayId);
}
