"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { useTranslation } from "@/shared/i18n";
import type { DayCard, Routine } from "../types";

/**
 * The per-day routine summary (spec `home-routine-dashboard`) — the active
 * routine's days, pre-ordered and pre-stated by `useDayCycle` (`next` first,
 * design.md §D3): this component does no sorting, no state derivation, no
 * numbering math, it only renders `days` in the order it's given.
 * Activating a day navigates to workout mode for that day
 * (`/workout/[dayId]`, empty for now, design.md §D8) — every state stays a
 * `Link`. `idle`/`finished` rows are outline/surface or wash, never a full
 * accent fill — the composer's send button and the week strip's worked cells
 * are the screen's sanctioned accent fills (design-system.md §2 "Color usage",
 * design.md §D4).
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
  /** Unchanged role: heading name + edit button only. Days render from `days`. */
  routine: Routine;
  /** Pre-ordered, pre-stated (`next` first) — design.md §"The logic↔UI seam". */
  days: DayCard[];
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
function daySummary(
  exerciseCount: number,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return exerciseCount === 1
    ? t("routine.summary.exercises.one")
    : t("routine.summary.exercises.other", { count: exerciseCount });
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

/**
 * Row styling per state (design.md §D4, DECIDED). `next` and `finished` both
 * sit on `accent-wash` — the three non-colour separators below (border, size
 * step, eyebrow) are what keep them apart, each asserted in the component
 * test:
 * 1. Border — `next` gets a solid `accent-text` border, `finished` keeps the
 *    plain `border-border` hairline (same as `idle`).
 * 2. Size — `next` steps up to `--space-11` min-height and `--space-5`
 *    padding, a full step above `idle`/`finished`'s shared
 *    `--control-height-lg`/`--space-4`.
 * 3. Eyebrow — `next` alone renders a visible `text-micro` label (below).
 * A full-saturation `bg-accent` card was rejected — the week strip already
 * spends the screen's one sanctioned accent fill.
 */
function rowClassName(state: DayCard["state"]): string {
  const shared =
    "anim-press group flex items-center gap-[var(--space-4)] px-[var(--space-5)] transition-colors";
  if (state === "next") {
    return `${shared} min-h-[var(--space-11)] border border-accent-text bg-accent-wash py-[var(--space-5)]`;
  }
  if (state === "finished") {
    return `${shared} min-h-[var(--control-height-lg)] border border-border bg-accent-wash py-[var(--space-4)] hover:border-text`;
  }
  return `${shared} min-h-[var(--control-height-lg)] border border-border bg-surface py-[var(--space-4)] hover:border-text hover:bg-elevated-surface`;
}

export function RoutineSummary({
  routine,
  days,
  onEdit,
  editButtonRef,
}: RoutineSummaryProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="routine-summary-heading"
      className="flex flex-col gap-[var(--space-4)]"
    >
      <div className="flex items-center justify-between gap-[var(--space-4)]">
        <h3 id="routine-summary-heading" className="text-title-2">
          {routine.name}
        </h3>
        <button
          ref={editButtonRef}
          type="button"
          onClick={onEdit}
          aria-label={t("routine.summary.edit")}
          className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
        >
          <EditIcon />
        </button>
      </div>
      {days.length > 0 && (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {days.map((card) => (
            <li key={card.id}>
              <Link
                href={`/workout/${card.id}`}
                className={rowClassName(card.state)}
              >
                <span
                  aria-hidden="true"
                  className={`text-title-1 w-[var(--space-8)] shrink-0 transition-colors ${
                    card.state === "finished"
                      ? "text-accent-text"
                      : "text-text-muted group-hover:text-text"
                  }`}
                >
                  {String(card.position).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
                  {card.state === "next" && (
                    <span className="text-micro text-accent-text">
                      {t("routine.summary.state.next")}
                    </span>
                  )}
                  <span className="text-title-3">{card.name}</span>
                  <span className="text-caption text-text-muted">
                    {daySummary(card.exerciseCount, t)}
                  </span>
                  {card.state === "finished" && (
                    <span className="sr-only">
                      {t("routine.summary.state.finished")}
                    </span>
                  )}
                </span>
                <ChevronIcon className="shrink-0 text-text-muted transition-colors group-hover:text-text" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
