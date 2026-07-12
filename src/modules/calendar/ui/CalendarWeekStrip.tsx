"use client";

import { useState } from "react";
import { useCalendar } from "../logic/useCalendar";
import { ActivityDrawer } from "./ActivityDrawer";
import { WeekCell } from "./WeekCell";

/**
 * The home-surface consistency glance (design.md §1/§6, proposal Story
 * 1/1b). Sits between `RoutineHomeScreen`'s identity block and its routine
 * region via the app-composed `weekStrip` slot — this component itself
 * never imports anything from `routine-generation` (firewall rule 1); the
 * weekly target/day-name join already happened inside `useCalendar`.
 *
 * The whole strip is one `<button>` — tapping anywhere opens the year
 * drawer it owns (`open` state lives here, not in the drawer). No chevron
 * or "view year" label is added on top of the seven cells + counter: the
 * cells' own worked/muted contrast plus the row reading as one pressable
 * block is the affordance, matching the row-as-button pattern already used
 * by `RoutineSummary`'s day rows.
 *
 * Below the squares sits one small-type counter row: "N of M this week" on
 * the left (only when `weeklyProgress` isn't null — no active routine), the
 * current month on the right (always — it's the strip's only date context
 * now that cells dropped down to a bare "Mon 10"). Both slots are real flex
 * children (the left one just renders empty when there's no progress to
 * show) so `justify-between` keeps the month flush right either way, no
 * `ml-auto` special-casing needed.
 */
export function CalendarWeekStrip() {
  const { week, month, weeklyProgress, yearGrid, loading, error } =
    useCalendar();
  const [open, setOpen] = useState(false);

  if (error) {
    return (
      <div className="flex min-h-[4.75rem] items-center border border-border bg-surface px-[var(--space-4)]">
        <p className="text-caption text-text-muted">
          Couldn't load this week's activity.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open activity tracker"
        className="anim-press group flex w-full flex-col gap-[var(--space-2)] text-left"
      >
        <div className="grid grid-cols-7 gap-[var(--space-1)] justify-items-center">
          {loading
            ? Array.from({ length: 7 }, (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-only placeholder row, never reordered or diffed against real data.
                  key={i}
                  aria-hidden="true"
                  className="aspect-square w-full max-w-[var(--space-9)] max-h-[var(--space-9)] justify-self-center border border-border bg-surface"
                />
              ))
            : week.map((day) => <WeekCell key={day.date} day={day} />)}
        </div>
        <div className="flex items-center justify-between gap-[var(--space-2)] text-caption text-text-muted">
          <span>
            {weeklyProgress !== null &&
              `${weeklyProgress.completed} of ${weeklyProgress.target} this week`}
          </span>
          <span>{month}</span>
        </div>
      </button>
      <ActivityDrawer
        open={open}
        yearGrid={yearGrid}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
