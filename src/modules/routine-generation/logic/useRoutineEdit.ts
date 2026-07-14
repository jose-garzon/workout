"use client";

import { useCallback } from "react";
import { editRoutine } from "../api/ai/client";
import type { AiError } from "../api/ai/errors";
import { getActive, saveActive } from "../api/routineRepo";
import { type EditStatus, useEditStore } from "./editStore";

/**
 * The routine-edit seam (design.md §E). `submit` reads the current active
 * routine itself, sends it + `instruction` to the AI, and on success persists
 * the id-preserved result DIRECTLY (no confirm) — the `useActiveRoutine` live
 * query then re-emits the updated routine. Failures leave the routine untouched
 * and keep the seam in `error` so the editor can stay open for retry.
 */

export type { EditStatus };

export interface RoutineEdit {
  /** idle before/after; editing while in flight; success once applied; error on failure. */
  status: EditStatus;
  /** Human-readable, edit-flavored message for the current error; null unless status==="error". */
  errorMessage: string | null;
  /**
   * Submit a targeted edit. No-op on empty/whitespace or when no routine exists.
   */
  submit: (instruction: string) => Promise<void>;
  /** Return to idle (drop an error / clear after close). */
  reset: () => void;
}

/** Map an `AiError` to edit-flavored copy — the UI renders this string as-is. */
function editErrorMessage(error: AiError): string {
  switch (error.kind) {
    case "offline":
      return "You're offline — editing needs a connection.";
    case "rate-limit":
      return "Too many requests. Wait a moment and try again.";
    default:
      return "Couldn't apply your edit — try again.";
  }
}

export function useRoutineEdit(): RoutineEdit {
  const status = useEditStore((s) => s.status);
  const error = useEditStore((s) => s.error);

  const submit = useCallback(async (instruction: string) => {
    if (instruction.trim() === "") return;
    const current = await getActive();
    if (current === null) return;

    useEditStore.getState().start();
    const outcome = await editRoutine(current, instruction);
    if (outcome.ok) {
      await saveActive(outcome.routine);
      useEditStore.getState().succeed();
    } else {
      useEditStore.getState().fail(outcome.error);
    }
  }, []);

  const reset = useCallback(() => {
    useEditStore.getState().reset();
  }, []);

  return {
    status,
    errorMessage: error ? editErrorMessage(error) : null,
    submit,
    reset,
  };
}
