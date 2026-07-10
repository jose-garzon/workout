/**
 * profile-goals persistence (design.md §2.2, §5 rule 2). The only Dexie caller
 * for this feature: maps between the `shared/db` rows and the domain types, and
 * writes `Profile` + `Goals` in ONE read-write transaction so onboarding is
 * all-or-nothing. Imports only `@/shared/db` + `../types` — never logic/ or ui/.
 */

import { db, type GoalsRow, type ProfileRow } from "@/shared/db";
import type { Goals, Profile, TrainingFocus } from "../types";

/** Both stores are singletons keyed by this id. */
const SINGLETON_ID = "me";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.displayName,
    bodyweightKg: row.bodyweightKg,
    heightCm: row.heightCm,
    unit: row.unit,
  };
}

function toGoals(row: GoalsRow): Goals {
  return {
    id: row.id,
    focus: row.focus as TrainingFocus,
    daysPerWeek: row.daysPerWeek,
    notes: row.notes,
  };
}

function toProfileRow(profile: Profile): ProfileRow {
  const row: ProfileRow = { id: SINGLETON_ID, unit: profile.unit };
  if (profile.displayName !== undefined) row.displayName = profile.displayName;
  if (profile.bodyweightKg !== undefined)
    row.bodyweightKg = profile.bodyweightKg;
  if (profile.heightCm !== undefined) row.heightCm = profile.heightCm;
  return row;
}

function toGoalsRow(goals: Goals): GoalsRow {
  const row: GoalsRow = {
    id: SINGLETON_ID,
    focus: goals.focus,
    daysPerWeek: goals.daysPerWeek,
  };
  if (goals.notes !== undefined) row.notes = goals.notes;
  return row;
}

/** The saved profile singleton, or null if onboarding has not completed. */
export async function getProfile(): Promise<Profile | null> {
  const row = await db.profile.get(SINGLETON_ID);
  return row ? toProfile(row) : null;
}

/** The saved goals singleton, or null if onboarding has not completed. */
export async function getGoals(): Promise<Goals | null> {
  const row = await db.goals.get(SINGLETON_ID);
  return row ? toGoals(row) : null;
}

/**
 * Persist profile + goals atomically. Both `put`s run in a single rw
 * transaction, so a failure on either rolls back both — row-presence of
 * `profile` reliably implies a complete onboarding (design.md §2.2).
 */
export async function saveOnboarding(
  profile: Profile,
  goals: Goals,
): Promise<void> {
  await db.transaction("rw", db.profile, db.goals, async () => {
    await db.profile.put(toProfileRow(profile));
    await db.goals.put(toGoalsRow(goals));
  });
}
