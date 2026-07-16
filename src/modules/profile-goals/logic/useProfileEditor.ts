"use client";

import { useCallback, useReducer } from "react";
import { saveProfileEdits } from "../api/profileRepo";
import type { Goals, Profile } from "../types";
import {
  ALL_FIELD_NAMES,
  convertDraftUnits,
  describeField,
  draftToRecords,
  emptyErrors,
  type FieldErrors,
  type FieldName,
  type OnboardingDraft,
  type OnboardingField,
  recordsToDraft,
  validateAll,
} from "./model";

export type ProfileEditorPhase = "editing" | "saving" | "error";

export interface ProfileEditorApi {
  /** All 8 descriptors, unit-aware + error-carrying, via describeField. */
  fields: OnboardingField[];
  setField: (name: FieldName, value: string) => void;
  /** Draft differs from the seeded (saved) values. */
  dirty: boolean;
  phase: ProfileEditorPhase;
  saveError: Error | null;
  /** All fields currently valid (convenience; save() re-guards). */
  canSave: boolean;
  /**
   * Validate all 8. If any error, surface it and resolve false (no write).
   * Otherwise persist via saveProfileEdits and resolve true.
   */
  save: () => Promise<boolean>;
  /** Re-seed the draft from the saved records — called on each open + after discard. */
  reset: () => void;
}

interface State {
  /** The seeded (saved) draft — the baseline `dirty` compares against. */
  seed: OnboardingDraft;
  draft: OnboardingDraft;
  errors: FieldErrors;
  phase: ProfileEditorPhase;
  saveError: Error | null;
}

type Action =
  | { type: "setField"; name: FieldName; value: string }
  | { type: "surfaceErrors"; errors: FieldErrors }
  | { type: "reset"; seed: OnboardingDraft }
  | { type: "saving" }
  | { type: "saveFailed"; error: Error };

function seededState(seed: OnboardingDraft): State {
  return {
    seed,
    draft: seed,
    errors: emptyErrors(),
    phase: "editing",
    saveError: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setField": {
      // Toggling the unit converts the bodyweight/height numbers too, so the
      // shown values keep matching the new label (else Save reinterprets the
      // same digits, e.g. 80 kg → 80 lb). Pass the pre-toggle draft so
      // convertDraftUnits reads the old unit for direction.
      const draft =
        action.name === "unit" && action.value !== state.draft.unit
          ? convertDraftUnits(state.draft, action.value)
          : { ...state.draft, [action.name]: action.value };
      return {
        ...state,
        draft,
        // editing a field clears its surfaced error and leaves any error phase
        errors: { ...state.errors, [action.name]: null },
        phase: state.phase === "error" ? "editing" : state.phase,
        saveError: state.phase === "error" ? null : state.saveError,
      };
    }
    case "surfaceErrors":
      return { ...state, errors: action.errors, phase: "editing" };
    case "reset":
      return seededState(action.seed);
    case "saving":
      return { ...state, phase: "saving", saveError: null };
    case "saveFailed":
      return { ...state, phase: "error", saveError: action.error };
  }
}

function draftsEqual(a: OnboardingDraft, b: OnboardingDraft): boolean {
  return ALL_FIELD_NAMES.every((name) => a[name] === b[name]);
}

/**
 * Drives the post-onboarding edit drawer (edit-profile D1). Single-panel: all 8
 * fields at once, seeded from the saved records via `recordsToDraft`. Open/close
 * is UI-local (owned by the mount layer), not here. Validation runs on `save()`,
 * never per keystroke. The records are passed in (not read via `useProfile`) so
 * the hook stays pure/testable.
 */
export function useProfileEditor(
  profile: Profile,
  goals: Goals | null,
): ProfileEditorApi {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    seededState(recordsToDraft(profile, goals)),
  );

  const liveErrors = validateAll(state.draft);

  const setField = useCallback((name: FieldName, value: string) => {
    dispatch({ type: "setField", name, value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset", seed: recordsToDraft(profile, goals) });
  }, [profile, goals]);

  const save = useCallback(async () => {
    const errors = validateAll(state.draft);
    if (ALL_FIELD_NAMES.some((name) => errors[name] !== null)) {
      dispatch({ type: "surfaceErrors", errors });
      return false;
    }
    dispatch({ type: "saving" });
    try {
      const { profile: nextProfile, goals: nextGoals } = draftToRecords(
        state.draft,
      );
      await saveProfileEdits(nextProfile, nextGoals);
      return true;
    } catch (e) {
      dispatch({ type: "saveFailed", error: e as Error });
      return false;
    }
  }, [state.draft]);

  return {
    fields: ALL_FIELD_NAMES.map((name) =>
      describeField(name, state.draft, state.errors[name]),
    ),
    setField,
    dirty: !draftsEqual(state.draft, state.seed),
    phase: state.phase,
    saveError: state.saveError,
    canSave: ALL_FIELD_NAMES.every((name) => liveErrors[name] === null),
    save,
    reset,
  };
}
