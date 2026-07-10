import { WorkoutPalDB } from "./schema";

/**
 * The single, app-wide Dexie instance — BROWSER-ONLY.
 *
 * Constructing a Dexie subclass does NOT open IndexedDB (Dexie opens lazily on
 * the first operation), so importing this module has no side effects on the
 * server. It must nonetheless never be imported by a server component or the AI
 * route: `shared/db` is the persistence layer the local-first constraint forbids
 * the server from touching, tool-enforced by Biome firewall rule 4 (design.md
 * §3). Every feature reaches it through its own `api/*Repo`.
 */
export const db = new WorkoutPalDB();

export type {
  CompletedSessionRow,
  GoalsRow,
  ProfileRow,
  RoutineRow,
  SessionRow,
} from "./schema";
