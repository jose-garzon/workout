/**
 * calendar aggregation (design.md §3) — pure, no I/O, unit-testable. Every
 * bucketing is LOCAL time (never UTC) so "trained Saturday night" lands on
 * Saturday. Imports only `../types`.
 */

import type {
  CompletedRef,
  WeeklyProgress,
  WeekStripDay,
  YearGridDay,
} from "../types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local calendar day of `ms` as `yyyy-mm-dd`. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday 00:00 local of the week containing `date` (ISO week). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7; // days since Monday (Sun=0 → 6)
  d.setDate(d.getDate() - diff);
  return d;
}

/** A `yyyy-mm-dd` key rendered as "Sat 11" — weekday abbrev + day-of-month (local). */
export function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d}`;
}

/** Full month name (e.g. "July") for a `yyyy-mm-dd` key (local). */
export function monthName(dayKey: string): string {
  const m = Number(dayKey.split("-")[1]);
  return MONTHS_FULL[m - 1];
}

/** Most-recent ref per local day (max `completedAt`). */
function latestByDay(refs: CompletedRef[]): Map<string, CompletedRef> {
  const map = new Map<string, CompletedRef>();
  for (const ref of refs) {
    const key = localDayKey(ref.completedAt);
    const prev = map.get(key);
    if (!prev || ref.completedAt > prev.completedAt) map.set(key, ref);
  }
  return map;
}

/**
 * 7 cells Mon→Sun of the week containing `now`. A cell is `worked` when ≥1 ref
 * bucketed to that day; `sessionName` = the `dayId → name` of the most-recent
 * ref that day, or `null` (un-worked, or the routine no longer has that day).
 */
export function buildWeek(
  refs: CompletedRef[],
  dayNameById: Map<string, string>,
  now: number,
): WeekStripDay[] {
  const latest = latestByDay(refs);
  const monday = startOfWeek(new Date(now));
  const week: WeekStripDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i,
    );
    const key = localDayKey(d.getTime());
    const ref = latest.get(key);
    week.push({
      date: key,
      label: dayLabel(key),
      worked: ref !== undefined,
      sessionName: ref ? (dayNameById.get(ref.dayId) ?? null) : null,
    });
  }
  return week;
}

/** `null` with no active routine; else N distinct worked days over M day count. */
export function weeklyProgress(
  week: WeekStripDay[],
  routine: { days: readonly unknown[] } | null,
): WeeklyProgress | null {
  if (!routine) return null;
  return {
    completed: week.filter((d) => d.worked).length,
    target: routine.days.length,
  };
}

/**
 * Leading `date:null` pad cells (so Jan 1 lands under its Monday column), then
 * Jan 1 → Dec 31 of `year`, each `worked` when ≥1 ref bucketed to that day.
 */
export function buildYearGrid(
  refs: CompletedRef[],
  year: number,
): YearGridDay[] {
  const workedKeys = new Set(refs.map((r) => localDayKey(r.completedAt)));
  const pad = (new Date(year, 0, 1).getDay() + 6) % 7; // Monday-first offset
  const grid: YearGridDay[] = [];
  for (let i = 0; i < pad; i++) grid.push({ date: null, worked: false });
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    const key = localDayKey(cursor.getTime());
    grid.push({ date: key, worked: workedKeys.has(key) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return grid;
}
