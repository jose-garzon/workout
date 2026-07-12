"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
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
  /**
   * Profile context handed to the generator so the routine fits the user (the
   * app composition layer supplies these from the loaded profile/goals — a
   * feature's ui/ may not read another feature). All fold into the AI prompt;
   * none are rendered.
   */
  gender: string;
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: "metric" | "imperial";
  notes?: string;
  /**
   * The consistency week strip (calendar feature), supplied by the app
   * composition layer — a feature's `ui/` may not import another feature
   * (firewall rule 1), so `RoutineHomeScreen` never names `calendar` itself
   * and just renders whatever node it's handed (design.md §1).
   */
  weekStrip?: ReactNode;
}

/** Human, specific copy per AI failure — never a raw technical string. */
const ERROR_MESSAGES: Record<string, string> = {
  offline: "You're offline — building a routine needs a connection.",
  network: "Couldn't reach the routine generator. Try again.",
  "rate-limit": "Too many requests right now. Wait a moment, then retry.",
  parse: "The generator returned something unexpected. Try building again.",
  provider: "The routine generator had a problem. Try again.",
};

/**
 * Always strength-focused, regardless of the user's own saved goal — a
 * concrete, well-formed prompt is the point (a specific split built around
 * the four "big" lifts), not a personalized suggestion.
 */
const EXAMPLE_PROMPT =
  "A 4-day strength program built around squat, bench, deadlift, and overhead press.";

function goalLabel(focus: string): string {
  return focus.charAt(0).toUpperCase() + focus.slice(1);
}

export function RoutineHomeScreen({
  displayName,
  focus,
  daysPerWeek,
  gender,
  age,
  bodyweightKg,
  heightCm,
  unit,
  notes,
  weekStrip,
}: RoutineHomeScreenProps) {
  const { routine: active } = useActiveRoutine();
  const { status, progressMessage, error, generate, confirmSave, reset } =
    useRoutineGeneration();
  // The composer is remounted (via `composerKey`) whenever the example
  // prompt is tapped, so its uncontrolled text field starts pre-filled —
  // see the `Composer.initialValue` doc comment for why a remount, not a
  // controlled prop, is the clean way to do a one-shot external prefill.
  const [prefill, setPrefill] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const thinkingLogRef = useRef<HTMLDivElement>(null);

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
    void generate(prompt, {
      focus,
      daysPerWeek,
      gender,
      age,
      bodyweightKg,
      heightCm,
      unit,
      notes,
    });
  };

  const useExamplePrompt = () => {
    setPrefill(EXAMPLE_PROMPT);
    setComposerKey((key) => key + 1);
  };

  // Keep the thinking log pinned to its newest line as `progressMessage`
  // streams in — without this the log stays scrolled to the top (its
  // initial, empty scroll position) and the latest reasoning sits hidden
  // below the fold. The div itself stays the live region (aria-live is on
  // the element, not this effect) — this only moves the scroll position, a
  // presentation detail AT already gets via the live-region announcement.
  // biome-ignore lint/correctness/useExhaustiveDependencies: progressMessage is the intentional re-run trigger even though the effect body reads it only via the DOM, not directly.
  useEffect(() => {
    const el = thinkingLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progressMessage]);

  const motivation = active
    ? (active.subtitle ?? "Your routine is ready — pick a day to train.")
    : "Tell me how you train and I'll build your split.";

  return (
    <AppShell title="Home">
      {/* Identity block: greeting + goal + motivational line. `AppShell`'s
          own `<h1>{title}</h1>` is `sr-only` (the header shows only the Logo
          + theme toggle), so this `<h2>` is the screen's one VISIBLE
          heading. */}
      <div className="flex flex-col gap-[var(--space-3)]">
        <h2 className="text-title-1">Hey, {name}</h2>
        <span className="text-micro inline-flex h-[var(--space-7)] w-fit items-center bg-accent-wash px-[var(--space-4)] text-accent-text">
          {goalLabel(focus)}
        </span>
        <p className="text-body text-text-muted">{motivation}</p>
      </div>

      {weekStrip}

      {/* This is the only flex-growing region in the layout, so it always
          absorbs exactly the leftover space between the identity block above
          and the composer dock below — on a short state (the empty invite,
          or a routine with one day) that CENTERS the content in the middle
          of that band instead of top-hugging it and leaving one big dead gap
          stacked above the composer (the same fix already applied to
          `OnboardingForm`'s short steps). The composer dock's own position
          is unaffected: it was already flush to the bottom via this sibling
          absorbing the remainder, not via its own margin, so it never moves. */}
      <div className="flex flex-1 flex-col justify-center">
        {active ? (
          <RoutineSummary routine={active} />
        ) : status === "idle" ? (
          <div className="flex flex-col gap-[var(--space-4)]">
            <p className="text-body text-text-muted">
              No routine yet — describe your training below to build one.
            </p>
            <button
              type="button"
              onClick={useExamplePrompt}
              className="anim-press flex flex-col items-start gap-[var(--space-2)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)] text-left transition-colors hover:border-text hover:bg-elevated-surface"
            >
              <span className="text-micro text-accent-text">Try</span>
              <span className="text-body text-text">“{EXAMPLE_PROMPT}”</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-[var(--space-3)] pt-[var(--space-8)]">
        {generating && <BuildingIndicator />}

        {progressMessage !== "" && (
          <div
            ref={thinkingLogRef}
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

        <Composer
          key={composerKey}
          initialValue={prefill}
          focusOnMount={prefill !== ""}
          onSubmit={onSubmit}
          busy={generating}
        />
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
