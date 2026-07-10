"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { AppShell } from "@/shared/ui/layout/AppShell";

/**
 * workout-mode (Feature D) top-level screen — foundation shell only. See
 * ProfileGoalsScreen for why the body is loaded with `ssr: false` (avoids
 * the throwing seam-hook stub running during Next's static build).
 */
const WorkoutModeBody = dynamic(
  () => import("./WorkoutModeBody").then((mod) => mod.WorkoutModeBody),
  { ssr: false, loading: () => <Skeleton /> },
);

export function WorkoutModeScreen() {
  return (
    <AppShell title="Workout">
      <WorkoutModeBody />
    </AppShell>
  );
}
