"use client";

import Link from "next/link";
import type { Routine } from "../types";

/**
 * The per-day routine summary (spec `home-routine-dashboard`) — the active
 * routine as a list of its days, each an at-a-glance row. Activating a day
 * navigates to workout mode for that day (`/workout/[dayId]`, empty for now,
 * design.md §D8). Rows are outline/surface, never accent — the composer's send
 * button is the screen's one accent fill (design-system.md §2 "Color usage").
 */
export interface RoutineSummaryProps {
  routine: Routine;
}

/** A short "3 exercises" style hint for a day row. */
function daySummary(exerciseCount: number): string {
  return exerciseCount === 1 ? "1 exercise" : `${exerciseCount} exercises`;
}

export function RoutineSummary({ routine }: RoutineSummaryProps) {
  return (
    <section
      aria-label="Your routine"
      className="flex flex-col gap-[var(--space-3)]"
    >
      <ul className="flex flex-col gap-[var(--space-3)]">
        {routine.days.map((day) => (
          <li key={day.id}>
            <Link
              href={`/workout/${day.id}`}
              className="anim-press flex min-h-[var(--control-height-lg)] items-center justify-between gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)] hover:bg-elevated-surface"
            >
              <span className="text-title-3">{day.name}</span>
              <span className="text-caption text-text-muted">
                {daySummary(day.exercises.length)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
