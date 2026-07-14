"use client";

import { create } from "zustand";
import type { AiError } from "../api/ai/errors";

/**
 * In-flight edit state (design.md §D). Kept separate from `generationStore`: an
 * edit direct-applies (no held-result gate) and must not disturb the build-only
 * UI that keys off the generation status. `idle → editing → (success | error)`.
 */
export type EditStatus = "idle" | "editing" | "success" | "error";

interface EditState {
  status: EditStatus;
  error: AiError | null;
  start: () => void;
  succeed: () => void;
  fail: (error: AiError) => void;
  reset: () => void;
}

export const useEditStore = create<EditState>((set) => ({
  status: "idle",
  error: null,
  start: () => set({ status: "editing", error: null }),
  succeed: () => set({ status: "success", error: null }),
  fail: (error) => set({ status: "error", error }),
  reset: () => set({ status: "idle", error: null }),
}));
