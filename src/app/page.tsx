"use client";

import dynamic from "next/dynamic";
import { CalendarWeekStrip } from "@/modules/calendar/ui/CalendarWeekStrip";
import type { Goals, Profile } from "@/modules/profile-goals";
import { Splash } from "@/modules/profile-goals/ui/Splash";
import { RoutineHomeScreen } from "@/modules/routine-generation/ui/RoutineHomeScreen";
import { useSessionSummary } from "@/modules/workout-mode";

/**
 * Root route ('/') — thin client wrapper (design.md §4.1, §D1). Mounts the
 * first-run gate with `ssr: false` so the prerendered static shell is exactly
 * the neutral `Splash`, and the profile check — which can only run in the
 * browser, since `shared/db` is browser-only — is deferred to the client.
 *
 * This is the app composition layer where the two features meet (§D1): the gate
 * (profile-goals) owns routing and hands its loaded profile/goals to the `home`
 * slot, which renders the routine-generation dashboard. Neither feature imports
 * the other — the wiring lives here, in `app/`, which is allowed to reach both.
 */
const FirstRunGate = dynamic(
  () =>
    import("@/modules/profile-goals/ui/FirstRunGate").then(
      (mod) => mod.FirstRunGate,
    ),
  { ssr: false, loading: () => <Splash /> },
);

/**
 * The `home` slot's own client wrapper — the one piece of wiring home needs
 * that the gate cannot supply. Profile editing is NOT here any more
 * (profile-page design.md §D10): the drawer is gone and editing lives on its own
 * route, reached through the header's profile entry.
 */
function Home({ profile, goals }: { profile: Profile; goals: Goals | null }) {
  // The on-device history summary threaded into an AI edit (routine-edit-history
  // design.md §Decision 4): a plain `string | null` from workout-mode's barrel —
  // no D type crosses into routine-generation, keeping the graph acyclic.
  const sessionSummary = useSessionSummary();

  return (
    <RoutineHomeScreen
      displayName={profile.displayName}
      focus={goals?.focus ?? "general"}
      daysPerWeek={goals?.daysPerWeek ?? 3}
      gender={profile.gender}
      age={profile.age}
      bodyweightKg={profile.bodyweightKg}
      heightCm={profile.heightCm}
      unit={profile.unit}
      notes={goals?.notes}
      weekStrip={<CalendarWeekStrip />}
      sessionSummary={sessionSummary}
    />
  );
}

export default function HomePage() {
  return (
    <FirstRunGate
      home={(profile, goals) => <Home profile={profile} goals={goals} />}
    />
  );
}
