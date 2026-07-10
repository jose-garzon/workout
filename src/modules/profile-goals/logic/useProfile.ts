"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getGoals, getProfile } from "../api/profileRepo";
import type { Goals, Profile } from "../types";

/**
 * profile-goals read seam (design.md §3.2, D5). Read-only + reactive: backed by
 * a Dexie live query, so it re-emits automatically after `useOnboarding.finish()`
 * writes — which is the entire first-run routing mechanism (§4). Onboarding is
 * the sole writer, so there is no `saveProfile`/`saveGoals` here.
 */
export interface ProfileApi {
  /** The singleton, or null if none saved. */
  profile: Profile | null;
  goals: Goals | null;
  /** 'loading' until the first IndexedDB read resolves. */
  status: "loading" | "ready";
  /** status === 'ready' && profile !== null. */
  hasProfile: boolean;
  error: Error | null;
}

export function useProfile(): ProfileApi {
  // useLiveQuery returns `undefined` until its first emit → that IS 'loading'.
  const result = useLiveQuery(async () => {
    try {
      const [profile, goals] = await Promise.all([getProfile(), getGoals()]);
      return { profile, goals, error: null as Error | null };
    } catch (e) {
      return { profile: null, goals: null, error: e as Error };
    }
  });

  if (result === undefined) {
    return {
      profile: null,
      goals: null,
      status: "loading",
      hasProfile: false,
      error: null,
    };
  }

  return {
    profile: result.profile,
    goals: result.goals,
    status: "ready",
    hasProfile: result.profile !== null,
    error: result.error,
  };
}
