/**
 * profile-goals (Feature A) — PUBLIC BARREL. The only entry point for the rest
 * of the app: seam hooks + public domain types. The `ui/`, `logic/`, `api/`,
 * and `types.ts` internals are private (cross-feature deep imports are blocked
 * by dependency-cruiser rule 3).
 */

export type {
  FieldKind,
  FieldName,
  FieldOption,
  OnboardingApi,
  OnboardingField,
  OnboardingPhase,
} from "./logic/useOnboarding";
export { useOnboarding } from "./logic/useOnboarding";
export type { ProfileApi } from "./logic/useProfile";
export { useProfile } from "./logic/useProfile";
export type {
  Goals,
  MeasurementUnit,
  Profile,
  TrainingFocus,
} from "./types";
