"use client";

import dynamic from "next/dynamic";
import { Splash } from "@/modules/profile-goals/ui/Splash";
import { RoutineHomeScreen } from "@/modules/routine-generation/ui/RoutineHomeScreen";

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

export default function HomePage() {
  return (
    <FirstRunGate
      home={(profile, goals) => (
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
        />
      )}
    />
  );
}
