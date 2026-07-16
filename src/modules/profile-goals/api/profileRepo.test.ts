import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import type { Goals, Profile } from "../types";
import {
  getGoals,
  getProfile,
  saveOnboarding,
  saveProfileEdits,
} from "./profileRepo";

/**
 * Real Dexie against fake-indexeddb (design.md §6). No mocking of the DB itself;
 * the one `vi.spyOn` forces a mid-transaction failure to prove atomicity.
 */

const profile: Profile = {
  id: "me",
  displayName: "Alex",
  gender: "male",
  age: 28,
  unit: "metric",
  bodyweightKg: 80,
  heightCm: 180,
};

const goals: Goals = { id: "me", focus: "strength", daysPerWeek: 4 };

beforeEach(async () => {
  await Promise.all([db.profile.clear(), db.goals.clear()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getProfile / getGoals", () => {
  it("return null before onboarding completes", async () => {
    expect(await getProfile()).toBeNull();
    expect(await getGoals()).toBeNull();
  });
});

describe("saveOnboarding", () => {
  it("writes both rows and reads them back as domain types", async () => {
    await saveOnboarding(profile, goals);

    expect(await getProfile()).toEqual(profile);
    expect(await getGoals()).toEqual(goals);
  });

  it("stores canonical kg/cm on the profile row", async () => {
    await saveOnboarding(profile, goals);

    const row = await db.profile.get("me");
    expect(row?.bodyweightKg).toBe(80);
    expect(row?.heightCm).toBe(180);
  });

  it("omits heightCm on the row when the profile has none", async () => {
    const { heightCm: _omit, ...noHeight } = profile;
    await saveOnboarding(noHeight, goals);

    const row = await db.profile.get("me");
    expect(row).toBeDefined();
    expect("heightCm" in (row as object)).toBe(false);
  });

  it("is atomic — a forced goals failure rolls back the profile (no half-write)", async () => {
    vi.spyOn(db.goals, "put").mockRejectedValueOnce(new Error("boom"));

    await expect(saveOnboarding(profile, goals)).rejects.toThrow();

    // Profile must NOT be left behind — row-presence implies complete onboarding.
    expect(await getProfile()).toBeNull();
    expect(await getGoals()).toBeNull();
  });

  it("persists across a db close/reopen (reload)", async () => {
    await saveOnboarding(profile, goals);

    db.close();
    await db.open();

    expect(await getProfile()).toEqual(profile);
    expect(await getGoals()).toEqual(goals);
  });
});

describe("saveProfileEdits", () => {
  it("upserts the 'me' singleton in place — no duplicate rows", async () => {
    await saveOnboarding(profile, goals);

    const edited: Profile = {
      ...profile,
      displayName: "Sam",
      bodyweightKg: 85,
    };
    const editedGoals: Goals = { ...goals, daysPerWeek: 5 };
    await saveProfileEdits(edited, editedGoals);

    expect(await getProfile()).toEqual(edited);
    expect(await getGoals()).toEqual(editedGoals);
    expect(await db.profile.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
  });

  it("writes both rows in one transaction — a forced failure rolls back", async () => {
    await saveOnboarding(profile, goals);
    vi.spyOn(db.goals, "put").mockRejectedValueOnce(new Error("boom"));

    const edited: Profile = { ...profile, displayName: "Sam" };
    await expect(saveProfileEdits(edited, goals)).rejects.toThrow();

    // The profile edit rolled back with the failed goals put.
    expect((await getProfile())?.displayName).toBe("Alex");
  });
});
