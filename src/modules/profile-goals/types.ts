/**
 * profile-goals (Feature A) — owned domain types. Leaf module: imports nothing.
 */

export type MeasurementUnit = "metric" | "imperial";

export type Gender = "male" | "female" | "other";

/** The user's personal data. Singleton — `id` is always "me". */
export interface Profile {
  id: string;
  displayName?: string;
  gender: Gender;
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: MeasurementUnit;
}

export type TrainingFocus =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "general";

/** The user's training goals. Singleton — `id` is always "me". */
export interface Goals {
  id: string;
  focus: TrainingFocus;
  /** Target training days per week — drives the calendar's weekly target. */
  daysPerWeek: number;
  notes?: string;
}
