"use client";

import dynamic from "next/dynamic";
import { ProfileScreen } from "@/modules/profile-goals/ui/ProfileScreen";
import { Splash } from "@/modules/profile-goals/ui/Splash";

/**
 * Profile route ('/profile') — thin client wrapper (profile-page design.md §D1),
 * the same shape as `app/page.tsx`. Dexie is browser-only, so the profile check
 * runs behind `ssr: false` and the prerendered static shell is the neutral
 * `Splash`. Reusing `FirstRunGate` means a deep-linked `/profile` on a fresh
 * device lands in onboarding for free; its slot is still named `home` because it
 * means "the profile-required screen", not literally home.
 */
const FirstRunGate = dynamic(
  () =>
    import("@/modules/profile-goals/ui/FirstRunGate").then(
      (mod) => mod.FirstRunGate,
    ),
  { ssr: false, loading: () => <Splash /> },
);

export default function ProfilePage() {
  return (
    <FirstRunGate
      home={(profile, goals) => (
        <ProfileScreen
          displayName={profile.displayName}
          focus={goals?.focus ?? "general"}
        />
      )}
    />
  );
}
