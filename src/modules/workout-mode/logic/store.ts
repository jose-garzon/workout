"use client";

import { create } from "zustand";
import type { SessionStatus, WorkoutSession } from "../types";

/**
 * workout-mode hot state (design.md §D3/§D4). Holds the in-flight session, the
 * screen `status`, and (after a finish) the completed record's id for ratings.
 * TICK-FREE: it mutates only on transitions — every displayed second is derived
 * from `session.anchorTs + Date.now()` at render, never counted here. The
 * display interval lives in `useTimerTick`, not in this store.
 */
interface WorkoutStore {
  status: SessionStatus;
  /** The current session (a non-persisted scaffold in `overview`, the live row otherwise). */
  session: WorkoutSession | null;
  /** The completed session's id, held after a finish so ratings can target it (§D5). */
  completedId: string | null;
  setStatus: (status: SessionStatus) => void;
  setSession: (session: WorkoutSession | null) => void;
  setCompletedId: (id: string | null) => void;
  reset: () => void;
}

const INITIAL = {
  status: "loading" as SessionStatus,
  session: null,
  completedId: null,
};

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  ...INITIAL,
  setStatus: (status) => set({ status }),
  setSession: (session) => set({ session }),
  setCompletedId: (completedId) => set({ completedId }),
  reset: () => set({ ...INITIAL }),
}));
