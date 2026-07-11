import { WorkoutModeScreen } from "@/modules/workout-mode/ui/WorkoutModeScreen";

/**
 * Workout-mode route (design.md §D8) — reached by tapping a day on home. In
 * Next 15 `params` is a Promise, so this server component awaits it and passes
 * the `dayId` string down; `WorkoutModeScreen` (a client component) resolves the
 * active routine + session itself via `useWorkoutSession(dayId)`. Thin wrapper:
 * no data access here (local-first — all reads happen in the browser).
 */
export default async function WorkoutDayPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  return <WorkoutModeScreen dayId={dayId} />;
}
