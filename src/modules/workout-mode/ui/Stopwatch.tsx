"use client";

import { useEffect, useRef, useState } from "react";
import type { TimerPhase, TimerView } from "../logic/useWorkoutSession";

export interface StopwatchProps {
  timer: TimerView;
  tap: () => Promise<void>;
  /** In `ready`, whether the set can be started (a weight is entered, §D12). */
  canStartSet: boolean;
}

/**
 * The heartbeat of workout mode (design-system.md Principle 3 + workout-timer
 * spec) — the single control that cycles work → rest → overtime → next
 * series, and the ONE circular element in a system that's otherwise all
 * sharp rectangles (design-system.md §3.4's named exception).
 *
 * `borderRadius: "50%"` is set inline rather than via Tailwind's
 * `rounded-full` utility: `app/globals.css`'s `@theme inline` maps
 * `--radius-full` onto the same zeroed `--radius` token as every other
 * radius step (design-system.md §3.4 is a system-wide zero), so
 * `rounded-full` would render a *square* here — the circle has to be drawn
 * outside the radius scale entirely.
 *
 * One phase, one visual register, one accent budget (design-system.md §2
 * "Color usage" — exactly one full-saturation `accent` fill per screen):
 *  - WORK is the loud state — solid `bg-accent`, matching the "one primary
 *    action" register even though it's not a `Button`. Nothing else on the
 *    exercise screen carries a full accent fill while this is showing (no
 *    "Next exercise" CTA exists yet at this phase).
 *  - REST cools to `bg-accent-wash` (a tint, not the reserved full fill)
 *    with the actual countdown drawn as a draining ring in `accent`
 *    stroke — legitimate under the one-fill rule because a progress ring's
 *    stroke isn't "the" full-saturation fill.
 *  - OVERTIME escalates to the `warning` status color — a different token
 *    family entirely, so it never competes with the accent budget — paired
 *    with the required text label (design-system.md's status-color rule:
 *    never color alone). `text-on-accent` is reused as "on-warning" text: at
 *    L54/S96 warning is bright enough that near-black clears >10:1 on it,
 *    the same reasoning §3.1 gives for `on-accent` on the (brighter) accent
 *    hue — flagged here since the token name doesn't say so explicitly.
 *  - `exercise-complete` goes still and neutral (no pulse, no color) so the
 *    "Next exercise" CTA `ExerciseView` renders below is the only loud
 *    accent-filled thing on screen at that moment.
 */

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type ActivePhase = Exclude<TimerPhase, "exercise-complete">;

const PHASE_LABEL: Record<ActivePhase, string> = {
  ready: "Ready",
  work: "Work",
  rest: "Rest",
  overtime: "Overtime",
};

/** `ready` is calm and still (no pulse until `work`, §D12); its fill depends on
 * whether the set can start (weight entered) so the control reads as inviting
 * vs. waiting-on-input. */
function phaseClasses(phase: ActivePhase, canStartSet: boolean): string {
  switch (phase) {
    case "ready":
      return canStartSet
        ? "bg-accent-wash text-text border-2 border-accent-text"
        : "bg-surface text-text-muted border-2 border-border";
    case "work":
      return "anim-stopwatch-work bg-accent text-on-accent";
    case "rest":
      return "anim-stopwatch-rest bg-accent-wash text-text border-2 border-border";
    case "overtime":
      return "anim-stopwatch-overtime bg-warning text-on-accent";
  }
}

/** design-system.md §2 "Accessibility" — announce state TRANSITIONS only,
 * never the countdown itself ("Rest started"/"Rest complete" are the doc's
 * own literal examples). */
const ANNOUNCEMENT: Record<TimerPhase, string> = {
  ready: "Ready to start",
  work: "Set started",
  rest: "Rest started",
  overtime: "Rest complete",
  "exercise-complete": "Exercise complete",
};

/** Exported so `ExerciseView`'s per-set progress list formats a set's
 * `workSeconds` identically to the live stopwatch digits — one clock format
 * for the whole screen. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function stopwatchLabel(timer: TimerView, canStartSet: boolean): string {
  switch (timer.phase) {
    case "ready":
      return canStartSet
        ? `Set ${timer.currentSeries} of ${timer.plannedSeries}. Tap to start the set.`
        : `Enter a weight to start set ${timer.currentSeries} of ${timer.plannedSeries}.`;
    case "work":
      return `Set ${timer.currentSeries} of ${timer.plannedSeries}. ${formatClock(timer.displaySeconds)} elapsed. Tap to end the set.`;
    case "rest":
      return `Resting. ${formatClock(timer.displaySeconds)} remaining. Tap to start the next set.`;
    case "overtime":
      return `Rest is over by ${formatClock(timer.overtimeSeconds)}. Tap to start the next set.`;
    default:
      return "";
  }
}

function usePhaseAnnouncement(phase: TimerPhase): string {
  const [message, setMessage] = useState("");
  const lastPhase = useRef<TimerPhase | null>(null);

  useEffect(() => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      setMessage(ANNOUNCEMENT[phase]);
    }
  }, [phase]);

  return message;
}

const CIRCLE_SIZE = "clamp(11.25rem, 55vw, 16rem)"; // 180px – 256px

export function Stopwatch({ timer, tap, canStartSet }: StopwatchProps) {
  const announcement = usePhaseAnnouncement(timer.phase);

  // A fixed-height message slot below the circle, ALWAYS rendered, so no phase's
  // text ever grows the (vertically-centered) block and shifts the circle.
  const message =
    timer.phase === "overtime" ? (
      <p className="text-body-strong text-warning-text text-center">
        Time's up — let's keep going.
      </p>
    ) : timer.phase === "ready" && !canStartSet ? (
      <p className="text-caption text-text-muted text-center">
        Enter a weight to start.
      </p>
    ) : null;

  const messageSlot = (
    <div className="flex min-h-[var(--space-8)] items-start justify-center">
      {message}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );

  if (timer.phase === "exercise-complete") {
    return (
      <div className="flex flex-col items-center gap-[var(--space-5)]">
        <div
          role="status"
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: "50%",
          }}
          className="flex flex-col items-center justify-center gap-[var(--space-2)] border border-border bg-surface text-text"
        >
          <CheckIcon />
          <span className="text-title-3">Exercise complete</span>
        </div>
        {messageSlot}
      </div>
    );
  }

  const fraction =
    timer.phase === "rest"
      ? Math.min(
          1,
          Math.max(
            0,
            timer.displaySeconds / Math.max(1, timer.restTotalSeconds),
          ),
        )
      : 0;
  const digits =
    timer.phase === "overtime"
      ? `+${formatClock(timer.overtimeSeconds)}`
      : formatClock(timer.displaySeconds);
  const startDisabled = timer.phase === "ready" && !canStartSet;

  return (
    <div className="flex flex-col items-center gap-[var(--space-5)]">
      <button
        type="button"
        onClick={() => void tap()}
        disabled={startDisabled}
        aria-label={stopwatchLabel(timer, canStartSet)}
        style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: "50%" }}
        className={`relative isolate flex select-none items-center justify-center ${phaseClasses(timer.phase, canStartSet)}`}
      >
        {timer.phase === "rest" && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-accent-wash)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="4"
              strokeLinecap="butt"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
              className="anim-timer-fill"
            />
          </svg>
        )}
        <span className="relative flex flex-col items-center gap-[var(--space-1)]">
          <span className="text-micro">{PHASE_LABEL[timer.phase]}</span>
          <span className="text-display">{digits}</span>
          <span className="text-micro">
            Set {timer.currentSeries} of {timer.plannedSeries}
          </span>
        </span>
      </button>
      {messageSlot}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
    >
      <path
        d="M4 13l5 5L20 6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
