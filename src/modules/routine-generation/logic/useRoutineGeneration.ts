"use client";

import { useCallback } from "react";
import { type GenerateContext, generateRoutine } from "../api/ai/client";
import type { AiError } from "../api/ai/errors";
import { saveActive } from "../api/routineRepo";
import type { Routine } from "../types";
import { type GenStatus, useGenerationStore } from "./generationStore";

/**
 * The routine-generation seam (design.md §4, §D3–D5). Drives generation from the
 * shared store: `generate` streams a routine and holds it pending; `confirmSave`
 * is the ONE path that persists (no silent save); `reset` drops a held result
 * (used when the user declines a replacement).
 */

export type { GenStatus };

export interface RoutineGeneration {
  status: GenStatus;
  /** The model's streamed thinking; empty until it arrives. */
  progressMessage: string;
  /** The validated routine, held pending explicit adoption. */
  result: Routine | null;
  error: AiError | null;
  /** POST /api/generate-routine with the prompt + the user's profile context. */
  generate: (prompt: string, ctx: GenerateContext) => Promise<void>;
  /** The ONLY path that persists the held result (design.md §D5). */
  confirmSave: () => Promise<void>;
  /** Drop the held result without persisting (declined replacement). */
  reset: () => void;
}

export function useRoutineGeneration(): RoutineGeneration {
  const status = useGenerationStore((s) => s.status);
  const progressMessage = useGenerationStore((s) => s.progressMessage);
  const result = useGenerationStore((s) => s.result);
  const error = useGenerationStore((s) => s.error);

  const generate = useCallback(async (prompt: string, ctx: GenerateContext) => {
    useGenerationStore.getState().start();
    const outcome = await generateRoutine(prompt, ctx, {
      onThinking: (thinking) =>
        useGenerationStore.getState().setThinking(thinking),
    });
    if (outcome.ok) {
      useGenerationStore.getState().succeed(outcome.routine);
    } else {
      useGenerationStore.getState().fail(outcome.error);
    }
  }, []);

  const confirmSave = useCallback(async () => {
    const held = useGenerationStore.getState().result;
    if (held === null) return;
    await saveActive(held);
    useGenerationStore.getState().reset();
  }, []);

  const reset = useCallback(() => {
    useGenerationStore.getState().reset();
  }, []);

  return {
    status,
    progressMessage,
    result,
    error,
    generate,
    confirmSave,
    reset,
  };
}
