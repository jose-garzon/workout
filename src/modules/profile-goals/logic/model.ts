/**
 * profile-goals — PURE onboarding domain model (design.md §3.1, §2.3, D4/D7).
 *
 * No React, no Dexie, no side effects. Owns: the 3-step / ≤2-field layout, the
 * unit-aware field descriptors, per-field validation, and lb→kg / in→cm
 * canonicalization. `useOnboarding` composes these; `ui/` renders their output
 * and never re-implements a rule. Descriptor types live here (the pure leaf) so
 * `model` and `useOnboarding` form a single acyclic edge (useOnboarding → model).
 */

import type { Goals, MeasurementUnit, Profile, TrainingFocus } from "../types";

// --- Seam descriptor types (re-exported via useOnboarding + index.ts) --------

export type FieldName =
  | "displayName"
  | "unit"
  | "bodyweight"
  | "height"
  | "focus"
  | "daysPerWeek";

export type FieldKind = "text" | "number" | "choice";

export interface FieldOption {
  value: string;
  label: string;
}

export interface OnboardingField {
  name: FieldName;
  kind: FieldKind;
  /** UNIT-AWARE, resolved in logic: "Bodyweight (kg)" vs "(lb)". */
  label: string;
  /** Controlled value; '' === empty. Numbers are carried as strings. */
  value: string;
  required: boolean;
  /** null until a blocked advance surfaces it. */
  error: string | null;
  placeholder?: string;
  // kind === 'number':
  min?: number;
  max?: number;
  step?: number;
  suffix?: string; // 'kg' | 'lb' | 'cm' | 'in'
  // kind === 'choice':
  options?: FieldOption[];
}

/** The ephemeral form draft — every field carried as a string. */
export interface OnboardingDraft {
  displayName: string;
  unit: string;
  bodyweight: string;
  height: string;
  focus: string;
  daysPerWeek: string;
}

export type FieldErrors = Record<FieldName, string | null>;

// --- Static layout -----------------------------------------------------------

export const STEP_COUNT = 3;

const STEP_FIELDS: readonly (readonly FieldName[])[] = [
  ["displayName", "unit"],
  ["bodyweight", "height"],
  ["focus", "daysPerWeek"],
];

export const STEP_TITLES: readonly string[] = [
  "About you",
  "Your body",
  "Your training",
];

const UNIT_OPTIONS: FieldOption[] = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];

const FOCUS_OPTIONS: FieldOption[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "endurance", label: "Endurance" },
  { value: "general", label: "General fitness" },
];

const DAYS_OPTIONS: FieldOption[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n),
  label: String(n),
}));

const FOCI: readonly TrainingFocus[] = [
  "strength",
  "hypertrophy",
  "endurance",
  "general",
];

// --- Draft helpers -----------------------------------------------------------

export const initialDraft: OnboardingDraft = {
  displayName: "",
  unit: "metric",
  bodyweight: "",
  height: "",
  focus: "",
  daysPerWeek: "",
};

export function emptyErrors(): FieldErrors {
  return {
    displayName: null,
    unit: null,
    bodyweight: null,
    height: null,
    focus: null,
    daysPerWeek: null,
  };
}

/** Field names for a step (always 1–2), used by the reducer + descriptors. */
export function stepFieldNames(stepIndex: number): readonly FieldName[] {
  return STEP_FIELDS[stepIndex] ?? [];
}

// --- Unit-aware labels -------------------------------------------------------

function isMetric(unit: string): boolean {
  return unit !== "imperial";
}

function weightUnit(unit: string): "kg" | "lb" {
  return isMetric(unit) ? "kg" : "lb";
}

function lengthUnit(unit: string): "cm" | "in" {
  return isMetric(unit) ? "cm" : "in";
}

function fieldLabel(name: FieldName, unit: string): string {
  switch (name) {
    case "displayName":
      return "Your name";
    case "unit":
      return "Units";
    case "bodyweight":
      return `Bodyweight (${weightUnit(unit)})`;
    case "height":
      return `Height (${lengthUnit(unit)})`;
    case "focus":
      return "Primary goal";
    case "daysPerWeek":
      return "Training days per week";
  }
}

// --- Field descriptors -------------------------------------------------------

function isTrainingFocus(value: string): value is TrainingFocus {
  return (FOCI as readonly string[]).includes(value);
}

/** Build a single unit-aware, error-carrying descriptor for a field. */
export function describeField(
  name: FieldName,
  draft: OnboardingDraft,
  error: string | null,
): OnboardingField {
  const unit = draft.unit;
  const base = {
    name,
    label: fieldLabel(name, unit),
    value: draft[name],
    error,
  };
  switch (name) {
    case "displayName":
      return {
        ...base,
        kind: "text",
        required: true,
        placeholder: "e.g. Alex",
      };
    case "unit":
      return { ...base, kind: "choice", required: true, options: UNIT_OPTIONS };
    case "bodyweight":
      return {
        ...base,
        kind: "number",
        required: true,
        min: 1,
        step: isMetric(unit) ? 0.5 : 1,
        suffix: weightUnit(unit),
      };
    case "height":
      return {
        ...base,
        kind: "number",
        required: false,
        min: 1,
        step: 1,
        suffix: lengthUnit(unit),
      };
    case "focus":
      return {
        ...base,
        kind: "choice",
        required: true,
        options: FOCUS_OPTIONS,
      };
    case "daysPerWeek":
      return { ...base, kind: "choice", required: true, options: DAYS_OPTIONS };
  }
}

/** The current step's ≤2 descriptors, with any surfaced errors applied. */
export function getStepFields(
  stepIndex: number,
  draft: OnboardingDraft,
  errors: FieldErrors,
): OnboardingField[] {
  return stepFieldNames(stepIndex).map((name) =>
    describeField(name, draft, errors[name]),
  );
}

// --- Validation --------------------------------------------------------------

/**
 * Validate one field against the locked rules. Returns a user-facing message or
 * null. `height` is the sole optional field and never blocks when blank.
 */
export function validateField(
  name: FieldName,
  draft: OnboardingDraft,
): string | null {
  const raw = draft[name];
  switch (name) {
    case "displayName":
      return raw.trim() === "" ? "Enter your name" : null;
    case "unit":
      return raw === "metric" || raw === "imperial" ? null : "Choose a unit";
    case "bodyweight": {
      if (raw.trim() === "") return "Enter your bodyweight";
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? null : "Enter a valid bodyweight";
    }
    case "height": {
      if (raw.trim() === "") return null; // optional — blank never blocks
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? null : "Enter a valid height";
    }
    case "focus":
      return isTrainingFocus(raw) ? null : "Choose a goal";
    case "daysPerWeek": {
      if (raw.trim() === "") return "Choose your training days";
      const n = Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= 7
        ? null
        : "Choose 1 to 7 days";
    }
  }
}

/** Validate every field on a step; keys are exactly that step's fields. */
export function validateStep(
  stepIndex: number,
  draft: OnboardingDraft,
): Partial<FieldErrors> {
  const errors: Partial<FieldErrors> = {};
  for (const name of stepFieldNames(stepIndex)) {
    errors[name] = validateField(name, draft);
  }
  return errors;
}

/** True when every required field on the step passes validation. */
export function canAdvanceStep(
  stepIndex: number,
  draft: OnboardingDraft,
): boolean {
  return stepFieldNames(stepIndex).every(
    (name) => validateField(name, draft) === null,
  );
}

// --- Unit conversion (canonicalize to SI before write) -----------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Pounds → kilograms, rounded to 0.1 kg. */
export function lbToKg(lb: number): number {
  return round1(lb * 0.45359237);
}

/** Inches → centimetres, rounded to 0.1 cm. */
export function inToCm(inch: number): number {
  return round1(inch * 2.54);
}

/**
 * Convert a (validated) draft to canonical domain records for persistence.
 * Bodyweight/height are stored as SI (kg/cm); `unit` is kept as a display
 * preference. `heightCm` is omitted when height was left blank.
 */
export function draftToRecords(draft: OnboardingDraft): {
  profile: Profile;
  goals: Goals;
} {
  const unit = draft.unit as MeasurementUnit;
  const imperial = unit === "imperial";

  const bw = Number(draft.bodyweight);
  const profile: Profile = {
    id: "me",
    displayName: draft.displayName.trim(),
    unit,
    bodyweightKg: imperial ? lbToKg(bw) : round1(bw),
  };
  if (draft.height.trim() !== "") {
    const h = Number(draft.height);
    profile.heightCm = imperial ? inToCm(h) : round1(h);
  }

  const goals: Goals = {
    id: "me",
    focus: draft.focus as TrainingFocus,
    daysPerWeek: Number(draft.daysPerWeek),
  };

  return { profile, goals };
}
