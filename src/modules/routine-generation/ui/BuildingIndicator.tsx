"use client";

import { useEffect, useState } from "react";
import { type TranslationKey, useTranslation } from "@/shared/i18n";

/**
 * The in-flight building indicator (spec `routine-generation`) — shown between
 * the identity header and the composer while the model works. Three bars that
 * rise and fall (the sanctioned generation-only loop, design-system.md §"four
 * states"), paired with a specific progressing message — never an anonymous
 * spinner. Freezes to a static resting state under `prefers-reduced-motion`.
 *
 * The verb cycles every 5s through a small set of gym-flavored synonyms for
 * "building" — a text swap, not a transform/opacity animation, so it needs no
 * `prefers-reduced-motion` handling of its own (nothing here moves or fades,
 * the words just change; the bars above it already handle the reduced-motion
 * case). `VERB_KEYS[0]` is "Building" on purpose — the very first paint
 * (before the first 5s tick) always reads "Building your routine…" (Spanish:
 * "Creando tu rutina…", pinned by the Spanish e2e spec), matching the
 * component test's and e2e's literal assertion with no separate initial
 * state to special-case.
 */
const VERB_KEYS: TranslationKey[] = [
  "routine.building.verb.building",
  "routine.building.verb.programming",
  "routine.building.verb.forging",
  "routine.building.verb.racking",
  "routine.building.verb.loading",
  "routine.building.verb.calibrating",
  "routine.building.verb.periodizing",
  "routine.building.verb.dialingIn",
  "routine.building.verb.warmingUp",
  "routine.building.verb.reppingOut",
];

const VERB_INTERVAL_MS = 5000;

export function BuildingIndicator() {
  const { t } = useTranslation();
  const [verbIndex, setVerbIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setVerbIndex((index) => (index + 1) % VERB_KEYS.length);
    }, VERB_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="anim-fade flex items-center gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)]"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="anim-build-bars flex h-[var(--space-6)] items-end gap-[var(--space-1)]"
      >
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
      </div>
      <p className="text-body-strong">
        {t("routine.indicator.template", { verb: t(VERB_KEYS[verbIndex]) })}
      </p>
    </div>
  );
}
