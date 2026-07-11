"use client";

import { useEffect, useState } from "react";

/**
 * Display-only re-render pump (design.md §D3). A coarse ~250ms interval bumps a
 * counter purely to force the seam to re-render; the shown seconds are ALWAYS
 * recomputed from `anchorTs + Date.now()` in render, so this never contributes
 * to the truth — a throttled/backgrounded interval only slows the redraw
 * cadence, never drifts the value.
 *
 * Runs only while a live phase is being shown (`work`/`rest`); it is idle when
 * `phase` is `undefined` (not in-progress) or `exercise-complete` (nothing is
 * counting), and is cleared on unmount.
 */
const TICK_MS = 250;

export function useTimerTick(phase: "work" | "rest" | undefined): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (phase === undefined) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  return tick;
}
