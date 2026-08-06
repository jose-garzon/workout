"use client";

import { type TranslationKey, useTranslation } from "@/shared/i18n";

export interface GoalBadgeProps {
  focus: string;
}

/** The four `TrainingFocus` values (design.md §3.1) → their badge key. */
const GOAL_LABEL_KEYS: Record<string, TranslationKey> = {
  strength: "home.goal.strength",
  hypertrophy: "home.goal.hypertrophy",
  endurance: "home.goal.endurance",
  general: "home.goal.general",
};

/**
 * The training-focus chip (design.md D12) — extracted from
 * `RoutineHomeScreen`'s identity block so the profile page's "same badge" is
 * one component, not a second copy that can drift. The accent-wash chip is
 * one of the app's two intentional exceptions to "one full-saturation accent
 * per screen" (design-system.md §2 "Color usage") — it is a status mark, not
 * a competing call to action.
 */
export function GoalBadge({ focus }: GoalBadgeProps) {
  const { t } = useTranslation();
  const goalKey = GOAL_LABEL_KEYS[focus];

  return (
    <span className="text-micro inline-flex h-[var(--space-7)] w-fit items-center bg-accent-wash px-[var(--space-4)] text-accent-text">
      {goalKey ? t(goalKey) : focus}
    </span>
  );
}
