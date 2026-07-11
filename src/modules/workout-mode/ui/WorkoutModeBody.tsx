"use client";

import { useRouter } from "next/navigation";
import { ErrorBoundary } from "@/shared/ui/components/ErrorBoundary";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/primitives/Button";
import { useWorkoutSession } from "../logic/useWorkoutSession";
import { ExerciseView } from "./ExerciseView";
import { SessionOverview } from "./SessionOverview";
import { SuccessView } from "./SuccessView";

export interface WorkoutModeBodyProps {
  dayId: string;
}

/**
 * The client-only body of the workout-mode screen — see WorkoutModeScreen
 * for why this is loaded via `next/dynamic({ ssr: false })` rather than
 * rendered inline.
 *
 * Picks the view PURELY off `status` (design.md "Logic↔UI seam contract" —
 * never off timestamps, and never off `timer.phase` at this level; that
 * belongs to `ExerciseView`/`Stopwatch` once we're already `in-progress`).
 * `loading` and `no-routine` are two of the design system's four states
 * (design-system.md §2); `overview`/`in-progress`/`success` are the real
 * content states, one component each.
 */
function WorkoutContent({ dayId }: WorkoutModeBodyProps) {
  const session = useWorkoutSession(dayId);

  switch (session.status) {
    case "loading":
      return <Skeleton />;
    case "no-routine":
      return <NoRoutineState />;
    case "overview":
      return <SessionOverview session={session} />;
    case "in-progress":
      return <ExerciseView session={session} />;
    case "success":
      return <SuccessView session={session} />;
    default:
      return null;
  }
}

/**
 * A one-sentence message + a bottom-anchored primary "back to home" action —
 * the shape design-system.md §2 "The four states" asks for from BOTH the
 * empty state (no routine here) and the error state (something broke).
 * A real function component (not called inline from `ErrorBoundary`'s
 * `fallback` prop) so `useRouter` gets a proper hook context — `ErrorBoundary`
 * is a class component, so a hook can't run inside the plain callback React
 * invokes directly during its own `render()`.
 */
function MessagePanel({
  heading,
  description,
}: {
  heading: string;
  description: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col justify-between gap-[var(--space-8)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-3)] text-center">
        <p className="text-title-3">{heading}</p>
        <p className="text-body text-text-muted">{description}</p>
      </div>
      <Button size="lg" fullWidth onClick={() => router.push("/")}>
        Back to home
      </Button>
    </div>
  );
}

/** Empty state — reached when `dayId` isn't part of the active routine, or
 * no active routine exists. */
function NoRoutineState() {
  return (
    <MessagePanel
      heading="No workout to start here"
      description="This day isn't part of your active routine — head back home to pick one that is."
    />
  );
}

/** Error state — specific and human, always paired with a next step
 * (design-system.md §2 "The four states"); never a raw crash. */
function ErrorState() {
  return (
    <MessagePanel
      heading="This workout couldn't be loaded"
      description="Something went wrong loading this session. Head back home and try again."
    />
  );
}

export function WorkoutModeBody({ dayId }: WorkoutModeBodyProps) {
  return (
    <ErrorBoundary fallback={() => <ErrorState />}>
      <WorkoutContent dayId={dayId} />
    </ErrorBoundary>
  );
}
