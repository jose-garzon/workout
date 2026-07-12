"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { YearGridDay } from "../types";

/** Today as a local ISO `yyyy-mm-dd` — matches the seam's day keys. */
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Gap between cells, px — below the `--space` scale's 4px step on purpose: a
 * dense glance heatmap (design-system.md §1 principle 6), not tap targets. */
const GAP = 3;
/** Mobile square-size cap (px). */
const MOBILE_MAX = 40;
/** Desktop square-size cap (px). */
const DESKTOP_MAX = 16;
/** Desktop cutoff — matches `ActivityDrawer`'s modal/drawer split (`sm`). */
const DESKTOP_MQ = "(min-width: 480px)";

/**
 * The full-year activity grid inside `ActivityDrawer` (design.md §6, proposal
 * AC2.2/2.3). Presentational, non-interactive (Key decision 4). The flat,
 * already-ordered `days` array (leading Monday-align pad cells, then Jan 1 →
 * Dec 31) is the SAME in both orientations — only the CSS grid flow differs,
 * and the leading pad cells align the first partial week either way.
 *
 * **Two orientations (fixes brief):**
 * - **Mobile (< sm) — VERTICAL, scrolls.** 7 columns (days), weeks stack down
 *   Jan→Dec. Square size fills the width up to `MOBILE_MAX` (40px), so all ~53
 *   weeks are taller than the drawer and the wrapper scrolls vertically.
 * - **Desktop (≥ sm) — HORIZONTAL, no scroll (GitHub-style).** 7 rows
 *   (weekdays), weeks run left→right as columns (`grid-auto-flow: column`).
 *   Square size fits the width across all ~53 columns (capped `DESKTOP_MAX`),
 *   so the short 7-row strip sits centered with no scroll.
 *
 * Size is width-measured (`ResizeObserver`) in `useLayoutEffect` (before
 * paint, no wrong-size flash); orientation follows a `matchMedia` listener.
 */
export interface YearGridProps {
  days: YearGridDay[];
}

export function YearGrid({ days }: YearGridProps) {
  // Weeks in the year: the vertical row count, and the horizontal column count.
  const weeks = Math.ceil(days.length / 7);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const today = useMemo(todayIso, []);
  const [desktop, setDesktop] = useState(false);
  const [size, setSize] = useState(0);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const mq = window.matchMedia(DESKTOP_MQ);

    function measure() {
      const isDesktop = mq.matches;
      const width = wrapper?.clientWidth ?? 0;
      // Mobile fills width across 7 day-columns; desktop fits width across all
      // `weeks` columns. Both are width-driven — mobile height overflows (scroll),
      // desktop's 7 rows always fit.
      const cols = isDesktop ? weeks : 7;
      const raw = Math.floor((width - (cols - 1) * GAP) / cols);
      const cap = isDesktop ? DESKTOP_MAX : MOBILE_MAX;
      setDesktop(isDesktop);
      setSize(Math.max(Math.min(raw, cap), 0));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    mq.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", measure);
    };
  }, [weeks]);

  // Mobile (vertical, scrolls): once sized, bring today's square into view so
  // opening the drawer lands on "now", not January. Desktop fits with no scroll,
  // so there's nothing to scroll to. Runs before paint (no visible jump).
  useLayoutEffect(() => {
    if (desktop || size === 0) return;
    todayRef.current?.scrollIntoView({ block: "center" });
  }, [desktop, size]);

  const gridStyle = desktop
    ? {
        gridTemplateRows: `repeat(7, ${size}px)`,
        gridAutoColumns: `${size}px`,
        gridAutoFlow: "column" as const,
      }
    : {
        gridTemplateColumns: `repeat(7, ${size}px)`,
        gridAutoRows: `${size}px`,
      };

  return (
    <div
      ref={wrapperRef}
      className={
        desktop
          ? "flex w-full items-center justify-center overflow-hidden"
          : "h-full w-full overflow-y-auto"
      }
    >
      <div
        data-testid="year-grid"
        aria-hidden="true"
        className={desktop ? "grid" : "mx-auto grid justify-center"}
        style={{
          ...gridStyle,
          gap: GAP,
          // Hidden until the first real measurement lands so there's never a
          // one-frame flash of an unsized (0px) grid.
          visibility: size > 0 ? "visible" : "hidden",
        }}
      >
        {days.map((day, index) =>
          day.date === null ? (
            // Pad cell — an empty gap, not a muted square (design.md §6). Still
            // carries the `year-day` testid (only `data-date`/`data-worked`
            // are withheld) so the e2e selector's "real squares only" filter
            // (`[data-testid="year-day"][data-date]`) is an explicit choice,
            // not an accident of a missing hook.
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: pad cells are a fixed-count leading run computed once per year from `days.length`, never reordered/added/removed independently of a full `yearGrid` recompute.
              key={`pad-${index}`}
              data-testid="year-day"
            />
          ) : (
            <div
              key={day.date}
              ref={day.date === today ? todayRef : undefined}
              data-testid="year-day"
              data-date={day.date}
              data-worked={day.worked}
              className={
                day.worked ? "bg-accent" : "border border-border bg-surface"
              }
            />
          ),
        )}
      </div>
    </div>
  );
}
