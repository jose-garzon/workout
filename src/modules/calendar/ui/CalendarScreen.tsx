"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { AppShell } from "@/shared/ui/layout/AppShell";

/**
 * calendar (Feature C) top-level screen — foundation shell only. See
 * ProfileGoalsScreen for why the body is loaded with `ssr: false` (avoids
 * the throwing seam-hook stub running during Next's static build).
 */
const CalendarBody = dynamic(
  () => import("./CalendarBody").then((mod) => mod.CalendarBody),
  { ssr: false, loading: () => <Skeleton /> },
);

export function CalendarScreen() {
  return (
    <AppShell title="Calendar">
      <CalendarBody />
    </AppShell>
  );
}
