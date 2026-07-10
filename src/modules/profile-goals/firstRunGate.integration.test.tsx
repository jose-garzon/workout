import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { getGoals, getProfile, saveOnboarding } from "./api/profileRepo";
import { useOnboarding } from "./logic/useOnboarding";
import { FirstRunGate } from "./ui/FirstRunGate";

/**
 * Integration tests (design.md §6, tasks.md I1–I3). Real hooks + real Dexie
 * (fake-indexeddb) + the designer's real `ui/` — the full seam, end to end.
 * Nothing is mocked except the network spy in I3; the DB is the genuine
 * article. `vitest.config.ts` sets no `test.globals`, so RTL's auto-cleanup
 * never registers — hence the explicit `afterEach(cleanup)`.
 */
afterEach(cleanup);

beforeEach(async () => {
  await Promise.all([db.profile.clear(), db.goals.clear()]);
});

/**
 * The gate injects home content as a render slot (design.md §D1) — the actual
 * home (routine-generation) is composed at the app layer, out of this feature's
 * reach. These tests exercise the gate's ROUTING with a minimal stand-in slot
 * that just greets by name, so they stay independent of routine-generation.
 */
function renderGate() {
  return render(
    <FirstRunGate home={(profile) => <h1>Hey, {profile.displayName}</h1>} />,
  );
}

/** Drive the real UI through all four steps and activate Finish. */
async function completeOnboarding(name = "Alex") {
  // Gate resolves loading -> WelcomeFlow (no profile); wait for the intro.
  fireEvent.click(await screen.findByRole("button", { name: "Start" }));

  // Step 1 — name + gender.
  fireEvent.change(screen.getByLabelText("Your name", { exact: false }), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Male" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Step 2 — age + units (units default to metric).
  fireEvent.change(screen.getByLabelText("Age", { exact: false }), {
    target: { value: "28" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Step 3 — bodyweight (kg); height left blank (optional).
  fireEvent.change(screen.getByLabelText("Bodyweight (kg)", { exact: false }), {
    target: { value: "80" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Step 4 — focus + training days.
  fireEvent.click(screen.getByRole("radio", { name: "Strength" }));
  const increase = screen.getByRole("button", {
    name: "Increase Training days per week",
  });
  for (let i = 0; i < 4; i++) fireEvent.click(increase); // seeds 1, steps to 4

  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
}

describe("I1 — seam integration: fill 3 steps -> finish -> home by name", () => {
  it("persists both rows and reactively swaps the gate to the home slot greeting by name", async () => {
    renderGate();

    await completeOnboarding("Alex");

    // The live `useProfile` query re-emits after the write and the gate swaps
    // to home — no navigation call anywhere (design.md §4.3).
    expect(
      await screen.findByRole("heading", { name: /Hey, Alex/ }),
    ).toBeInTheDocument();

    // Both rows are actually in IndexedDB, canonicalized.
    expect(await getProfile()).toEqual({
      id: "me",
      displayName: "Alex",
      gender: "male",
      age: 28,
      unit: "metric",
      bodyweightKg: 80,
      heightCm: undefined,
    });
    expect(await getGoals()).toEqual({
      id: "me",
      focus: "strength",
      daysPerWeek: 4,
      notes: undefined,
    });
  });
});

describe("I2 — routing gate / no-flash", () => {
  it("routes to WelcomeFlow when no profile exists", async () => {
    renderGate();

    expect(
      await screen.findByRole("button", { name: "Start" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Hey/ })).toBeNull();
  });

  it("routes a seeded profile straight to home and NEVER renders onboarding markup", async () => {
    await saveOnboarding(
      {
        id: "me",
        displayName: "Robin",
        gender: "female",
        age: 31,
        unit: "metric",
        bodyweightKg: 70,
      },
      { id: "me", focus: "hypertrophy", daysPerWeek: 3 },
    );

    renderGate();

    // Loading instant is the neutral Splash — not an onboarding frame: it has
    // no heading at all (Home/Welcome both render an <h1>), and no Start.
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();

    // Resolves directly to home...
    expect(
      await screen.findByRole("heading", { name: /Hey, Robin/ }),
    ).toBeInTheDocument();

    // ...and onboarding markup was never mounted across the transition
    // (WelcomeFlow is structurally impossible to mount once hasProfile — AC 12).
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Finish" })).toBeNull();
  });

  it("shows the neutral Splash during the loading instant", () => {
    renderGate();

    // First synchronous paint, before the live query resolves: Splash only.
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.getByText("workout-pal")).toBeInTheDocument();
  });
});

describe("I3 — no-network: finish() makes no fetch/network call", () => {
  it("persists locally without hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.setField("displayName", "Sam");
      result.current.setField("gender", "other");
      result.current.setField("age", "40");
      result.current.setField("bodyweight", "82");
      result.current.setField("focus", "endurance");
      result.current.setField("daysPerWeek", "5");
    });

    await act(async () => {
      await result.current.finish();
    });

    // Local-first (AC 9): the whole finish path touches IndexedDB only.
    expect(fetchSpy).not.toHaveBeenCalled();

    // ...and the write really happened.
    expect(await getProfile()).toMatchObject({
      displayName: "Sam",
      gender: "other",
      age: 40,
      bodyweightKg: 82,
    });
    expect(await getGoals()).toMatchObject({
      focus: "endurance",
      daysPerWeek: 5,
    });

    fetchSpy.mockRestore();
  });
});
