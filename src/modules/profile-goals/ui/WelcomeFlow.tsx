"use client";

import { useState } from "react";
import { Logo } from "@/shared/ui/components/Logo";
import { AppShell } from "@/shared/ui/layout/AppShell";
import { Button } from "@/shared/ui/primitives/Button";
import { useOnboarding } from "../logic/useOnboarding";
import { OnboardingForm } from "./OnboardingForm";

type Stage = "intro" | "form";

/**
 * Intro (app name + one-line description + single Start) <-> setup-form
 * staging (design.md §3.1: "Welcome vs form staging is UI state, not
 * logic"). Hosts `useOnboarding` for the form stage — the hook is cheap to
 * instantiate and React requires it called unconditionally every render, so
 * it's created here regardless of `stage` and only wired into
 * `OnboardingForm` once the user has started.
 *
 * The screen title doubles as the step heading once the form starts
 * (`stepTitle` from the hook) — one `title-1` per screen either way
 * (design-system.md §2 "Typography usage").
 */
export function WelcomeFlow() {
  const [stage, setStage] = useState<Stage>("intro");
  const onboarding = useOnboarding();

  return (
    <AppShell title={stage === "form" ? onboarding.stepTitle : "workout-pal"}>
      <div key={stage} className="anim-rise flex flex-1 flex-col">
        {stage === "form" ? (
          <OnboardingForm onboarding={onboarding} />
        ) : (
          <IntroPanel onStart={() => setStage("form")} />
        )}
      </div>
    </AppShell>
  );
}

function IntroPanel({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-[var(--space-8)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-7)]">
        {/* Icon only, no wordmark here — the header now carries the "WP"
            mark AND the "workout-pal" h1 for this stage, so the hero
            doesn't need to repeat the wordmark text a third time; it stays
            a big graphic "poster" moment instead. */}
        <Logo size="lg" />
        <div className="flex flex-col gap-[var(--space-3)]">
          <p className="text-title-2 text-center text-text">
            Train harder. Track everything.
          </p>
          <p className="text-body text-center text-text-muted">
            No account, no cloud — every set, rep, and PR stays right here on
            your phone.
          </p>
        </div>
      </div>
      <Button size="lg" fullWidth onClick={onStart}>
        Start
      </Button>
    </div>
  );
}
