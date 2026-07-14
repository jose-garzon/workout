"use client";

import { useEffect, useState } from "react";

/**
 * The in-flight edit indicator (design.md §F) — `BuildingIndicator`'s
 * edit-flavored counterpart, shown inside the floating editor while a
 * submitted edit is applying. Same bounded bar-loop + cycling-verb shape, a
 * distinct verb set so it never reads as "still building" — `VERBS[0]` is
 * "Improving" on purpose, matching the first paint to the e2e's literal
 * assertion with no separate initial state to special-case.
 */
const VERBS = [
  "Improving",
  "Enhancing",
  "Powering",
  "Tuning",
  "Refining",
  "Reworking",
  "Dialing in",
  "Adjusting",
];

const VERB_INTERVAL_MS = 5000;

export function EditIndicator() {
  const [verbIndex, setVerbIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setVerbIndex((index) => (index + 1) % VERBS.length);
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
      <p className="text-body-strong">{VERBS[verbIndex]} your routine…</p>
    </div>
  );
}
