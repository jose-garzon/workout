import { expect, type Page, test } from "@playwright/test";

/**
 * Feature D end-to-end (tasks.md 8.4): overview → start → work / rest / overtime
 * stopwatch → finish → success → home, plus mid-session resume. The active
 * routine + profile are seeded straight into the IndexedDB stores Dexie creates
 * on first app load, so the flow doesn't depend on the onboarding /
 * routine-generation UI. Workout mode makes no network calls — nothing is mocked.
 */

const DAY_ID = "day-1";

/** One day, one exercise, two sets, short (3s) rest — a fast full run. */
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
          id: "ex-bench",
          name: "Bench Press",
          sets: [
            { reps: 8, restSeconds: 3 },
            { reps: 8, restSeconds: 3 },
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

/** Seed the Dexie-created stores via raw IndexedDB (keyPath "id"). */
async function seed(page: Page) {
  await page.goto("/");
  // The welcome "Start" only renders after FirstRunGate's profile live-query
  // has run — which is what opens the Dexie DB and creates its object stores.
  // Waiting for it guarantees a versionless raw open below hits a DB that
  // already has the stores, instead of racing Dexie and creating an empty one.
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 15000 });
  await page.evaluate(
    async ({ routine, profile, goals }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open("workout-pal");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction(["profile", "goals", "routines"], "readwrite");
      tx.objectStore("profile").put(profile);
      tx.objectStore("goals").put(goals);
      tx.objectStore("routines").put(routine);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { routine: ROUTINE, profile: PROFILE, goals: GOALS },
  );
}

/** The stopwatch's accessible name changes per phase but always contains "Tap to". */
const stopwatch = (page: Page) => page.getByRole("button", { name: /Tap to/ });

const weightField = (page: Page) =>
  page.getByLabel("Weight for this set", { exact: false });

test("guide a full session: overview → work/rest/overtime → finish → home", async ({
  page,
}) => {
  await seed(page);
  await page.goto(`/workout/${DAY_ID}`);

  // Overview: exercise listed + Start.
  await expect(page.getByText("Bench Press")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  // Ready: a weight is required before the set can start (§D12).
  await weightField(page).fill("60");

  await stopwatch(page).click({ force: true }); // ready → work (series 1)
  await stopwatch(page).click({ force: true }); // work → rest

  // Rest elapses (3s) untapped → overtime prompt.
  await expect(page.getByText(/Time.?s up/i)).toBeVisible({ timeout: 8000 });
  await stopwatch(page).click({ force: true }); // overtime → ready (series 2, weight carries)
  await stopwatch(page).click({ force: true }); // ready → work (series 2)
  await stopwatch(page).click({ force: true }); // work → finish (last series)

  // Success view + back home.
  await expect(page.getByText("Workout complete")).toBeVisible();
  await page.getByRole("button", { name: "Back to home" }).click();
  await expect(page).toHaveURL("/");
});

test("a mid-session reload resumes in progress, not back at overview", async ({
  page,
}) => {
  await seed(page);
  await page.goto(`/workout/${DAY_ID}`);
  await page.getByRole("button", { name: "Start" }).click();
  await weightField(page).fill("60");
  await stopwatch(page).click({ force: true }); // start series 1 → work
  await expect(stopwatch(page)).toBeVisible();

  await page.reload();

  // Resumes in the exercise (the stopwatch is present; the overview's Start is gone).
  await expect(stopwatch(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});
