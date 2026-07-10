"use client";

import type { ReactNode } from "react";
import { useProfile } from "../logic/useProfile";
import type { Goals, Profile } from "../types";
import { Splash } from "./Splash";
import { WelcomeFlow } from "./WelcomeFlow";

/**
 * Client-side first-run gate (design.md §4, §D1) — the ONLY place that decides
 * welcome vs. home, off `useProfile().status`/`hasProfile`. Conditional render,
 * not a route redirect, so the flash-free guarantee holds: `Splash` is what both
 * the server's `ssr:false` fallback (app/page.tsx) AND this component's own
 * `status:'loading'` branch render, so hydration never disagrees, and
 * `WelcomeFlow` is structurally impossible to mount when a profile exists.
 *
 * Home content is injected as a render slot (§D1): the gate owns routing but not
 * WHAT home is, because home is composed across two features (profile identity +
 * routine-generation) and that composition may only happen at the app layer —
 * a feature's `ui/` may not import another feature (firewall rule 1). The slot
 * receives the loaded `profile`/`goals` so the app layer can wire them in.
 */
export interface FirstRunGateProps {
  home: (profile: Profile, goals: Goals | null) => ReactNode;
}

export function FirstRunGate({ home }: FirstRunGateProps) {
  const { status, hasProfile, profile, goals } = useProfile();

  if (status === "loading") {
    return <Splash />;
  }

  if (!hasProfile || profile === null) {
    return <WelcomeFlow />;
  }

  return <>{home(profile, goals)}</>;
}
