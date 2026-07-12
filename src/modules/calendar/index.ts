/**
 * calendar (Feature C) — PUBLIC BARREL. Seam hook + public derived-view types.
 * Internals are private.
 */

export type { CalendarApi } from "./logic/useCalendar";
export { useCalendar } from "./logic/useCalendar";
export type { WeeklyProgress, WeekStripDay, YearGridDay } from "./types";
