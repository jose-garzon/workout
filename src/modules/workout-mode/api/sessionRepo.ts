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
  ExerciseHistory,
  ExerciseLog,
  HistorySet,
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
    enteredReps: row.enteredReps,
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
    enteredReps: session.enteredReps,
    currentSeries: session.currentSeries,
    accumRestSeconds: session.accumRestSeconds,
    phase: session.phase,
    anchorTs: session.anchorTs,
  };
}

function toCompletedSession(row: CompletedSessionRow): CompletedSession {
  const session: CompletedSession = {
    id: row.id,
    routineId: row.routineId,
    dayId: row.dayId,
    completedAt: row.completedAt,
    exerciseLogs: row.exerciseLogs as ExerciseLog[],
  };
  if (row.difficulty !== undefined) session.difficulty = row.difficulty;
  if (row.fatigue !== undefined) session.fatigue = row.fatigue;
  return session;
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
 * Completed sessions for `routineId`, most-recent first, capped at `limit`
 * (routine-edit-history design.md §Decision 1). Orders by the `completedAt`
 * index (newest first, like `getExerciseHistory`), filters by `routineId`, and
 * stops at `limit` — the recent window fed to the edit-history summarizer.
 */
export async function getCompletedForRoutine(
  routineId: string,
  limit: number,
): Promise<CompletedSession[]> {
  const rows = await db.completedSessions
    .orderBy("completedAt")
    .reverse()
    .filter((row) => row.routineId === routineId)
    .limit(limit)
    .toArray();
  return rows.map(toCompletedSession);
}

/**
 * Everything history has to say about `exerciseId`, from ONE newest-first scan
 * of `completedSessions` (prefill-sets design D1). `null` when the exercise has
 * never been logged.
 *
 * The two answers are deliberately asymmetric about zero weight, and both rules
 * are two lines of the same loop so neither can be silently repurposed for the
 * other: `lastSet` takes the tail set of the most recent matching log whatever
 * its weight (the PREFILL seed — "what you finished on"), while `lastWeighted`
 * skips the `weightKg <= 0` unset/bodyweight sentinel and keeps scanning into
 * OLDER sessions when a matching log has none (the CAPTION reference).
 */
export async function getExerciseHistory(
  exerciseId: string,
): Promise<ExerciseHistory | null> {
  const rows = await db.completedSessions
    .orderBy("completedAt")
    .reverse()
    .toArray();

  let lastSet: HistorySet | null = null;
  for (const row of rows) {
    for (const log of row.exerciseLogs as ExerciseLog[]) {
      if (log.exerciseId !== exerciseId) continue;
      const tail = log.series.at(-1);
      if (!tail) continue; // logged the exercise but recorded no set
      if (!lastSet) lastSet = toHistorySet(tail);
      for (let i = log.series.length - 1; i >= 0; i--) {
        const set = log.series[i];
        if (set.weightKg > 0) {
          return { lastSet, lastWeighted: toHistorySet(set) };
        }
      }
      // Matched the exercise but no positive-weight set — keep scanning older.
    }
  }
  return lastSet ? { lastSet, lastWeighted: null } : null;
}

function toHistorySet(set: SeriesLog): HistorySet {
  return { reps: set.reps, weightKg: set.weightKg };
}
