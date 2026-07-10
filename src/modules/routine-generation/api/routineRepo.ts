/**
 * routine-generation persistence (design.md §D6). The only Dexie caller for this
 * feature: maps between the `shared/db` `RoutineRow` and the domain `Routine`.
 * Imports only `@/shared/db` + `../types` — never logic/ or ui/.
 *
 * The one active routine is a SINGLETON ROW at a fixed id ("active", mirroring
 * the profile's "me"). `saveActive` is a `put` that overwrites, so the
 * "exactly one active routine" invariant is structural — there is nowhere for a
 * second to live — rather than something enforced by query logic.
 */

import { db, type RoutineRow } from "@/shared/db";
import type { Routine, RoutineDay } from "../types";

/** The active routine is the singleton keyed by this id. */
const ACTIVE_ID = "active";

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    createdAt: row.createdAt,
    active: row.active,
    days: row.days as RoutineDay[],
  };
}

function toRow(routine: Routine): RoutineRow {
  const row: RoutineRow = {
    id: ACTIVE_ID,
    name: routine.name,
    createdAt: routine.createdAt,
    active: true,
    days: routine.days,
  };
  if (routine.subtitle !== undefined) row.subtitle = routine.subtitle;
  return row;
}

/** The active routine, or null if none has been generated on this device. */
export async function getActive(): Promise<Routine | null> {
  const row = await db.routines.get(ACTIVE_ID);
  return row ? toRoutine(row) : null;
}

/**
 * Persist `routine` as THE active routine, overwriting any previous one. The
 * singleton id guarantees at most one row survives (design.md §D6).
 */
export async function saveActive(routine: Routine): Promise<void> {
  await db.routines.put(toRow(routine));
}
