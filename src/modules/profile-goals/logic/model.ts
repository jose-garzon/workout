/**
 * profile-goals — PURE onboarding domain model (design.md §3.1, §2.3, D4/D7).
 *
 * No React, no Dexie, no side effects. Owns: the 4-step / ≤2-field layout, the
 * unit-aware field descriptors, per-field validation, and lb→kg / in→cm
 * canonicalization. `useOnboarding` composes these; `ui/` renders their output
 * and never re-implements a rule. Descriptor types live here (the pure leaf) so
 * `model` and `useOnboarding` form a single acyclic edge (useOnboarding → model).
 */

import type {
  Gender,
  Goals,
  MeasurementUnit,
  Profile,
  TrainingFocus,
} from "../types";

// --- Seam descriptor types (re-exported via useOnboarding + index.ts) --------

export type FieldName =
  | "displayName"
  | "gender"
  | "age"
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
  gender: string;
  age: string;
  unit: string;
  bodyweight: string;
  height: string;
  focus: string;
  daysPerWeek: string;
}

export type FieldErrors = Record<FieldName, string | null>;

// --- Static layout -----------------------------------------------------------

export const STEP_COUNT = 4;

const STEP_FIELDS: readonly (readonly FieldName[])[] = [
  ["displayName", "gender"],
  ["age", "unit"],
  ["bodyweight", "height"],
  ["focus", "daysPerWeek"],
];

export const STEP_TITLES: readonly string[] = [
  "About you",
  "A few basics",
  "Your body",
  "Your training",
];

const GENDER_OPTIONS: FieldOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
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

const GENDERS: readonly Gender[] = ["male", "female", "other"];

// --- Draft helpers -----------------------------------------------------------

export const initialDraft: OnboardingDraft = {
  displayName: "",
  gender: "",
  age: "",
  unit: "metric",
  bodyweight: "",
  height: "",
  focus: "",
  daysPerWeek: "",
};

export function emptyErrors(): FieldErrors {
  return {
    displayName: null,
    gender: null,
    age: null,
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
    case "gender":
      return "Gender";
    case "age":
      return "Age";
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

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
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
    case "gender":
      return {
        ...base,
        kind: "choice",
        required: true,
        options: GENDER_OPTIONS,
      };
    case "age":
      return {
        ...base,
        kind: "number",
        required: true,
        min: 13,
        max: 120,
        step: 1,
        placeholder: "e.g. 28",
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
    case "gender":
      return isGender(raw) ? null : "Choose an option";
    case "age": {
      if (raw.trim() === "") return "Enter your age";
      const n = Number(raw);
      return Number.isInteger(n) && n >= 13 && n <= 120
        ? null
        : "Enter an age from 13 to 120";
    }
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

/** Kilograms → pounds, rounded to a whole lb (the imperial weight step is 1). */
export function kgToLb(kg: number): number {
  return Math.round(kg / 0.45359237);
}

/** Centimetres → inches, rounded to a whole in (the height step is 1). */
export function cmToIn(cm: number): number {
  return Math.round(cm / 2.54);
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
    gender: draft.gender as Gender,
    age: Number(draft.age),
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

// --- Inverse: seed an editable draft from saved records (edit-profile D4) -----

/** All 8 field names in onboarding order — the edit drawer renders every one. */
export const ALL_FIELD_NAMES: readonly FieldName[] = [
  "displayName",
  "gender",
  "age",
  "unit",
  "bodyweight",
  "height",
  "focus",
  "daysPerWeek",
];

/** '' for undefined/blank; otherwise the number as a string. */
function numToDraft(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

/**
 * Inverse of `draftToRecords`: seed a display-unit draft from saved records so
 * the editor shows the user's own values. Metric weight/height pass through
 * (`round1`); imperial rounds SI back to whole lb/in. Undefined `displayName`,
 * `heightCm`, and (pre-2026-07-10) `gender`/`age` seed as '' — the drawer shows
 * them empty and Save blocks until filled (the editor is the backfill path).
 */
export function recordsToDraft(
  profile: Profile,
  goals: Goals | null,
): OnboardingDraft {
  const imperial = profile.unit === "imperial";

  const bodyweight =
    profile.bodyweightKg === undefined
      ? ""
      : String(
          imperial
            ? kgToLb(profile.bodyweightKg)
            : round1(profile.bodyweightKg),
        );

  const height =
    profile.heightCm === undefined
      ? ""
      : String(imperial ? cmToIn(profile.heightCm) : round1(profile.heightCm));

  return {
    displayName: profile.displayName ?? "",
    gender: (profile.gender as string | undefined) ?? "",
    age: numToDraft(profile.age),
    unit: profile.unit,
    bodyweight,
    height,
    focus: (goals?.focus as string | undefined) ?? "",
    daysPerWeek: numToDraft(goals?.daysPerWeek),
  };
}

/** Validate all 8 fields at once (the edit drawer has no steps). */
export function validateAll(draft: OnboardingDraft): FieldErrors {
  const errors = emptyErrors();
  for (const name of ALL_FIELD_NAMES) {
    errors[name] = validateField(name, draft);
  }
  return errors;
}

/** Convert one display string; blank stays blank, non-numeric stays as-is. */
function convertValue(raw: string, convert: (n: number) => number): string {
  if (raw.trim() === "") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? String(convert(n)) : raw;
}

/**
 * Re-express a draft's bodyweight/height in `nextUnit` (edit-profile revision).
 * Toggling the unit radio must convert the shown numbers, not just relabel them,
 * or Save would reinterpret the same digits (80 kg → "80 lb"). Direction is read
 * from the draft's CURRENT `unit`, so pass the pre-toggle draft. Only bodyweight
 * and height change; every other field passes through. Imperial shows whole
 * lb/in; metric shows 0.1 kg/cm — matching `recordsToDraft`.
 */
export function convertDraftUnits(
  draft: OnboardingDraft,
  nextUnit: string,
): OnboardingDraft {
  if (nextUnit === draft.unit) return { ...draft, unit: nextUnit };
  const toImperial = nextUnit === "imperial";
  const weight = toImperial ? kgToLb : lbToKg;
  const length = toImperial ? cmToIn : inToCm;
  return {
    ...draft,
    unit: nextUnit,
    bodyweight: convertValue(draft.bodyweight, weight),
    height: convertValue(draft.height, length),
  };
}
