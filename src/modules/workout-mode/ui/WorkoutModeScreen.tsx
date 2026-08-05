"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui/components/Skeleton";

/**
 * workout-mode (Feature D) top-level screen. See ProfileGoalsScreen for why
 * the body is loaded with `ssr: false` — `useWorkoutSession` reads
 * browser-only Dexie live queries, so it must never run during Next's
 * static build. `AppShell` (and its translated title/`ThemeToggle`) lives
 * INSIDE `WorkoutModeBody`, not here — i18n-spanish-support design §Decision
 * 4: no component that calls `t()` may render on the server, and this is the
 * one route where `AppShell` used to sit outside the `ssr:false` boundary.
 * The `loading` fallback is a bare `Skeleton`, so nothing translated ever
 * reaches the server render on this route either.
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
  return <WorkoutModeBody dayId={dayId} />;
}
