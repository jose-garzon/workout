"use client";

import { useCallback, useReducer } from "react";
import { saveOnboarding } from "../api/profileRepo";
import {
  canAdvanceStep,
  draftToRecords,
  emptyErrors,
  type FieldErrors,
  type FieldName,
  getStepFields,
  initialDraft,
  type OnboardingDraft,
  type OnboardingField,
  STEP_COUNT,
  STEP_TITLES,
  validateStep,
} from "./model";

// Descriptor types are re-exported so `ui/` and the barrel get the whole seam
// from `../logic/useOnboarding` without reaching into `model`.
export type {
  FieldKind,
  FieldName,
  FieldOption,
  OnboardingField,
} from "./model";

export type OnboardingPhase = "editing" | "submitting" | "error";

export interface OnboardingApi {
  // step position (tracker: "Step {stepIndex+1} of {stepCount}")
  stepIndex: number;
  stepCount: number;
  stepTitle: string;

  // the current step's inputs — ALWAYS length 1 or 2
  fields: OnboardingField[];
  setField: (name: FieldName, value: string) => void;

  // navigation
  canGoBack: boolean;
  back: () => void;
  isLastStep: boolean;
  canAdvance: boolean;
  next: () => void;

  // finish (last step only)
  phase: OnboardingPhase;
  submitError: Error | null;
  finish: () => Promise<void>;
}

interface State {
  draft: OnboardingDraft;
  errors: FieldErrors;
  stepIndex: number;
  phase: OnboardingPhase;
  submitError: Error | null;
}

type Action =
  | { type: "setField"; name: FieldName; value: string }
  | { type: "surfaceErrors"; errors: Partial<FieldErrors> }
  | { type: "next" }
  | { type: "back" }
  | { type: "submitting" }
  | { type: "submitFailed"; error: Error };

function initState(): State {
  return {
    draft: { ...initialDraft },
    errors: emptyErrors(),
    stepIndex: 0,
    phase: "editing",
    submitError: null,
  };
}

function withErrors(
  errors: FieldErrors,
  patch: Partial<FieldErrors>,
): FieldErrors {
  return { ...errors, ...patch };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setField": {
      return {
        ...state,
        draft: { ...state.draft, [action.name]: action.value },
        // editing a field clears its surfaced error and leaves any error phase
        errors: withErrors(state.errors, { [action.name]: null }),
        phase: state.phase === "error" ? "editing" : state.phase,
        submitError: state.phase === "error" ? null : state.submitError,
      };
    }
    case "surfaceErrors":
      return { ...state, errors: withErrors(state.errors, action.errors) };
    case "next": {
      const stepErrors = validateStep(state.stepIndex, state.draft);
      const blocked = Object.values(stepErrors).some((e) => e !== null);
      if (blocked) {
        return { ...state, errors: withErrors(state.errors, stepErrors) };
      }
      if (state.stepIndex >= STEP_COUNT - 1) return state; // last step: no-op
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        errors: withErrors(state.errors, stepErrors),
      };
    }
    case "back": {
      if (state.stepIndex === 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1 };
    }
    case "submitting":
      return { ...state, phase: "submitting", submitError: null };
    case "submitFailed":
      return { ...state, phase: "error", submitError: action.error };
  }
}

/**
 * Drives the 3-step onboarding form (design.md §3.1). Owns an ephemeral draft
 * (this reducer — not Zustand, not persisted; discarded when the form unmounts
 * after finish). Exposes the current step as ≤2 field descriptors. Validation
 * runs on `next()`/`finish()`, never per keystroke, and never throws.
 */
export function useOnboarding(): OnboardingApi {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const setField = useCallback((name: FieldName, value: string) => {
    dispatch({ type: "setField", name, value });
  }, []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const next = useCallback(() => dispatch({ type: "next" }), []);

  const finish = useCallback(async () => {
    const lastStep = STEP_COUNT - 1;
    const stepErrors = validateStep(lastStep, state.draft);
    if (Object.values(stepErrors).some((e) => e !== null)) {
      dispatch({ type: "surfaceErrors", errors: stepErrors });
      return;
    }
    dispatch({ type: "submitting" });
    try {
      const { profile, goals } = draftToRecords(state.draft);
      await saveOnboarding(profile, goals);
      // Resolve void. No navigation: the live `useProfile` query re-emits and
      // the FirstRunGate swaps to home; the form may already be unmounting.
    } catch (e) {
      dispatch({ type: "submitFailed", error: e as Error });
    }
  }, [state.draft]);

  return {
    stepIndex: state.stepIndex,
    stepCount: STEP_COUNT,
    stepTitle: STEP_TITLES[state.stepIndex],
    fields: getStepFields(state.stepIndex, state.draft, state.errors),
    setField,
    canGoBack: state.stepIndex > 0,
    back,
    isLastStep: state.stepIndex === STEP_COUNT - 1,
    canAdvance: canAdvanceStep(state.stepIndex, state.draft),
    next,
    phase: state.phase,
    submitError: state.submitError,
    finish,
  };
}
