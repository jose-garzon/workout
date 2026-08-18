import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * `clock-button-empty-field-error` acceptance criteria, one test each: a tap on
 * the clock with an empty reps/weight field must name the missing field(s)
 * instead of doing nothing. Seeding + navigation mirror `workout-mode.spec.ts`.
 */

const DAY_ID = "day-1";

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

/** The stopwatch button, found by the phase word it always renders inside. */
const stopwatch = (page: Page) =>
  page.getByRole("button").filter({ hasText: /^(Ready|Work|Rest|Overtime)/ });

/** The muted hint in the stopwatch's message slot, below the circle. */
const startHint = (page: Page) =>
  stopwatch(page).locator("xpath=following-sibling::div//p");

/* Located by role, not `getByLabel`: a completed set's cell carries an
   aria-label naming its reps, which a label lookup would also match. */
const repsField = (page: Page) => page.getByRole("textbox", { name: "Reps" });
const weightField = (page: Page) =>
  page.getByRole("textbox", { name: "Weight for this set" });

/**
 * A blocked clock must still accept the tap. `force` skips Playwright's
 * actionability wait, which counts `aria-disabled="true"` as "not enabled" — but
 * it does NOT rescue a natively `disabled` button: the browser dispatches no
 * click event for one, so this still fails if the attribute comes back.
 */
const tapClock = (page: Page) =>
  stopwatch(page).click({ force: true, timeout: 5000 });

/** Seeded session, first set armed, reps prefilled from the plan, weight empty. */
async function armedSet(page: Page) {
  await seed(page);
  await page.goto(`/workout/${DAY_ID}`);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(repsField(page)).toHaveValue("8");
}

async function expectErrored(page: Page, field: Locator) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const messageId = await field.getAttribute("aria-describedby");
  expect(messageId).toBeTruthy();
  const message = page.locator(`#${messageId}`);
  await expect(message).toHaveRole("alert");
  await expect(message).toBeVisible();
}

async function expectNotErrored(field: Locator) {
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
}

const expectNoSetStarted = (page: Page) =>
  expect(stopwatch(page)).toContainText("Ready");

test("empty reps blocks the set, errors reps only, and focuses it", async ({
  page,
}) => {
  await armedSet(page);
  await weightField(page).fill("60");
  await repsField(page).fill("");

  await tapClock(page);

  await expectErrored(page, repsField(page));
  await expectNotErrored(weightField(page));
  await expect(repsField(page)).toBeFocused();
  await expectNoSetStarted(page);
});

test("empty weight blocks the set, errors weight only, and focuses it", async ({
  page,
}) => {
  await armedSet(page);

  await tapClock(page);

  await expectErrored(page, weightField(page));
  await expectNotErrored(repsField(page));
  await expect(weightField(page)).toBeFocused();
  await expectNoSetStarted(page);
});

test("both fields empty: both error, focus goes to reps", async ({ page }) => {
  await armedSet(page);
  await repsField(page).fill("");

  await tapClock(page);

  await expectErrored(page, repsField(page));
  await expectErrored(page, weightField(page));
  await expect(repsField(page)).toBeFocused();
  await expectNoSetStarted(page);
});

test("tapping again without filling keeps the errors and refocuses reps", async ({
  page,
}) => {
  await armedSet(page);
  await repsField(page).fill("");
  await tapClock(page);
  await weightField(page).focus();

  await tapClock(page);

  await expectErrored(page, repsField(page));
  await expectErrored(page, weightField(page));
  await expect(repsField(page)).toBeFocused();
});

test("typing in an errored field clears only that field's error", async ({
  page,
}) => {
  await armedSet(page);
  await repsField(page).fill("");
  await tapClock(page);

  await repsField(page).fill("10");

  await expectNotErrored(repsField(page));
  await expectErrored(page, weightField(page));
});

test("re-emptying a filled field does not re-error it until the next tap", async ({
  page,
}) => {
  await armedSet(page);
  await repsField(page).fill("");
  await tapClock(page);
  await expectErrored(page, repsField(page));

  await repsField(page).fill("10");
  await repsField(page).fill("");

  await expectNotErrored(repsField(page));
});

test("a newly armed set carries no error over", async ({ page }) => {
  await armedSet(page);
  await tapClock(page);
  await expectErrored(page, weightField(page));

  await weightField(page).fill("60");
  await tapClock(page); // ready → work (set 1)
  // Each phase is awaited before the next tap so a failure points at the tap
  // that actually broke.
  await expect(stopwatch(page)).toContainText("Work");
  await stopwatch(page).click({ force: true }); // work → rest
  await expect(page.getByText(/Time.?s up/i)).toBeVisible({ timeout: 8000 });
  await stopwatch(page).click({ force: true }); // overtime → ready (set 2)

  await expect(stopwatch(page)).toContainText("Ready");
  await expect(stopwatch(page)).toContainText("Set 2 of 2");
  await expectNotErrored(repsField(page));
  await expectNotErrored(weightField(page));
});

/** REGRESSION GUARD — passes today and must keep passing. */
test("both fields filled: the set starts with no error", async ({ page }) => {
  await armedSet(page);
  await weightField(page).fill("60");

  await tapClock(page);

  await expect(stopwatch(page)).toContainText("Work");
  await expectNotErrored(repsField(page));
  await expectNotErrored(weightField(page));
});

test("the blocked clock is aria-disabled, not natively disabled, and tabbable", async ({
  page,
}) => {
  await armedSet(page);

  await expect(stopwatch(page)).toHaveAttribute("aria-disabled", "true");
  await expect(stopwatch(page)).not.toHaveAttribute("disabled");

  await weightField(page).focus();
  await page.keyboard.press("Tab");
  await expect(stopwatch(page)).toBeFocused();
});

test("the hint under the clock names both reps and weight", async ({
  page,
}) => {
  await armedSet(page);

  await expect(startHint(page)).toBeVisible();
  await expect(startHint(page)).toContainText(/rep/i);
  await expect(startHint(page)).toContainText(/weight/i);
});
