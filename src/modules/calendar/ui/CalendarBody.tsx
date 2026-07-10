"use client";

import { ComingSoon } from "@/shared/ui/components/ComingSoon";
import { ErrorBoundary } from "@/shared/ui/components/ErrorBoundary";
import { useCalendar } from "../logic/useCalendar";

/**
 * The client-only body of the calendar screen — see CalendarScreen for why
 * this is loaded via `next/dynamic({ ssr: false })` rather than rendered
 * inline.
 */
function CalendarContent() {
  const { summary, loading } = useCalendar();
  if (loading || !summary) {
    return null;
  }
  return <p className="text-body">{summary.weeklyCompleted}</p>;
}

export function CalendarBody() {
  return (
    <ErrorBoundary
      fallback={() => (
        <ComingSoon
          title="Consistency"
          description="Your calendar ships in a later change — a glance at completed sessions and your weekly target."
        />
      )}
    >
      <CalendarContent />
    </ErrorBoundary>
  );
}
