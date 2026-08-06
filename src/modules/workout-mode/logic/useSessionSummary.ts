"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "@/modules/profile-goals";
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
 * The cross-feature JOIN lives here, not in `summarizeSessions`, which stays
 * pure (evidence-based-routine-prompts §D4): this hook flattens the routine into
 * the prescribed-exercise list and day count the skip detection needs, and adds
 * the weekly target from `useProfile` (a legal D→A barrel import, already
 * precedented by `useWorkoutSession`; A imports no other feature, so no cycle).
 *
 * Only a plain `string | null` crosses out of workout-mode; no D type leaks to
 * the composition layer or to routine-generation, keeping the graph acyclic.
 */
export function useSessionSummary(): string | null {
  const routine = useActiveRoutine().routine;
  const daysPerWeek = useProfile().goals?.daysPerWeek ?? null;
  const summary = useLiveQuery(async () => {
    if (routine === null) return null;
    return summarizeSessions(
      await getCompletedForRoutine(routine.id, RECENT_SESSION_LIMIT),
      {
        prescribed: routine.days.flatMap((day) =>
          day.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
          })),
        ),
        dayCount: routine.days.length,
        daysPerWeek,
      },
    );
    // `routine` is the identity Dexie's own live query emitted, so it is stable
    // between renders and changes exactly when the routine row does — a rename
    // or an added exercise re-emits the summary. `daysPerWeek` does the same for
    // goals.
  }, [routine, daysPerWeek]);
  return summary ?? null; // undefined (first emit) also collapses to null
}
