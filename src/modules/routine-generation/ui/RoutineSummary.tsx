"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import type { Routine } from "../types";

/**
 * The per-day routine summary (spec `home-routine-dashboard`) — the active
 * routine as a list of its days, each an at-a-glance row. Activating a day
 * navigates to workout mode for that day (`/workout/[dayId]`, empty for now,
 * design.md §D8). Rows are outline/surface, never accent — the composer's send
 * button is the screen's one accent fill (design-system.md §2 "Color usage").
 *
 * Leads with the routine's own (often AI-authored, personality-bearing) name
 * as a real, visible section heading — previously nothing on screen named
 * the active routine at all.
 *
 * The edit button (edit-routine design.md §F) sits in this same title row —
 * it's present only when a routine exists, which this component only ever
 * renders with. `editButtonRef` is handed to `RoutineHomeScreen` so it can
 * return focus here when the floating editor closes (design.md §F non-modal
 * focus model — the editor doesn't own a reference to a button it doesn't
 * render).
 */
export interface RoutineSummaryProps {
  routine: Routine;
  onEdit: () => void;
  editButtonRef: RefObject<HTMLButtonElement | null>;
}

/** A plain stroke pencil (design-system.md §2 "Iconography"). */
function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
    >
      <path
        d="M12.5 3.5l4 4L6 18H2v-4L12.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** A short "3 exercises" style hint for a day row. */
function daySummary(exerciseCount: number): string {
  return exerciseCount === 1 ? "1 exercise" : `${exerciseCount} exercises`;
}

/**
 * A plain stroke chevron (design-system.md §2 "Iconography" — stroke-based,
 * not filled; butt caps + miter joins to match `Logo`'s sharp-cornered
 * language rather than a soft rounded-cap arrow). Purely decorative: the
 * row's own text already carries "this navigates" via `Link`'s semantics,
 * so it's `aria-hidden`.
 */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      className={className}
    >
      <path
        d="M7.5 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function RoutineSummary({
  routine,
  onEdit,
  editButtonRef,
}: RoutineSummaryProps) {
  return (
    <section
      aria-labelledby="routine-summary-heading"
      className="flex flex-col gap-[var(--space-4)]"
    >
      <div className="flex items-center justify-between gap-[var(--space-4)]">
        <h3 id="routine-summary-heading" className="text-title-2">
          {routine.name}
        </h3>
        <Button
          ref={editButtonRef}
          variant="secondary"
          size="sm"
          onClick={onEdit}
        >
          <EditIcon />
          Edit routine
        </Button>
      </div>
      <ul className="flex flex-col gap-[var(--space-3)]">
        {routine.days.map((day, index) => (
          <li key={day.id}>
            <Link
              href={`/workout/${day.id}`}
              className="anim-press group flex min-h-[var(--control-height-lg)] items-center gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)] transition-colors hover:border-text hover:bg-elevated-surface"
            >
              <span
                aria-hidden="true"
                className="text-title-1 w-[var(--space-8)] shrink-0 text-text-muted transition-colors group-hover:text-text"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
                <span className="text-title-3">{day.name}</span>
                <span className="text-caption text-text-muted">
                  {daySummary(day.exercises.length)}
                </span>
              </span>
              <ChevronIcon className="shrink-0 text-text-muted transition-colors group-hover:text-text" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
