"use client";

import { useEffect } from "react";
import { AppShell } from "@/shared/ui/layout/AppShell";
import { Button } from "@/shared/ui/primitives/Button";
import { useActiveRoutine } from "../logic/useActiveRoutine";
import { useRoutineGeneration } from "../logic/useRoutineGeneration";
import { BuildingIndicator } from "./BuildingIndicator";
import { Composer } from "./Composer";
import { RoutineSummary } from "./RoutineSummary";

/**
 * Home (design.md §D1) — the routine dashboard + AI composer. Owned by
 * routine-generation; the user's identity (name, goal, and the profile context
 * the generator needs) arrives as props from the app composition layer, because
 * a feature's `ui/` may not import another feature (firewall rule 1).
 *
 * Adopt-vs-replace (§D5): the FIRST routine adopts frictionlessly — an effect
 * calls `confirmSave()` the moment a result is held and no routine yet exists.
 * When a routine already exists, a held result instead surfaces a
 * replace-confirmation; `confirmSave()` runs only on explicit confirm.
 */
export interface RoutineHomeScreenProps {
  displayName?: string;
  /** The user's training goal (drives the badge + the generator). */
  focus: string;
  daysPerWeek: number;
  bodyweightKg?: number;
  unit: "metric" | "imperial";
}

/** Human, specific copy per AI failure — never a raw technical string. */
const ERROR_MESSAGES: Record<string, string> = {
  offline: "You're offline — building a routine needs a connection.",
  network: "Couldn't reach the routine generator. Try again.",
  "rate-limit": "Too many requests right now. Wait a moment, then retry.",
  parse: "The generator returned something unexpected. Try building again.",
  provider: "The routine generator had a problem. Try again.",
};

function goalLabel(focus: string): string {
  return focus.charAt(0).toUpperCase() + focus.slice(1);
}

export function RoutineHomeScreen({
  displayName,
  focus,
  daysPerWeek,
  bodyweightKg,
  unit,
}: RoutineHomeScreenProps) {
  const { routine: active } = useActiveRoutine();
  const { status, progressMessage, error, generate, confirmSave, reset } =
    useRoutineGeneration();

  const name = displayName?.trim() || "there";
  const generating = status === "generating";
  const awaitingReplace = status === "ready" && active !== null;

  // First routine adopts frictionlessly (§D5): once a result is held and no
  // routine exists yet, persist it immediately — no extra confirm step.
  useEffect(() => {
    if (status === "ready" && active === null) {
      void confirmSave();
    }
  }, [status, active, confirmSave]);

  const onSubmit = (prompt: string) => {
    void generate(prompt, { focus, daysPerWeek, bodyweightKg, unit });
  };

  const motivation = active
    ? (active.subtitle ?? "Your routine is ready — pick a day to train.")
    : "Tell me how you train and I'll build your split.";

  return (
    <AppShell title={`Hey, ${name}`}>
      <div className="flex flex-col gap-[var(--space-4)]">
        <span className="text-micro inline-flex h-[var(--space-8)] w-fit items-center bg-accent-wash px-[var(--space-3)] text-accent-text">
          {goalLabel(focus)}
        </span>
        <p className="text-body text-text-muted">{motivation}</p>
      </div>

      {active ? (
        <RoutineSummary routine={active} />
      ) : status === "idle" ? (
        <p className="text-body text-text-muted">
          No routine yet — describe your training below to build one.
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-[var(--space-3)] pt-[var(--space-6)]">
        {generating && <BuildingIndicator />}

        {progressMessage !== "" && (
          <div
            role="log"
            aria-live="polite"
            aria-label="What the generator is thinking"
            className="max-h-[var(--space-11)] overflow-y-auto border-l-2 border-border pl-[var(--space-4)]"
          >
            <p className="text-caption text-text-muted">{progressMessage}</p>
          </div>
        )}

        {status === "error" && error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-[var(--space-4)] border border-danger px-[var(--space-4)] py-[var(--space-3)]"
          >
            <p className="text-caption text-danger-text">
              {ERROR_MESSAGES[error.kind] ?? ERROR_MESSAGES.provider}
            </p>
            <Button size="sm" variant="secondary" onClick={reset}>
              Dismiss
            </Button>
          </div>
        )}

        <Composer onSubmit={onSubmit} busy={generating} />
      </div>

      {awaitingReplace && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-[rgba(0,0,0,0.6)] p-[var(--space-5)] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-title"
        >
          <div className="anim-rise flex w-full max-w-[520px] flex-col gap-[var(--space-5)] border border-border bg-elevated-surface p-[var(--space-6)]">
            <h2 id="replace-title" className="text-title-2">
              Replace your routine?
            </h2>
            <p className="text-body text-text-muted">
              You already have an active routine. Building this new one will
              discard the current one — this can't be undone.
            </p>
            <div className="flex flex-col gap-[var(--space-3)]">
              <Button onClick={() => void confirmSave()}>
                Replace routine
              </Button>
              <Button variant="secondary" onClick={reset}>
                Keep current
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
