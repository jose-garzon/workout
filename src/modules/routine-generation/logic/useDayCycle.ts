"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getCompletedDayIdsSince } from "../api/cycleRepo";
import type { DayCard } from "../types";
import { buildDayCards, buildIdleDayCards } from "./model";
import { useActiveRoutine } from "./useActiveRoutine";

/**
 * The day-cycle seam (design.md, "The logic↔UI seam") — the home day list,
 * ready to render. Zero arguments: it resolves the routine itself and live-
 * queries the sessions since `routine.createdAt`, so returning home after a
 * completed session re-renders with the advanced cycle, no manual refetch.
 */
export interface DayCycleApi {
  /** Pre-ordered: `next` first, then routine order. `[]` before the first emit
   *  and when there is no active routine. On `error` — and while the session
   *  query has not yet emitted for THIS routine — EVERY day in routine order,
   *  all `state: "idle"`: the list degrades, it never disappears and never
   *  shows a cycle it hasn't read. */
  days: DayCard[];
  /** true until the session query has emitted FOR THE CURRENT routine (a value
   *  left over from a previous `createdAt` still counts as not emitted). */
  loading: boolean;
  error: Error | null;
}

export function useDayCycle(): DayCycleApi {
  const {
    routine,
    loading: routineLoading,
    error: routineError,
  } = useActiveRoutine();
  const createdAt = routine?.createdAt ?? null;

  // Same catch pattern as useActiveRoutine: undefined until the first emit.
  // Each result is STAMPED with the `createdAt` it read — see the staleness
  // guard below for why that stamp is load-bearing.
  const result = useLiveQuery(async () => {
    if (createdAt === null)
      return { createdAt, dayIds: [] as string[], error: null as Error | null };
    try {
      return {
        createdAt,
        dayIds: await getCompletedDayIdsSince(createdAt),
        error: null as Error | null,
      };
    } catch (e) {
      return { createdAt, dayIds: [] as string[], error: e as Error };
    }
  }, [createdAt]);

  if (routine === null) {
    return { days: [], loading: routineLoading, error: routineError };
  }
  // `useLiveQuery` keeps returning the PREVIOUS subscription's value after its
  // deps change (its `hasResult` ref is never reset), so on a cold load the
  // no-routine result (`dayIds: []`) survives into the frame where `createdAt`
  // has just resolved. Folding it would fabricate a cycle — day 1 as `next`
  // over a mid-cycle routine, for a whole paint plus an IndexedDB round trip.
  // A result stamped with another `createdAt` is not an answer to this query:
  // degrade to all-idle and keep reporting `loading`, never invent a cycle.
  if (result === undefined || result.createdAt !== createdAt) {
    return {
      days: buildIdleDayCards(routine.days),
      loading: true,
      error: null,
    };
  }
  if (result.error) {
    return {
      days: buildIdleDayCards(routine.days),
      loading: false,
      error: result.error,
    };
  }
  return {
    days: buildDayCards(routine.days, result.dayIds),
    loading: false,
    error: null,
  };
}
