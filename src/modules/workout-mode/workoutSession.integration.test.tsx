import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { useWorkoutStore } from "./logic/store";
import type { WorkoutSessionApi } from "./logic/useWorkoutSession";
import { useWorkoutSession } from "./logic/useWorkoutSession";
import { ExerciseView } from "./ui/ExerciseView";

/**
 * Full-seam integration (design.md §D3–§D5, tasks 8.1/8.2): a real Zustand store
 * + real Dexie over fake-indexeddb, driving overview → start → work/rest/overtime
 * → finish → success, then a reload-resume. Session tracking is purely local, so
 * `fetch` must never fire across the whole flow.
 */

const SESSION_ID = "active:d1";

/**
 * Bench = 2 series (rest 120), Squat = 1 series — enough to exercise every phase.
 * Seeded straight into Dexie (singleton id "active"); using the other feature's
 * repo here would be a cross-feature deep import (firewall rule 3).
 */
async function seedRoutine() {
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: [
          {
            id: "e1",
            name: "Bench",
            sets: [
              { reps: 8, restSeconds: 120 },
              { reps: 8, restSeconds: 120 },
            ],
          },
          { id: "e2", name: "Squat", sets: [{ reps: 5, restSeconds: 120 }] },
        ],
      },
    ],
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  useWorkoutStore.getState().reset();
  await Promise.all([
    db.sessions.clear(),
    db.completedSessions.clear(),
    db.routines.clear(),
    db.profile.clear(),
  ]);
  await db.profile.put({ id: "me", gender: "male", age: 30, unit: "metric" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("full session (§D3–§D5, no network)", () => {
  it("runs overview → start → work/rest/overtime → finish, persisting correct per-series logs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await seedRoutine();
    vi.setSystemTime(0);

    const { result, rerender } = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(result.current.status).toBe("overview"));

    // Overview surfaces the plan + the seeded default rest (mode = 120).
    expect(result.current.exercises).toEqual([
      { id: "e1", name: "Bench", plannedSeries: 2, plannedReps: 8 },
      { id: "e2", name: "Squat", plannedSeries: 1, plannedReps: 5 },
    ]);
    expect(result.current.defaultRestSeconds).toBe(120);

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("in-progress");
    expect(result.current.currentExercise?.id).toBe("e1");

    act(() => result.current.setWeight(60));
    // Reps auto-fill from the plan (no history); the set cannot start until they do.
    await waitFor(() => expect(result.current.reps).toBe(8));
    expect(result.current.missingSetFields).toEqual([]);

    // Armed → tap to START series 1 (§D12).
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("work");

    // Series 1 work → rest (40s of work banked).
    vi.setSystemTime(40_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("rest");

    // Let the rest run 10s past the 120s limit → derived overtime.
    vi.setSystemTime(40_000 + 130_000);
    rerender();
    expect(result.current.timer.phase).toBe("overtime");
    expect(result.current.timer.overtimeSeconds).toBe(10);

    // Tap out of overtime → series 2 ARMED (130s of rest banked, §D12).
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("ready");

    // Weight carries over, reps re-default for the new set index — and the user
    // bumps them to 10, which is what the record must store.
    await waitFor(() => expect(result.current.reps).toBe(8));
    act(() => result.current.setReps(10));

    // Tap to START series 2.
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("work");

    // Series 2 work → exercise complete (50s of work banked; no trailing rest).
    vi.setSystemTime(170_000 + 50_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.timer.phase).toBe("exercise-complete");
    expect(result.current.currentExercise?.isLast).toBe(false);

    // Advance to Squat, weigh it, and finish on its single series.
    await act(async () => {
      await result.current.nextExercise();
    });
    expect(result.current.currentExercise?.id).toBe("e2");
    act(() => result.current.setWeight(80));
    await waitFor(() => expect(result.current.reps).toBe(5));

    // Armed → tap to START, then finish on the single series.
    await act(async () => {
      await result.current.tap();
    });
    vi.setSystemTime(220_000 + 30_000);
    await act(async () => {
      await result.current.tap();
    });
    expect(result.current.status).toBe("success");

    // Exactly one completed record, with per-SET series logs and aggregate rest.
    const completed = await db.completedSessions.toArray();
    expect(completed).toHaveLength(1);
    const [record] = completed;
    expect(record.dayId).toBe("d1");
    expect(record.exerciseLogs).toEqual([
      {
        exerciseId: "e1",
        name: "Bench",
        series: [
          { reps: 8, weightKg: 60, workSeconds: 40, volumeKg: 480 }, // 60 × 8
          // The reps the user CONFIRMED for series 2, not the plan's 8.
          { reps: 10, weightKg: 60, workSeconds: 50, volumeKg: 600 },
        ],
        restSeconds: 130, // aggregate across the one inter-set rest
      },
      {
        exerciseId: "e2",
        name: "Squat",
        series: [{ reps: 5, weightKg: 80, workSeconds: 30, volumeKg: 400 }], // 80 × 5
        restSeconds: 0,
      },
    ]);
    // Each SeriesLog's volume is exactly weightKg × reps.
    for (const log of record.exerciseLogs as Array<{
      series: Array<{ reps: number; weightKg: number; volumeKg: number }>;
    }>) {
      for (const set of log.series) {
        expect(set.volumeKg).toBe(set.weightKg * set.reps);
      }
    }

    // The resume row was cleared on finish, and nothing ever hit the network.
    expect(await db.sessions.get(SESSION_ID)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("reload resume (§D4)", () => {
  it("rehydrates the same exercise with weight, series progress, and an exact timer", async () => {
    await seedRoutine();
    vi.setSystemTime(0);

    // First mount: start, weigh, and land mid-rest after series 1.
    const first = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() => expect(first.result.current.status).toBe("overview"));
    await act(async () => {
      await first.result.current.start();
    });
    act(() => first.result.current.setWeight(72.5));
    await waitFor(() => expect(first.result.current.reps).toBe(8));
    // Tap to START series 1, then end it → rest.
    await act(async () => {
      await first.result.current.tap();
    });
    vi.setSystemTime(35_000);
    await act(async () => {
      await first.result.current.tap();
    });
    expect(first.result.current.timer.phase).toBe("rest");

    // Simulate a page reload: the hot store is gone, Dexie persists.
    first.unmount();
    act(() => useWorkoutStore.getState().reset());

    // 20s pass while "away", then the fresh mount resumes.
    vi.setSystemTime(35_000 + 20_000);
    const second = renderHook(() => useWorkoutSession("d1"));
    await waitFor(() =>
      expect(second.result.current.status).toBe("in-progress"),
    );

    expect(second.result.current.currentExercise?.id).toBe("e1");
    expect(second.result.current.weight).toBe(72.5); // display unit (metric)
    // Series 1's log restored intact (§9.8): 35s of work at 72.5 kg × 8 reps.
    expect(second.result.current.completedSets).toEqual([
      { reps: 8, weight: 72.5, workSeconds: 35, volume: 72.5 * 8 },
    ]);
    // Series 1 done → resting before series 2. The rest anchor (t=35_000) is
    // restored verbatim, so 20s of elapsed rest → remaining = 120 − 20 = 100.
    expect(second.result.current.timer.phase).toBe("rest");
    expect(second.result.current.timer.displaySeconds).toBe(100);
    expect(second.result.current.timer.currentSeries).toBe(2);
  });
});

/**
 * Prefill from last session (prefill-sets-from-last-session, ACs 3–12). These
 * drive the REAL `ExerciseView` off the real seam and assert the **rendered
 * input values**, not `session.reps` / `session.weight`: the weight field keeps
 * its own text state and is only reseeded by a remount (design D5), so a
 * seam-level assertion would pass while the visible field sat empty.
 *
 * Plan reps are 10 everywhere and history reps are never 10 — a field reading
 * 10 means the prefill fell through to the plan.
 */

/** e1 "Bench" and e2 "Squat", both on the same plan — one set of 10 reps by
 *  default, or whatever per-set reps the caller passes. */
async function seedPrefillRoutine(planReps: number[] = [10]) {
  const sets = planReps.map((reps) => ({ reps, restSeconds: 120 }));
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt: 0,
    active: true,
    days: [
      {
        id: "d1",
        name: "Push",
        exercises: [
          { id: "e1", name: "Bench", sets },
          { id: "e2", name: "Squat", sets },
        ],
      },
    ],
  });
}

/** A completed session, newest by default, holding one log per entry. */
async function seedHistory(
  logs: Array<{ exerciseId: string; series: Array<[number, number]> }>,
  completedAt = 1000,
) {
  await db.completedSessions.put({
    id: `hist-${completedAt}`,
    routineId: "active",
    dayId: "d1",
    completedAt,
    exerciseLogs: logs.map(({ exerciseId, series }) => ({
      exerciseId,
      name: exerciseId,
      series: series.map(([reps, weightKg]) => ({
        reps,
        weightKg,
        workSeconds: 30,
        volumeKg: reps * weightKg,
      })),
      restSeconds: 60,
    })),
  });
}

/** The seam, rendered through the real per-exercise view. `api.current` is the
 *  live seam so a test can drive actions the UI would otherwise trigger. */
const api: { current: WorkoutSessionApi | null } = { current: null };

function Harness() {
  const session = useWorkoutSession("d1");
  api.current = session;
  return session.status === "in-progress" ? (
    <ExerciseView session={session} />
  ) : null;
}

const repsInput = () => screen.getByLabelText(/^Reps/) as HTMLInputElement;
const stopwatch = () => screen.getByRole("button", { name: /tap to/i });
const weightInput = () => screen.getByLabelText(/^Weight/) as HTMLInputElement;

/** Mount, wait for overview, and start — the state every AC below begins from. */
async function renderStarted() {
  render(<Harness />);
  await waitFor(() => expect(api.current?.status).toBe("overview"));
  await act(async () => {
    await api.current?.start();
  });
}

/** One full set: tap to start, `seconds` of work, tap to end. */
async function runSet(fromMs: number, seconds = 30) {
  await act(async () => {
    await api.current?.tap();
  });
  vi.setSystemTime(fromMs + seconds * 1000);
  await act(async () => {
    await api.current?.tap();
  });
}

describe("set prefill from last session", () => {
  beforeEach(() => {
    api.current = null;
  });

  it("AC3 — set 1 opens on the LAST set of the last session, not set 1's and not the plan's", async () => {
    await seedPrefillRoutine();
    // Last session: opened at 12×30, finished at 9×35.
    await seedHistory([
      {
        exerciseId: "e1",
        series: [
          [12, 30],
          [9, 35],
        ],
      },
    ]);
    vi.setSystemTime(0);

    await renderStarted();

    await waitFor(() => expect(repsInput().value).toBe("9"));
    expect(weightInput().value).toBe("35");
  });

  it("AC7 — advancing reseeds from the next exercise's own history", async () => {
    await seedPrefillRoutine();
    await seedHistory([
      { exerciseId: "e1", series: [[9, 35]] },
      { exerciseId: "e2", series: [[8, 60]] },
    ]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    // Finish e1's single set, then advance.
    await runSet(0);
    expect(api.current?.timer.phase).toBe("exercise-complete");
    await act(async () => {
      await api.current?.nextExercise();
    });

    // Read synchronously: the seed must already be committed when the advance
    // settles — never e1's 9 × 35. (This cannot distinguish the D8 prefetch
    // from a cold read: fake-indexeddb resolves inside the awaited `act`.)
    expect(repsInput().value).toBe("8");
    expect(weightInput().value).toBe("60");
  });

  it("AC4 — no history at all: the plan's reps, an empty weight field", async () => {
    await seedPrefillRoutine();
    vi.setSystemTime(0);

    await renderStarted();

    await waitFor(() => expect(repsInput().value).toBe("10"));
    expect(weightInput().value).toBe("");
  });

  it("AC5 — set 2 carries reps and weight from set 1, not from the plan", async () => {
    await seedPrefillRoutine([10, 10]);
    await seedHistory([{ exerciseId: "e1", series: [[9, 35]] }]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    // Set 1 runs unchanged, then out of rest into set 2.
    await runSet(0);
    await act(async () => {
      await api.current?.tap();
    });

    expect(repsInput().value).toBe("9"); // NOT the plan's 10
    expect(weightInput().value).toBe("35");
  });

  it("AC6 — an edit propagates to set 3 and never rewrites the earlier records", async () => {
    await seedPrefillRoutine([10, 10, 10]);
    await seedHistory([{ exerciseId: "e1", series: [[9, 35]] }]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    // Set 1 at the seeded 9 × 35.
    await runSet(0);
    await act(async () => {
      await api.current?.tap(); // rest → set 2 armed
    });

    // Set 2 after the user edits both fields.
    fireEvent.change(repsInput(), { target: { value: "8" } });
    fireEvent.change(weightInput(), { target: { value: "37.5" } });
    await runSet(30_000);
    await act(async () => {
      await api.current?.tap(); // rest → set 3 armed
    });

    // Set 3 opens on the EDITED values…
    expect(repsInput().value).toBe("8");
    expect(weightInput().value).toBe("37.5");
    // …and each finished set kept its own numbers.
    expect(
      api.current?.completedSets.map((set) => [set.reps, set.weight]),
    ).toEqual([
      [9, 35],
      [8, 37.5],
    ]);
  });

  it("AC8 — advancing to an exercise with no history falls back to its plan", async () => {
    await seedPrefillRoutine();
    await seedHistory([{ exerciseId: "e1", series: [[9, 35]] }]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    await runSet(0);
    await act(async () => {
      await api.current?.nextExercise();
    });

    // e2's plan reps, and no guessed weight — never e1's 9 × 35.
    expect(repsInput().value).toBe("10");
    expect(weightInput().value).toBe("");
  });

  it("AC11 — a prefilled field is editable, records the edit, and starts nothing on its own", async () => {
    await seedPrefillRoutine();
    await seedHistory([{ exerciseId: "e1", series: [[9, 35]] }]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    fireEvent.change(repsInput(), { target: { value: "11" } });
    fireEvent.change(weightInput(), { target: { value: "40" } });
    // The seed armed the set; it did not start it.
    expect(api.current?.timer.phase).toBe("ready");

    await act(async () => {
      fireEvent.click(stopwatch());
    });
    expect(api.current?.timer.phase).toBe("work");
    vi.setSystemTime(30_000);
    await act(async () => {
      fireEvent.click(stopwatch());
    });

    expect(
      api.current?.completedSets.map((set) => [set.reps, set.weight]),
    ).toEqual([[11, 40]]);
  });

  it("AC12 — a fully prefilled set starts on the first tap with no error", async () => {
    await seedPrefillRoutine();
    await seedHistory([{ exerciseId: "e1", series: [[9, 35]] }]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("9"));

    // Not one field touched.
    await act(async () => {
      fireEvent.click(stopwatch());
    });

    expect(api.current?.timer.phase).toBe("work");
    expect(
      screen.queryByText("Enter this before starting the set."),
    ).toBeNull();
  });

  it("AC13 — no history: every set's reps come from the plan at that index", async () => {
    // Never logged, and a plan that DESCENDS, so a carried value is unmistakable.
    await seedPrefillRoutine([12, 10, 8]);
    vi.setSystemTime(0);

    await renderStarted();

    await waitFor(() => expect(repsInput().value).toBe("12"));
    expect(weightInput().value).toBe("");
    fireEvent.change(weightInput(), { target: { value: "40" } });

    await runSet(0);
    await act(async () => {
      await api.current?.tap(); // rest → set 2 armed
    });
    // The plan's set-2 reps, NOT set 1's carried 12. The weight still carries —
    // only reps have a per-set plan to fall back on.
    expect(repsInput().value).toBe("10");
    expect(weightInput().value).toBe("40");

    await runSet(30_000);
    await act(async () => {
      await api.current?.tap(); // rest → set 3 armed
    });
    expect(repsInput().value).toBe("8");
    expect(weightInput().value).toBe("40");
  });

  it("AC14 — no history: an edit to set 1's reps does not override set 2's plan", async () => {
    await seedPrefillRoutine([12, 10, 8]);
    vi.setSystemTime(0);

    await renderStarted();
    await waitFor(() => expect(repsInput().value).toBe("12"));

    fireEvent.change(repsInput(), { target: { value: "15" } });
    fireEvent.change(weightInput(), { target: { value: "40" } });
    await runSet(0);
    await act(async () => {
      await api.current?.tap(); // rest → set 2 armed
    });

    // Plan-wins: with no history the plan is the only signal, and this is
    // exactly the leak the amendment removes.
    expect(repsInput().value).toBe("10");
    // The edit is still honoured where it counts — set 1's own record.
    expect(
      api.current?.completedSets.map((set) => [set.reps, set.weight]),
    ).toEqual([[15, 40]]);
  });
});
