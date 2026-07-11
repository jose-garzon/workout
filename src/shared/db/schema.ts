import Dexie, { type EntityTable } from "dexie";

/**
 * The ONE Dexie database for workout-pal — browser-only persistence.
 *
 * This module declares every feature's stores and owns the versioned migration
 * chain (IndexedDB versions/migrations are per-database, and the calendar needs
 * range queries over sessions written by workout-mode, so a single DB is
 * required — design.md §3, "Where the Dexie DB lives").
 *
 * Row types are declared HERE (the persistence layer), not imported from
 * `modules/*`, so `shared/db` stays a dependency leaf: the `modules → shared/db`
 * direction can never form a cycle. Each feature's `api/*Repo` maps between these
 * rows and that feature's domain types (repos are the only Dexie callers). Nested
 * domain structures are stored opaquely (`unknown[]`) and typed by the owning
 * repo; scalar/indexed fields are typed here because the indexes query on them.
 */

/** profile-goals (A) — singleton row, id = "me". */
export interface ProfileRow {
  id: string;
  displayName?: string;
  gender: "male" | "female" | "other";
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: "metric" | "imperial";
}

/** profile-goals (A) — singleton row, id = "me". */
export interface GoalsRow {
  id: string;
  focus: string;
  daysPerWeek: number;
  notes?: string;
}

/** routine-generation (B) — the one active routine (invariant enforced in logic). */
export interface RoutineRow {
  id: string;
  name: string;
  /** AI-authored motivational subtitle (non-indexed) — mapped by routineRepo. */
  subtitle?: string;
  createdAt: number;
  active: boolean;
  /** RoutineDay[] — mapped by routineRepo. */
  days: unknown[];
}

/**
 * workout-mode (D) — an in-progress session; persisted per transition so a
 * reload resumes at the exercise in progress with an exact timer (design.md §D4).
 * Per-series model (§D1, revised 2026-07-11): non-indexed field shapes only —
 * the `version(1).stores` string is unchanged, so no migration (§D2).
 */
export interface SessionRow {
  id: string;
  routineId: string;
  dayId: string;
  startedAt: number;
  defaultRestSeconds: number;
  /** ExerciseLog[] — completed exercises, mapped by sessionRepo. */
  exerciseLogs: unknown[];
  currentExerciseIndex: number;
  enteredWeightKg: number | null;
  /** SeriesLog[] — sets completed within the current exercise, mapped by sessionRepo. */
  currentSeries: unknown[];
  accumRestSeconds: number;
  /** SessionPhase — "ready" | "work" | "rest" | "exercise-complete". */
  phase: string;
  anchorTs: number;
}

/** workout-mode (D) → calendar (C). `completedAt` is indexed for calendar range queries. */
export interface CompletedSessionRow {
  id: string;
  routineId: string;
  dayId: string;
  completedAt: number;
  /** ExerciseLog[] — per-exercise records (each with a `series[]`), mapped by sessionRepo. */
  exerciseLogs: unknown[];
  difficulty?: number;
  fatigue?: number;
}

/**
 * The Dexie subclass. Tables are typed via `EntityTable`; the schema string
 * declares primary keys + secondary indexes. Bump `version(n)` with a migration
 * when a store shape changes — never edit v1 in place once shipped.
 */
export class WorkoutPalDB extends Dexie {
  profile!: EntityTable<ProfileRow, "id">;
  goals!: EntityTable<GoalsRow, "id">;
  routines!: EntityTable<RoutineRow, "id">;
  sessions!: EntityTable<SessionRow, "id">;
  completedSessions!: EntityTable<CompletedSessionRow, "id">;

  constructor() {
    super("workout-pal");
    this.version(1).stores({
      profile: "id",
      goals: "id",
      routines: "id, createdAt, active",
      sessions: "id, routineId",
      completedSessions: "id, completedAt, routineId",
    });
  }
}
