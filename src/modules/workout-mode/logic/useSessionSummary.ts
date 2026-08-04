"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useActiveRoutine } from "@/modules/routine-generation";
import { getCompletedForRoutine } from "../api/sessionRepo";
import { RECENT_SESSION_LIMIT, summarizeSessions } from "./summary";

/**
 * The session-history seam (routine-edit-history design.md §Decision 3). A
 * self-resolving, no-argument hook: it reads the active routine via
 * `useActiveRoutine` (a legal D→B import), live-queries that routine's recent
 * completed sessions, and returns their summary — or `null` when there is no
 * routine, no history yet, or the query has not emitted (so the composition
 * layer needs zero branching). `useLiveQuery` re-emits when history is logged.
 *
 * Only a plain `string | null` crosses out of workout-mode; no D type leaks to
 * the composition layer or to routine-generation, keeping the graph acyclic.
 */
export function useSessionSummary(): string | null {
  const routineId = useActiveRoutine().routine?.id ?? null;
  const summary = useLiveQuery(async () => {
    if (routineId === null) return null;
    return summarizeSessions(
      await getCompletedForRoutine(routineId, RECENT_SESSION_LIMIT),
    );
  }, [routineId]);
  return summary ?? null; // undefined (first emit) also collapses to null
}
