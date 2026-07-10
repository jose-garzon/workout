"use client";

import { create } from "zustand";
import type { AiError } from "../api/ai/errors";
import type { Routine } from "../types";

/**
 * In-flight generation state (design.md §D4). Three separate UI regions — the
 * building indicator, the thinking summary, and the held-result → summary —
 * read this shared transient state across the dashboard subtree, so it lives in
 * a store rather than prop-drilled local state. `status` extends its frozen
 * union: `idle → generating → (ready | error)`, where `ready` means "a validated
 * routine is held, pending adoption" (design.md §D5).
 */
export type GenStatus = "idle" | "generating" | "error" | "ready";

interface GenerationState {
  status: GenStatus;
  /** The model's streamed thinking, accumulated (design.md §D3). */
  progressMessage: string;
  /** The validated routine, held pending explicit adoption (design.md §D5). */
  result: Routine | null;
  error: AiError | null;
  start: () => void;
  setThinking: (thinking: string) => void;
  succeed: (routine: Routine) => void;
  fail: (error: AiError) => void;
  reset: () => void;
}

const IDLE = {
  status: "idle" as GenStatus,
  progressMessage: "",
  result: null,
  error: null,
};

export const useGenerationStore = create<GenerationState>((set) => ({
  ...IDLE,
  start: () => set({ ...IDLE, status: "generating" }),
  setThinking: (thinking) => set({ progressMessage: thinking }),
  succeed: (routine) => set({ status: "ready", result: routine, error: null }),
  fail: (error) => set({ status: "error", error }),
  reset: () => set({ ...IDLE }),
}));
