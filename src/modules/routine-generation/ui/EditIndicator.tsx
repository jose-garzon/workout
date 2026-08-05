"use client";

import { useEffect, useState } from "react";
import { type TranslationKey, useTranslation } from "@/shared/i18n";

/**
 * The in-flight edit indicator (design.md §F) — `BuildingIndicator`'s
 * edit-flavored counterpart, shown inside the floating editor while a
 * submitted edit is applying. Same bounded bar-loop + cycling-verb shape, a
 * distinct verb set so it never reads as "still building" — `VERB_KEYS[0]`
 * is "Improving" on purpose, matching the first paint to the e2e's literal
 * assertion with no separate initial state to special-case.
 */
const VERB_KEYS: TranslationKey[] = [
  "routine.editIndicator.verb.improving",
  "routine.editIndicator.verb.enhancing",
  "routine.editIndicator.verb.powering",
  "routine.editIndicator.verb.tuning",
  "routine.editIndicator.verb.refining",
  "routine.editIndicator.verb.reworking",
  "routine.editIndicator.verb.dialingIn",
  "routine.editIndicator.verb.adjusting",
];

const VERB_INTERVAL_MS = 5000;

export function EditIndicator() {
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
      className="anim-fade flex items-center gap-[var(--space-3)]"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="anim-build-bars flex h-[var(--space-5)] items-end gap-[var(--space-1)]"
      >
        <span
          className="block w-[var(--space-1)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-1)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-1)] bg-accent"
          style={{ height: "100%" }}
        />
      </div>
      <p className="text-body-strong">
        {t("routine.indicator.template", { verb: t(VERB_KEYS[verbIndex]) })}
      </p>
    </div>
  );
}
