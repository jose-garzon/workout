import { expect, type Page, test } from "@playwright/test";

/**
 * Feature C (consistency-calendar) end-to-end — one test per acceptance criterion
 * (proposal.md AC1.1–1.4, AC1b.1–1b.3, AC2.1–2.6).
 *
 * THESE ARE RED until the calendar feature is built (see tasks.md). Home does not
 * yet render the week strip, so every assertion here fails today — that is the
 * point: this file locks "done" for the build phase.
 *
 * Seeding copies workout-mode.spec.ts exactly: goto("/"), wait for the welcome
 * "Start" (which opens the Dexie DB + creates its stores), then raw-IndexedDB
 * `put` rows. Sessions are seeded with `completedAt <= now` because the repo's
 * range read is `[lower, now]` (design.md §2) — a future timestamp would be
 * filtered out and make the test non-deterministic by run-day.
 *
 * DESIGN-PROVIDED HOOKS the designer must expose (colors are too brittle to
 * assert on — design.md §6 note):
 *   - each week-strip cell: data-testid="week-cell", data-date="yyyy-mm-dd" (local),
 *     data-worked="true|false"; the cell shows only the day label ("Mon 10") —
 *     the session name is NOT rendered on the strip (design change).
 *   - the strip is a <button> with accessible name matching /activity tracker/i.
 *   - each real year-grid square: data-testid="year-day", data-date, data-worked;
 *     pad cells carry no data-date.
 *   - the year grid container: data-testid="year-grid".
 *   - the drawer: role="dialog", entrance animation class /anim-(rise|fade)/,
 *     a close control (accessible name /close/i), backdrop data-testid="drawer-backdrop".
 */

// --- routine: 4 named days → weekly target M = 4 -----------------------------
const day = (id: string, name: string) => ({
  id,
  name,
  exercises: [
    { id: `${id}-ex`, name: "Squat", sets: [{ reps: 8, restSeconds: 60 }] },
  ],
});

const ROUTINE = {
  id: "active",
  name: "My Split",
  subtitle: "Move some weight.",
  createdAt: Date.now(),
  active: true,
  days: [
    day("day-lower-a", "Lower A"),
    day("day-push", "Push"),
    day("day-pull", "Pull"),
    day("day-lower-b", "Lower B"),
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

type Session = {
  id: string;
  routineId: string;
  dayId: string;
  completedAt: number;
  exerciseLogs: unknown[];
};
const session = (id: string, dayId: string, completedAt: number): Session => ({
  id,
  routineId: "active",
  dayId,
  completedAt,
  exerciseLogs: [],
});

// --- deterministic dates (local time, Monday-start week) ---------------------
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Monday 00:00 local of the current week (ISO week, Monday-start). */
function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const shift = d.getDay() === 0 ? -6 : 1 - d.getDay(); // Sun→-6, else back to Mon
  d.setDate(d.getDate() + shift);
  return d;
}

/** A day of the current week at noon (offset 0 = Monday … 6 = Sunday). */
function dayInWeek(offset: number): Date {
  const d = mondayOfThisWeek();
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d;
}

const daysInYear = (y: number) =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;

// --- seeding -----------------------------------------------------------------
async function seed(
  page: Page,
  opts: { sessions?: Session[]; withRoutine?: boolean } = {},
) {
  const { sessions = [], withRoutine = true } = opts;
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 15000 });
  await page.evaluate(
    async ({ routine, profile, goals, sessions, withRoutine }) => {
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
      if (withRoutine) tx.objectStore("routines").put(routine);
      for (const s of sessions) tx.objectStore("completedSessions").put(s);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { routine: ROUTINE, profile: PROFILE, goals: GOALS, sessions, withRoutine },
  );
  // Reload so FirstRunGate's profile live-query renders home (not the welcome).
  await page.goto("/");
}

const strip = (page: Page) =>
  page.getByRole("button", { name: /activity tracker/i });
const dialog = (page: Page) => page.getByRole("dialog");

// A session a few minutes ago (safely <= now, same local day as "today").
const nowMinus = (min: number) => Date.now() - min * 60_000;
const todayIso = () => isoLocal(new Date());

// ---------------------------------------------------------------------------
// Story 1 — glance at this week
// ---------------------------------------------------------------------------

test("AC1.1 — a 7-cell week strip renders on home", async ({ page }) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  // Positional "between identity and routine summary" is owned by the app slot
  // (design.md §1) and not asserted here to avoid coupling to other features'
  // markup — presence of the 7 cells is the core strip assertion.
  await expect(page.getByTestId("week-cell")).toHaveCount(7);
});

test("AC1.2 — worked day is accent (worked); the strip shows no session name", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-lower-a", nowMinus(5))] });
  const cell = page.locator(
    `[data-testid="week-cell"][data-date="${todayIso()}"]`,
  );
  await expect(cell).toHaveAttribute("data-worked", "true");
  // Session name is no longer rendered on the strip (design change) — the cell
  // shows only the day label. The dayId→name join stays covered by unit tests.
  await expect(cell).not.toContainText("Lower A");
});

test("AC1.3 — un-worked day is a muted placeholder with no session name", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  // Only today is worked; pick any other in-week day (guaranteed un-worked).
  const monday = dayInWeek(0);
  const targetIso =
    isoLocal(monday) === todayIso() ? isoLocal(dayInWeek(6)) : isoLocal(monday);
  const cell = page.locator(
    `[data-testid="week-cell"][data-date="${targetIso}"]`,
  );
  await expect(cell).toHaveAttribute("data-worked", "false");
  await expect(cell).not.toContainText("Push");
});

test("AC1.4 — two sessions one day render a single worked cell", async ({
  page,
}) => {
  await seed(page, {
    sessions: [
      session("s-early", "day-push", nowMinus(10)), // earlier
      session("s-late", "day-pull", nowMinus(5)), // later
    ],
  });
  const cell = page.locator(
    `[data-testid="week-cell"][data-date="${todayIso()}"]`,
  );
  await expect(cell).toHaveCount(1);
  await expect(cell).toHaveAttribute("data-worked", "true");
  // The strip no longer shows session names (design change), so the
  // "most-recent name wins" behavior is now exercised only by the unit tests
  // (model.test.ts / useCalendar.test.tsx). Here we assert the day is worked.
});

// ---------------------------------------------------------------------------
// Story 1b — am I on target this week?
// ---------------------------------------------------------------------------

test('AC1b.1 — "N of M this week" counter shows with the strip', async ({
  page,
}) => {
  // One distinct worked day this week, routine M = 4 → "1 of 4 this week".
  // (Exactly one day keeps N deterministic on any run-day: only today is
  // guaranteed to be both in-week and <= now.)
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await expect(page.getByText(/1 of 4 this week/i)).toBeVisible();
});

test("AC1b.2 — a second session on an already-worked day does not raise N", async ({
  page,
}) => {
  // Two sessions on the SAME day (today) → still 1 distinct worked day.
  await seed(page, {
    sessions: [
      session("s1", "day-push", nowMinus(10)),
      session("s2", "day-pull", nowMinus(5)),
    ],
  });
  await expect(page.getByText(/1 of 4 this week/i)).toBeVisible();
  await expect(page.getByText(/2 of 4 this week/i)).toHaveCount(0);
  // NOTE: the "N increases by one on a NEW worked day" direction is covered by
  // the unit/integration tests (design.md §8) — e2e cannot deterministically
  // place two distinct past-days inside the current week on every run-day, and
  // a raw-IndexedDB write does not trigger Dexie's liveQuery for a live update.
});

test("AC1b.3 — no active routine hides the counter", async ({ page }) => {
  await seed(page, {
    withRoutine: false,
    sessions: [session("s1", "day-push", nowMinus(5))],
  });
  await expect(page.getByTestId("week-cell")).toHaveCount(7); // strip still renders
  await expect(page.getByText(/this week/i)).toHaveCount(0); // counter hidden
});

// ---------------------------------------------------------------------------
// Story 2 — see the whole year
// ---------------------------------------------------------------------------

test('AC2.1 — tapping the strip opens the "Activity tracker" drawer + grid', async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByText("Activity tracker")).toBeVisible();
  await expect(page.getByTestId("year-grid")).toBeVisible();
});

test("AC2.2 — year grid runs Jan 1 → Dec 31 of the current year", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await strip(page).click();
  const year = new Date().getFullYear();
  const squares = page.locator('[data-testid="year-day"][data-date]'); // pad cells have no data-date
  await expect(squares).toHaveCount(daysInYear(year));
  await expect(squares.first()).toHaveAttribute("data-date", `${year}-01-01`);
  await expect(squares.last()).toHaveAttribute("data-date", `${year}-12-31`);
  // Rows-of-7 layout is visual (CSS grid); the day count + first/last dates are
  // the stable proxy for "vertical grid, Jan→Dec, one square per day".
});

test("AC2.3 — worked days are accent, every other day muted, in the grid", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await strip(page).click();
  const worked = page.locator('[data-testid="year-day"][data-worked="true"]');
  await expect(worked).toHaveCount(1); // exactly the one seeded day
  await expect(
    page.locator(`[data-testid="year-day"][data-date="${todayIso()}"]`),
  ).toHaveAttribute("data-worked", "true");
});

test("AC2.4 — the drawer animates in (entrance animation class present)", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();
  // "after an animation, not an instant appearance": assert the entrance
  // animation class the design applies (design.md §6, anim-rise/anim-fade).
  await expect(dialog(page)).toHaveClass(/anim-(rise|fade)/);
});

test("AC2.5 — the drawer animates out (not removed synchronously)", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();

  await page.getByRole("button", { name: /close/i }).click();
  // Still mounted immediately after dismiss (exit animation running) — a
  // synchronous unmount would fail this and break AC2.5.
  await expect(dialog(page)).toBeVisible();
  // Then it detaches once the exit animation ends.
  await expect(dialog(page)).toHaveCount(0);
});

test("AC2.6 — the drawer dismisses via backdrop, close control, and Esc", async ({
  page,
}) => {
  await seed(page, { sessions: [session("s1", "day-push", nowMinus(5))] });

  // Esc
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  // Close control
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.getByRole("button", { name: /close/i }).click();
  await expect(dialog(page)).toHaveCount(0);

  // Backdrop
  await strip(page).click();
  await expect(dialog(page)).toBeVisible();
  // Click the top-left corner of the scrim — the panel is centered, so the
  // corner is always clear of it. A default center-click would land on the
  // panel (which correctly ignores it: dismiss only fires on scrim hits).
  await page.getByTestId("drawer-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(dialog(page)).toHaveCount(0);

  // Home is interactive again — the strip can be re-opened.
  await expect(strip(page)).toBeEnabled();
});
