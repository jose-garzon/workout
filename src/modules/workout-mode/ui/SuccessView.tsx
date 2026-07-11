"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import { ChoiceGroup } from "@/shared/ui/primitives/ChoiceGroup";
import type { WorkoutSessionApi } from "../logic/useWorkoutSession";

export interface SuccessViewProps {
  session: WorkoutSessionApi;
}

const RATING_OPTIONS = ["1", "2", "3", "4", "5"].map((value) => ({
  value,
  label: value,
}));

/**
 * The success view (session-completion spec). The completed session is
 * already durable by the time this renders (design.md §D5/§D10 — the finish
 * sequence writes it before flipping `status` to `'success'`), so nothing
 * here is required: both ratings are optional and save the instant they're
 * picked (no separate submit step), and "back to home" is always enabled,
 * never gated on a rating.
 */
export function SuccessView({ session }: SuccessViewProps) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState("");
  const [fatigue, setFatigue] = useState("");

  const save = (next: { difficulty: string; fatigue: string }) => {
    void session.submitRatings({
      difficulty: next.difficulty ? Number(next.difficulty) : undefined,
      fatigue: next.fatigue ? Number(next.fatigue) : undefined,
    });
  };

  const handleDifficulty = (value: string) => {
    setDifficulty(value);
    save({ difficulty: value, fatigue });
  };

  const handleFatigue = (value: string) => {
    setFatigue(value);
    save({ difficulty, fatigue: value });
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-[var(--space-8)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-6)] text-center">
        <CelebrationGraphic />
        <div className="flex flex-col gap-[var(--space-2)]">
          <h2 className="text-title-1">Workout complete</h2>
          <p className="text-body text-text-muted">
            Nice work — every set is saved.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-[var(--space-6)]">
        <ChoiceGroup
          label="Difficulty (1–5)"
          options={RATING_OPTIONS}
          value={difficulty}
          onChange={handleDifficulty}
        />
        <ChoiceGroup
          label="Fatigue (1–5)"
          options={RATING_OPTIONS}
          value={fatigue}
          onChange={handleFatigue}
        />
        <Button size="lg" fullWidth onClick={() => router.push("/")}>
          Back to home
        </Button>
      </div>
    </div>
  );
}

/**
 * Self-hosted inline SVG, no CDN — a geometric burst in the brand's own
 * mitered/square-cut stroke language (matching `Logo`/`RoutineSummary`'s
 * `ChevronIcon`), not a rounded/curvy stock-illustration confetti clipart.
 * Rendered in neutral `text-text` ink, deliberately NOT `accent`: the
 * back-home `Button` below is this screen's one primary action and already
 * spends the screen's single full-saturation accent-fill budget
 * (design-system.md §2 "Color usage").
 */
function CelebrationGraphic() {
  const rays = Array.from({ length: 8 }, (_, index) => index * 45);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      width="120"
      height="120"
      fill="none"
      className="text-text"
    >
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="butt">
        {rays.map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 60 + Math.cos(rad) * 30;
          const y1 = 60 + Math.sin(rad) * 30;
          const x2 = 60 + Math.cos(rad) * 54;
          const y2 = 60 + Math.sin(rad) * 54;
          return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <rect x="40" y="40" width="40" height="40" fill="currentColor" />
    </svg>
  );
}
