/**
 * The day-cycle rules (design.md §D2) — pure and total: no I/O, no React, no
 * clock. The cycle is DERIVED from the completed-session history on every read,
 * never persisted.
 */

import type { DayCard, DayState, RoutineDay } from "../types";

function toCard(day: RoutineDay, index: number, state: DayState): DayCard {
  return {
    id: day.id,
    name: day.name,
    position: index + 1,
    exerciseCount: day.exercises.length,
    state,
  };
}

/**
 * @param days             the active routine's days, in routine order
 * @param completedDayIds  dayIds of the active routine's completed sessions,
 *                         OLDEST → NEWEST, already time-bounded by the caller
 * @returns one card per day: `next` FIRST, then the remaining days in routine
 *          order. `[]` when `days` is empty. Ids not in `days` are ignored.
 */
export function buildDayCards(
  days: RoutineDay[],
  completedDayIds: string[],
): DayCard[] {
  if (days.length === 0) return [];

  const indexOf = new Map(days.map((day, i) => [day.id, i] as const));
  let finished = new Set<string>();
  let last: string | null = null;

  for (const id of completedDayIds) {
    if (!indexOf.has(id)) continue; // day removed by an edit
    if (finished.has(id))
      finished = new Set([id]); // re-finish restart
    else finished.add(id);
    last = id;
    if (finished.size === days.length) {
      finished = new Set();
      last = null; // full set done → the pointer is ignored, day 1 is next
    }
  }

  const nextIndex =
    last === null ? 0 : ((indexOf.get(last) as number) + 1) % days.length;

  const cards = days.map((day, i) =>
    toCard(
      day,
      i,
      i === nextIndex ? "next" : finished.has(day.id) ? "finished" : "idle",
    ),
  );

  return [cards[nextIndex], ...cards.filter((_, i) => i !== nextIndex)];
}

/**
 * Every day in routine order, all `idle` — the fallback when the session read
 * fails (design.md, seam state table). NOT `buildDayCards(days, [])`, which
 * would mark day 1 as `next`.
 */
export function buildIdleDayCards(days: RoutineDay[]): DayCard[] {
  return days.map((day, i) => toCard(day, i, "idle"));
}
