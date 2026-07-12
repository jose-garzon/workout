/**
 * calendar persistence (design.md §2). The only Dexie caller for this feature:
 * a range read over the indexed `completedAt`, projecting each row to the two
 * scalar fields the views need. Imports only `@/shared/db` — never logic/ or ui/.
 */

import { db } from "@/shared/db";
import type { CompletedRef } from "../types";

/**
 * Completed sessions with `completedAt` in `[lowerMs, upperMs]` (both inclusive),
 * projected to `{ completedAt, dayId }`. `exerciseLogs` are not read.
 */
export async function getCompletedInRange(
  lowerMs: number,
  upperMs: number,
): Promise<CompletedRef[]> {
  const rows = await db.completedSessions
    .where("completedAt")
    .between(lowerMs, upperMs, true, true)
    .toArray();
  return rows.map((r) => ({ completedAt: r.completedAt, dayId: r.dayId }));
}
