"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import type { WorkoutSessionApi } from "../logic/useWorkoutSession";

export interface SessionOverviewProps {
  session: WorkoutSessionApi;
}

/**
 * The pre-start screen (session-overview spec): the day's plan, the one
 * editable session-wide rest default (seeded via `defaultRestSeconds`,
 * written back via `setDefaultRestSeconds`), and the single Start action.
 * The rest field keeps its own local text state only so the user can type a
 * multi-digit number freely — every valid keystroke still commits straight
 * through to the seam, there's no separate "save" step.
 */
export function SessionOverview({ session }: SessionOverviewProps) {
  const {
    dayName,
    exercises,
    defaultRestSeconds,
    setDefaultRestSeconds,
    start,
  } = session;
  const [restText, setRestText] = useState(String(defaultRestSeconds));
  const [starting, setStarting] = useState(false);

  const handleRestChange = (value: string) => {
    setRestText(value);
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (trimmed !== "" && Number.isFinite(parsed) && parsed >= 0) {
      setDefaultRestSeconds(Math.round(parsed));
    }
  };

  const handleStart = () => {
    setStarting(true);
    void start();
  };

  return (
    <div className="flex flex-1 flex-col gap-[var(--space-7)]">
      <div className="flex flex-col gap-[var(--space-2)]">
        <h2 className="text-title-1">{dayName}</h2>
        <p className="text-body text-text-muted">
          {exercises.length === 1
            ? "1 exercise"
            : `${exercises.length} exercises`}
        </p>
      </div>

      {/* The variable-length list absorbs the leftover space between the
          fixed identity block above and the rest-field + Start dock below,
          same "flex-1 justify-center" fix as RoutineSummary/OnboardingForm —
          a plain `mt-auto` on the dock left a dead gap on a short (1–2
          exercise) day. */}
      <div className="flex flex-1 flex-col justify-center">
        <ul className="flex flex-col gap-[var(--space-3)]">
          {exercises.map((exercise, index) => (
            <li
              key={exercise.id}
              className="flex items-center gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)]"
            >
              <span
                aria-hidden="true"
                className="text-title-1 w-[var(--space-8)] shrink-0 text-text-muted"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
                <span className="text-title-3">{exercise.name}</span>
                <span className="text-caption text-text-muted">
                  {exercise.plannedSeries} series · {exercise.plannedReps} reps
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-[var(--space-5)]">
        <Input
          label="Rest between sets"
          type="number"
          value={restText}
          onChange={handleRestChange}
          suffix="sec"
        />
        <Button size="lg" fullWidth onClick={handleStart} disabled={starting}>
          {starting ? "Starting…" : "Start"}
        </Button>
      </div>
    </div>
  );
}
