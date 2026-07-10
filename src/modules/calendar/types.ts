/**
 * calendar (Feature C) — owned domain types. Leaf module: imports nothing.
 * Derived, read-only views over completed sessions (no dates/planned/missed).
 */

/** A single day cell. `date` is a local ISO date (yyyy-mm-dd). */
export interface CalendarDay {
  date: string;
  completedSessionCount: number;
}

/** One week row. `completedCount` of `targetCount` drives "3 of 4 this week". */
export interface CalendarWeek {
  /** Local ISO date (yyyy-mm-dd) of the week's first day. */
  weekStartDate: string;
  days: CalendarDay[];
  completedCount: number;
  targetCount: number;
}

/** Rolling consistency stats derived from completed sessions. */
export interface ConsistencySummary {
  weeklyTarget: number;
  weeklyCompleted: number;
  currentStreakWeeks: number;
}
