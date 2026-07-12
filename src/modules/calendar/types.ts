/**
 * calendar (Feature C) — owned domain types. Leaf module: imports nothing.
 * Three purpose-fit, read-only views derived from completed sessions
 * (design.md §4).
 */

/**
 * Minimal completed-session projection the views need (internal — not exported
 * from the barrel). `calendarRepo` maps rows to this; `model.ts` buckets it.
 */
export interface CompletedRef {
  completedAt: number;
  dayId: string;
}

/** One day of the home week strip (Monday → Sunday). */
export interface WeekStripDay {
  /** Local ISO date, yyyy-mm-dd. */
  date: string;
  /** Display label, "Sat 11 Jul". */
  label: string;
  /** True when ≥1 session completed that day. */
  worked: boolean;
  /** Most-recent session's routine-day name, or null (un-worked / day dropped). */
  sessionName: string | null;
}

/** "N of M this week" — N distinct worked days, M active-routine day count. */
export interface WeeklyProgress {
  completed: number;
  target: number;
}

/** One square of the year grid (Monday-first, current year). */
export interface YearGridDay {
  /** Local ISO date, or null for a leading pad cell (Monday alignment). */
  date: string | null;
  /** True when ≥1 session completed that day; always false for pad cells. */
  worked: boolean;
}
