import { WorkoutModeScreen } from "@/modules/workout-mode/ui/WorkoutModeScreen";

/**
 * Workout-mode route (design.md §D8) — reached by tapping a day on home. The
 * `[dayId]` segment identifies which day; workout mode is an intentionally empty
 * screen in this change (Feature D fills it), so the id is not consumed yet.
 * Thin app-layer wrapper: `WorkoutModeScreen` is a client component that handles
 * its own `ssr:false` body loading.
 */
export default function WorkoutDayPage() {
  return <WorkoutModeScreen />;
}
