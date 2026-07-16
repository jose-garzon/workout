import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { getGoals, getProfile } from "../api/profileRepo";
import type { Goals, Profile } from "../types";
import { useProfileEditor } from "./useProfileEditor";

/**
 * Seam-level behavior against real Dexie + fake-indexeddb. The editor takes the
 * saved records as props (not via useProfile), so tests just pass them in.
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

/** Read a field descriptor by name from the live api. */
function field(api: ReturnType<typeof useProfileEditor>, name: string) {
  const f = api.fields.find((x) => x.name === name);
  if (!f) throw new Error(`no field ${name}`);
  return f;
}

beforeEach(async () => {
  await Promise.all([db.profile.clear(), db.goals.clear()]);
});

describe("useProfileEditor — seeding", () => {
  it("seeds all 8 fields from the saved records in display units", () => {
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    expect(result.current.fields.map((f) => f.name)).toEqual([
      "displayName",
      "gender",
      "age",
      "unit",
      "bodyweight",
      "height",
      "focus",
      "daysPerWeek",
    ]);
    expect(field(result.current, "displayName").value).toBe("Alex");
    expect(field(result.current, "bodyweight").value).toBe("80");
    expect(result.current.dirty).toBe(false);
    expect(result.current.canSave).toBe(true);
  });
});

describe("useProfileEditor — dirty tracking", () => {
  it("goes dirty on edit and back to clean when the saved value is restored", () => {
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    act(() => result.current.setField("displayName", "Sam"));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.setField("displayName", "Alex"));
    expect(result.current.dirty).toBe(false);
  });
});

describe("useProfileEditor — unit toggle converts body values", () => {
  it("re-expresses bodyweight/height when the unit switches", () => {
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    expect(field(result.current, "bodyweight").value).toBe("80"); // kg
    act(() => result.current.setField("unit", "imperial"));

    // The shown number is converted (80 kg → 176 lb), not just relabelled.
    expect(field(result.current, "bodyweight").value).toBe("176");
    expect(field(result.current, "height").value).toBe("71"); // 180 cm → in
    expect(field(result.current, "bodyweight").label).toContain("lb");
  });
});

describe("useProfileEditor — save", () => {
  it("blocks + surfaces errors on invalid input and does not persist (false)", async () => {
    await db.profile.clear();
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    act(() => result.current.setField("bodyweight", ""));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toBe(false);
    expect(field(result.current, "bodyweight").error).not.toBeNull();
    expect(await getProfile()).toBeNull(); // nothing written
  });

  it("persists edits and resolves true on valid input", async () => {
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    act(() => result.current.setField("displayName", "Sam"));
    act(() => result.current.setField("bodyweight", "85"));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toBe(true);
    await waitFor(async () => {
      expect((await getProfile())?.displayName).toBe("Sam");
    });
    expect((await getProfile())?.bodyweightKg).toBe(85);
    expect((await getGoals())?.focus).toBe("strength");
  });
});

describe("useProfileEditor — reset", () => {
  it("re-seeds the draft from the saved records, dropping edits", () => {
    const { result } = renderHook(() => useProfileEditor(profile, goals));

    act(() => result.current.setField("displayName", "Temp"));
    expect(field(result.current, "displayName").value).toBe("Temp");

    act(() => result.current.reset());
    expect(field(result.current, "displayName").value).toBe("Alex");
    expect(result.current.dirty).toBe(false);
  });
});
