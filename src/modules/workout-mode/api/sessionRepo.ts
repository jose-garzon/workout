/**
 * workout-mode persistence (design.md §D5/§D6). The only Dexie caller for this
 * feature: maps between `shared/db` rows and the domain types. Imports only
 * `@/shared/db` + `../types` — never logic/ or ui/.
 *
 * Two id spaces (§D5): the in-progress session is a SINGLETON per (routine, day)
 * keyed `${routineId}:${dayId}` (at most one resumable session per day, found by
 * a keyed `get`); a completed session is a distinct historical record keyed by a
 * fresh UUID (history accumulates).
 */

import { type CompletedSessionRow, db, type SessionRow } from "@/shared/db";
import type {
  CompletedSession,
  ExerciseLog,
  SeriesLog,
  SessionPhase,
  WorkoutSession,
} from "../types";

function inProgressId(routineId: string, dayId: string): string {
  return `${routineId}:${dayId}`;
}

function toSession(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routineId,
    dayId: row.dayId,
    startedAt: row.startedAt,
    defaultRestSeconds: row.defaultRestSeconds,
    exerciseLogs: row.exerciseLogs as ExerciseLog[],
    currentExerciseIndex: row.currentExerciseIndex,
    enteredWeightKg: row.enteredWeightKg,
    currentSeries: row.currentSeries as SeriesLog[],
    accumRestSeconds: row.accumRestSeconds,
    phase: row.phase as SessionPhase,
    anchorTs: row.anchorTs,
  };
}

function toSessionRow(session: WorkoutSession): SessionRow {
  return {
    id: session.id,
    routineId: session.routineId,
    dayId: session.dayId,
    startedAt: session.startedAt,
    defaultRestSeconds: session.defaultRestSeconds,
    exerciseLogs: session.exerciseLogs,
    currentExerciseIndex: session.currentExerciseIndex,
    enteredWeightKg: session.enteredWeightKg,
    currentSeries: session.currentSeries,
    accumRestSeconds: session.accumRestSeconds,
    phase: session.phase,
    anchorTs: session.anchorTs,
  };
}

function toCompletedRow(session: CompletedSession): CompletedSessionRow {
  const row: CompletedSessionRow = {
    id: session.id,
    routineId: session.routineId,
    dayId: session.dayId,
    completedAt: session.completedAt,
    exerciseLogs: session.exerciseLogs,
  };
  if (session.difficulty !== undefined) row.difficulty = session.difficulty;
  if (session.fatigue !== undefined) row.fatigue = session.fatigue;
  return row;
}

/** The resumable session for this day, or null (§D5). */
export async function getInProgress(
  routineId: string,
  dayId: string,
): Promise<WorkoutSession | null> {
  const row = await db.sessions.get(inProgressId(routineId, dayId));
  return row ? toSession(row) : null;
}

/** Persist the in-progress session (a `put` on every transition, §D4). */
export async function saveInProgress(session: WorkoutSession): Promise<void> {
  await db.sessions.put(toSessionRow(session));
}

/** Delete the resumable row (on finish, §D5). */
export async function clearInProgress(
  routineId: string,
  dayId: string,
): Promise<void> {
  await db.sessions.delete(inProgressId(routineId, dayId));
}

/** Persist a finished session — the durable record written before ratings (§D5). */
export async function saveCompleted(session: CompletedSession): Promise<void> {
  await db.completedSessions.put(toCompletedRow(session));
}

/** Attach the optional difficulty/fatigue ratings to an existing completed session. */
export async function updateRatings(
  id: string,
  ratings: { difficulty?: number; fatigue?: number },
): Promise<void> {
  const patch: Partial<CompletedSessionRow> = {};
  if (ratings.difficulty !== undefined) patch.difficulty = ratings.difficulty;
  if (ratings.fatigue !== undefined) patch.fatigue = ratings.fatigue;
  if (Object.keys(patch).length > 0) {
    await db.completedSessions.update(id, patch);
  }
}

/**
 * The weight (kg) last used for `exerciseId` in a completed session, or null
 * (§D6). Scans completed sessions newest-first; for the first matching
 * `ExerciseLog` it returns the `weightKg` of that log's **last `SeriesLog` with
 * `weightKg > 0`** ("what you finished on") — a `weightKg <= 0` is the
 * unset/bodyweight sentinel and is skipped. If a matching log has no
 * positive-weight set it keeps scanning older sessions; `null` when none exists.
 */
export async function getPreviousWeight(
  exerciseId: string,
): Promise<number | null> {
  const rows = await db.completedSessions
    .orderBy("completedAt")
    .reverse()
    .toArray();
  for (const row of rows) {
    for (const log of row.exerciseLogs as ExerciseLog[]) {
      if (log.exerciseId !== exerciseId) continue;
      for (let i = log.series.length - 1; i >= 0; i--) {
        const set = log.series[i];
        if (set && set.weightKg > 0) return set.weightKg;
      }
      // Matched the exercise but no positive-weight set — keep scanning older.
    }
  }
  return null;
}
