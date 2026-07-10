"use client";

/**
 * The rest timer — the heartbeat. Exact, never smoothed; it must survive tab
 * backgrounding/refresh (implemented from timestamps, not tick counting, in the
 * feature change). Signature per design.md §4.
 *
 * Foundation stub — signature only; the timestamp-based engine lands in the
 * workout-mode feature change (D).
 */
export interface RestTimer {
  /** Exact integer; updates the instant it changes. */
  secondsLeft: number;
  /** For the ring's fill fraction. */
  totalSeconds: number;
  running: boolean;
  skip: () => void;
  restart: () => void;
  exit: () => void;
}

export function useRestTimer(): RestTimer {
  throw new Error(
    "useRestTimer is implemented in the workout-mode feature change (D).",
  );
}
