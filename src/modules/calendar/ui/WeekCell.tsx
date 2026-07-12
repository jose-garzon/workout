import type { WeekStripDay } from "../types";

/**
 * One cell of the home week strip (design.md §6, proposal AC1.2–1.4).
 * Presentational only — no interaction of its own; the whole strip is a
 * single `<button>` (`CalendarWeekStrip`), so this renders as a plain `div`.
 *
 * A bare SQUARE, capped at `--space-9` (48px, the strip's original compact
 * height) so it never grows past a small glance-mark even on wide desktop
 * viewports — `aspect-square` + equal `max-w`/`max-h` keeps both dimensions
 * locked together; on narrow phones the column itself is under the cap, so
 * the square shrinks to fit all 7 across (the cap is a ceiling, not a fixed
 * size). Shows ONLY `day.label` ("Mon 10" — weekday + day-of-month),
 * centered both axes. The session name is deliberately NOT rendered here
 * (the redesigned strip is a pure glance mark, not a detail readout — that
 * detail still lives one tap away in the year drawer's caption/date).
 *
 * Un-worked → muted placeholder (design-system.md §3.1: a hairline `surface`
 * block, never accent — accent is reserved for "worked"). Worked → the one
 * sanctioned repeated use of the full-saturation `accent` fill in this
 * system: each cell here is a status mark in a day-by-day activity readout
 * (the same grammar as the year grid's squares), not a competing "selected
 * control" — proposal.md AC1.2/1.4 and design.md §6 both specify accent fill
 * for every worked day, deliberately, not a one-off.
 */
export interface WeekCellProps {
  day: WeekStripDay;
}

export function WeekCell({ day }: WeekCellProps) {
  const { date, label, worked } = day;

  return (
    <div
      data-testid="week-cell"
      data-date={date}
      data-worked={worked}
      className={[
        "flex aspect-square w-full max-w-[var(--space-9)] max-h-[var(--space-9)] items-center justify-center justify-self-center text-center transition-colors",
        worked
          ? "bg-accent text-on-accent"
          : "border border-border bg-surface text-text-muted group-hover:border-text",
      ].join(" ")}
    >
      <span className="text-micro leading-tight">{label}</span>
    </div>
  );
}
