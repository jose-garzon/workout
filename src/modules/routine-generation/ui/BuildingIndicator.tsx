"use client";

import { useEffect, useState } from "react";

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
 * case). `VERBS[0]` is "Building" on purpose — the very first paint (before
 * the first 5s tick) always reads "Building your routine…", matching the
 * component test's and e2e's literal assertion with no separate initial
 * state to special-case.
 */
const VERBS = [
  "Building",
  "Programming",
  "Forging",
  "Racking",
  "Loading",
  "Calibrating",
  "Periodizing",
  "Dialing in",
  "Warming up",
  "Repping out",
];

const VERB_INTERVAL_MS = 5000;

export function BuildingIndicator() {
  const [verbIndex, setVerbIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setVerbIndex((index) => (index + 1) % VERBS.length);
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
      <p className="text-body-strong">{VERBS[verbIndex]} your routine…</p>
    </div>
  );
}
