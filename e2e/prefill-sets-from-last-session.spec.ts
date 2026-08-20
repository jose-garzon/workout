import { expect, type Page, test } from "@playwright/test";

/**
 * prefill-sets-from-last-session end-to-end — AC1 (the "Last time" caption
 * carries reps AND weight), AC3 (set 1 opens prefilled with the LAST set of the
 * last completed session) and AC10 (both are shown in the user's unit).
 *
 * These three only exist end-to-end: they need real IndexedDB history plus real
 * `<input>` elements, because the weight field keeps its own text state and is
 * reseeded by a remount (design D5) — a seam-level assertion would pass while
 * the visible field sat empty.
 *
 * Seeding copies workout-mode.spec.ts / consistency-calendar.spec.ts exactly:
 * goto("/"), wait for the welcome "Start" (which opens the Dexie DB and creates
 * its object stores), then raw-IndexedDB `put` rows.
 */

const DAY_ID = "day-1";
const EXERCISE_ID = "ex-bench";

/** The plan asks for 10 reps — deliberately NOT the history's 9, so a field
 *  reading 10 proves the prefill fell through to the plan. */
const ROUTINE = {
  id: "active",
  name: "Test Day",
  subtitle: "Move some weight.",
  createdAt: Date.now(),
  active: true,
  days: [
    {
      id: DAY_ID,
      name: "Push",
      exercises: [
        {
          id: EXERCISE_ID,
          name: "Bench Press",
          sets: [
            { reps: 10, restSeconds: 3 },
            { reps: 10, restSeconds: 3 },
          ],
        },
      ],
    },
  ],
};

const PROFILE = {
  id: "me",
  displayName: "Alex",
  gender: "male",
  age: 30,
  bodyweightKg: 80,
  unit: "metric",
};
const GOALS = { id: "me", focus: "strength", daysPerWeek: 3 };

/** A completed session for `EXERCISE_ID`: set 1 at 12×30, the FINAL set at the
 *  values under test. */
const history = (finalReps: number, finalWeightKg: number) => ({
  id: "prev-session",
  routineId: "active",
  dayId: DAY_ID,
  completedAt: Date.now() - 86_400_000,
  exerciseLogs: [
    {
      exerciseId: EXERCISE_ID,
      name: "Bench Press",
      series: [
        { reps: 12, weightKg: 30, workSeconds: 40, volumeKg: 360 },
        {
          reps: finalReps,
          weightKg: finalWeightKg,
          workSeconds: 40,
          volumeKg: finalWeightKg * finalReps,
        },
      ],
      restSeconds: 120,
    },
  ],
});

async function seed(
  page: Page,
  opts: { unit: "metric" | "imperial"; session: unknown },
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 15000 });
  await page.evaluate(
    async ({ routine, profile, goals, session }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open("workout-pal");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction(
        ["profile", "goals", "routines", "completedSessions"],
        "readwrite",
      );
      tx.objectStore("profile").put(profile);
      tx.objectStore("goals").put(goals);
      tx.objectStore("routines").put(routine);
      tx.objectStore("completedSessions").put(session);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    {
      routine: ROUTINE,
      profile: { ...PROFILE, unit: opts.unit },
      goals: GOALS,
      session: opts.session,
    },
  );
}

const repsField = (page: Page) => page.getByLabel("Reps", { exact: false });
const weightField = (page: Page) =>
  page.getByLabel("Weight for this set", { exact: false });

test("AC3 + AC1 — set 1 opens on last session's final set, caption shows reps and weight", async ({
  page,
}) => {
  await seed(page, { unit: "metric", session: history(9, 35) });
  await page.goto(`/workout/${DAY_ID}`);
  await page.getByRole("button", { name: "Start" }).click();

  // AC3: the FINAL set's 9 reps / 35 kg — not set 1's 12/30, not the plan's 10.
  await expect(repsField(page)).toHaveValue("9");
  await expect(weightField(page)).toHaveValue("35");

  // AC1: the caption carries both numbers (the last POSITIVE-weight set, which
  // here is the same final set).
  await expect(page.getByText(/Last time:\s*9 reps/)).toBeVisible();
  await expect(page.getByText(/35 kg/)).toBeVisible();
});

test("AC10 — an imperial profile prefills and captions in lb", async ({
  page,
}) => {
  // 66 lb stored canonically as kg.
  await seed(page, {
    unit: "imperial",
    session: history(8, 66 / 2.2046226),
  });
  await page.goto(`/workout/${DAY_ID}`);
  await page.getByRole("button", { name: "Start" }).click();

  await expect(repsField(page)).toHaveValue("8");
  await expect(weightField(page)).toHaveValue("66");
  await expect(page.getByText(/Last time:\s*8 reps/)).toBeVisible();
  await expect(page.getByText(/66 lb/)).toBeVisible();
});
