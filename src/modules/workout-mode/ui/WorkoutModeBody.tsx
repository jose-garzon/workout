"use client";

import { ComingSoon } from "@/shared/ui/components/ComingSoon";
import { ErrorBoundary } from "@/shared/ui/components/ErrorBoundary";
import { useWorkoutSession } from "../logic/useWorkoutSession";

/**
 * The client-only body of the workout-mode screen — see WorkoutModeScreen
 * for why this is loaded via `next/dynamic({ ssr: false })` rather than
 * rendered inline. `routineId` is a placeholder — the route wrapper that
 * supplies a real one lands with feature change D.
 */
function WorkoutContent({ routineId }: { routineId: string }) {
  const { status, currentExercise } = useWorkoutSession(routineId);
  if (status === "idle") {
    return null;
  }
  return <p className="text-body">{currentExercise.name}</p>;
}

export function WorkoutModeBody() {
  return (
    <ErrorBoundary
      fallback={() => (
        <ComingSoon
          title="Workout mode"
          description="Set-by-set logging and the rest timer ship in a later change — this screen guides you through every exercise."
        />
      )}
    >
      <WorkoutContent routineId="placeholder" />
    </ErrorBoundary>
  );
}
