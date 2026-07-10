"use client";

import type { CalendarWeek, ConsistencySummary } from "../types";

/**
 * The calendar seam — consistency over completed sessions. Foundation stub —
 * signature only; the aggregation logic (reading `CompletedSession` via
 * workout-mode's barrel) lands in the calendar feature change (C).
 */
export interface CalendarApi {
  weeks: CalendarWeek[];
  summary: ConsistencySummary | null;
  loading: boolean;
  error: Error | null;
}

export function useCalendar(): CalendarApi {
  throw new Error(
    "useCalendar is implemented in the calendar feature change (C).",
  );
}
