"use client";

import dynamic from "next/dynamic";
import { ProfileEditScreen } from "@/modules/profile-goals/ui/ProfileEditScreen";
import { Splash } from "@/modules/profile-goals/ui/Splash";

/**
 * Edit-profile route ('/profile/edit') — same gate wrapper as `/profile`
 * (profile-page design.md §D1). Navigating away UNMOUNTS the screen, which is
 * what discards abandoned edits: `useProfileEditor` re-seeds from the freshly
 * live-queried records on the next visit, so no `reset()` call is needed (§D2).
 */
const FirstRunGate = dynamic(
  () =>
    import("@/modules/profile-goals/ui/FirstRunGate").then(
      (mod) => mod.FirstRunGate,
    ),
  { ssr: false, loading: () => <Splash /> },
);

export default function ProfileEditPage() {
  return (
    <FirstRunGate
      home={(profile, goals) => (
        <ProfileEditScreen profile={profile} goals={goals} />
      )}
    />
  );
}
