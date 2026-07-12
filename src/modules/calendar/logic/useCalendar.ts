"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useActiveRoutine } from "@/modules/routine-generation";
import { getCompletedInRange } from "../api/calendarRepo";
import type {
  CompletedRef,
  WeeklyProgress,
  WeekStripDay,
  YearGridDay,
} from "../types";
import {
  buildWeek,
  buildYearGrid,
  localDayKey,
  monthName,
  startOfWeek,
  weeklyProgress,
} from "./model";

/**
 * The calendar seam (design.md §5) — three read-only views derived from one
 * reactive Dexie range read plus the active routine. UI does no date math,
 * joins, or counting; every displayed value arrives ready.
 */
export interface CalendarApi {
  week: WeekStripDay[]; // exactly 7, Monday → Sunday
  month: string; // full current-month name (e.g. "July"), from the live clock
  weeklyProgress: WeeklyProgress | null; // null ⇒ no active routine
  yearGrid: YearGridDay[]; // pad cells + Jan 1 → Dec 31, current year
  loading: boolean; // true until the first Dexie emit
  error: Error | null;
}

export function useCalendar(): CalendarApi {
  // Only the query's LOWER bound is pinned (stable live-query deps, no
  // re-subscribe loop). `lower` covers the year grid AND an early-January week
  // whose Monday falls in the prior December. The upper bound is unbounded —
  // sessions are never in the future — so a session completed after mount (even
  // after midnight or into a new year) is still read.
  const lower = useMemo(() => {
    const now = Date.now();
    const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
    const weekStart = startOfWeek(new Date(now)).getTime();
    return Math.min(yearStart, weekStart);
  }, []);

  // Same catch pattern as useActiveRoutine: undefined until the first emit.
  const result = useLiveQuery(async () => {
    try {
      const refs = await getCompletedInRange(lower, Number.MAX_SAFE_INTEGER);
      return { refs, error: null as Error | null };
    } catch (e) {
      return { refs: [] as CompletedRef[], error: e as Error };
    }
  }, [lower]);

  const {
    routine,
    loading: routineLoading,
    error: routineError,
  } = useActiveRoutine();

  // Bucket against a LIVE clock, not the pinned query bound: the current day
  // key gates recompute to day boundaries, so a session completed after midnight
  // (its Dexie emit re-renders us) lands in the correct day/week/year.
  const todayKey = localDayKey(Date.now());
  const views = useMemo(() => {
    const refs = result?.refs ?? [];
    const [y, m, d] = todayKey.split("-").map(Number);
    const now = new Date(y, m - 1, d).getTime(); // local midnight today
    const dayNameById = new Map(
      (routine?.days ?? []).map((d) => [d.id, d.name] as const),
    );
    const week = buildWeek(refs, dayNameById, now);
    return {
      week,
      month: monthName(todayKey),
      weeklyProgress: weeklyProgress(week, routine),
      yearGrid: buildYearGrid(refs, y),
    };
  }, [result, routine, todayKey]);

  return {
    week: views.week,
    month: views.month,
    weeklyProgress: views.weeklyProgress,
    yearGrid: views.yearGrid,
    loading: result === undefined || routineLoading,
    error: result?.error ?? routineError,
  };
}
