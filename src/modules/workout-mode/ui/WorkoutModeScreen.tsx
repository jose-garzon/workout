"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { AppShell } from "@/shared/ui/layout/AppShell";

/**
 * workout-mode (Feature D) top-level screen. See ProfileGoalsScreen for why
 * the body is loaded with `ssr: false` — `useWorkoutSession` reads
 * browser-only Dexie live queries, so it must never run during Next's
 * static build.
 */
const WorkoutModeBody = dynamic(
  () => import("./WorkoutModeBody").then((mod) => mod.WorkoutModeBody),
  { ssr: false, loading: () => <Skeleton /> },
);

export interface WorkoutModeScreenProps {
  /** The day within the active routine to work (design.md §D8) — supplied
   * by the app route (`app/workout/[dayId]/page.tsx`) and threaded straight
   * through to the seam, `useWorkoutSession(dayId)`. This screen owns no
   * state of its own. */
  dayId: string;
}

export function WorkoutModeScreen({ dayId }: WorkoutModeScreenProps) {
  return (
    <AppShell title="Workout">
      <WorkoutModeBody dayId={dayId} />
    </AppShell>
  );
}
