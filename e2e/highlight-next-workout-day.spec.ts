import { expect, type Page, test } from "@playwright/test";

/**
 * `highlight-next-workout-day` end-to-end — one test per acceptance criterion in
 * proposal.md.
 *
 * THESE ARE RED until the feature is built: home renders five identical `idle`
 * rows in routine order, so every `next` / `finished` assertion and every
 * reordering assertion fails today. That is the point — this file locks "done".
 *
 * SEEDING CONTRACT (design.md §"E2E seeding contract"): `cycleRepo` filters
 * `completedAt >= routine.createdAt`, so the seeded routine's `createdAt` is
 * fixed 30 days in the past while sessions are minutes old. Do NOT change it to
 * `Date.now()` — every session would be filtered out, the cycle would read
 * empty, and "fresh routine" would pass for the wrong reason. The regeneration
 * test inverts this deliberately.
 *
 * "The user completes day N" is seeded as the completed session that finishing
 * day N records; session recording is untouched by this change and is covered
 * end-to-end by `workout-mode.spec.ts`.
 *
 * EXCLUDED: "a week boundary does not reset anything" — `buildDayCards` takes no
 * clock or date input, so there is no boundary to roll; covered by unit test
 * (tasks.md 2.2) instead of clock mocking here.
 *
 * DESIGN-PROVIDED HOOK the designer must satisfy (state is asserted through the
 * accessible name, not CSS classes — spec `home-routine-dashboard`, "the `next`
 * card's accessible name identifies it as the next day; each `finished` card's
 * accessible name identifies it as completed"): the English copy behind
 * `routine.summary.state.next` contains "next", and `…state.finished` contains
 * "completed". `idle` cards carry neither word.
 */

const exercise = (name: string) => ({
  id: `ex-${name.toLowerCase()}`,
  name,
  sets: [{ reps: 8, restSeconds: 60 }],
});

const DAY_NAMES = ["Push", "Pull", "Legs", "Upper", "Core"];

const ROUTINE = {
  id: "active",
  name: "My Split",
  subtitle: "Move some weight.",
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  active: true,
  days: DAY_NAMES.map((name, i) => ({
    id: `day-${i + 1}`,
    name,
    exercises: [exercise(name)],
  })),
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

/** Completed sessions for the given day numbers, oldest → newest in that order. */
const completed = (...dayNumbers: number[]): Session[] =>
  dayNumbers.map((day, i) => ({
    id: `s${i}`,
    routineId: "active",
    dayId: `day-${day}`,
    completedAt: Date.now() - (dayNumbers.length - i) * 60_000,
    exerciseLogs: [],
  }));

async function seed(
  page: Page,
  opts: { sessions?: Session[]; routine?: typeof ROUTINE | null } = {},
) {
  const { sessions = [], routine = ROUTINE } = opts;
  await page.goto("/");
  // Wait for the app to have opened the Dexie DB and created its stores before
  // writing raw rows. That is the welcome "Start" on the FIRST seed; on a
  // re-seed inside a test a profile already exists, so home (with its week
  // strip) renders instead and "Start" never appears — either one proves the
  // stores are there.
  await page
    .locator('button:has-text("Start"), [data-testid="week-cell"]')
    .first()
    .waitFor({ timeout: 15000 });
  await page.evaluate(
    async ({ routine, profile, goals, sessions }) => {
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
      if (routine) tx.objectStore("routines").put(routine);
      for (const s of sessions) tx.objectStore("completedSessions").put(s);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { routine, profile: PROFILE, goals: GOALS, sessions },
  );
  // Reload so FirstRunGate's profile live-query renders home (not the welcome).
  await page.goto("/");
}

type DayState = "idle" | "next" | "finished";

/** Every day card, in list order. Every state stays a link to its own day. */
const cards = (page: Page) => page.locator('a[href^="/workout/"]');

/**
 * Assert the whole day list: `[day number, state]` in the order the cards must
 * appear. The number and href are asserted per card, so they stay tied to the
 * ROUTINE position and can never follow the list index.
 */
async function expectDayList(page: Page, rows: [number, DayState][]) {
  await expect(cards(page)).toHaveCount(rows.length);
  for (const [index, [day, state]] of rows.entries()) {
    const card = cards(page).nth(index);
    await expect(card).toHaveAttribute("href", `/workout/day-${day}`);
    await expect(card).toContainText(String(day).padStart(2, "0"));
    if (state === "idle") {
      await expect(card).not.toHaveAccessibleName(/next|completed/i);
    } else {
      await expect(card).toHaveAccessibleName(
        state === "next" ? /next/i : /completed/i,
      );
    }
  }
}

/**
 * Not an acceptance criterion — the guard for the seeding contract above, kept
 * because it is the one thing that can make every spec below lie. `cycleRepo`
 * drops sessions older than `routine.createdAt`; if that happens the cycle reads
 * empty, home shows day 1 as `next`, and "fresh routine" passes for the wrong
 * reason. Red here means the fixtures are broken, not the feature.
 */
test("seeding contract — every seeded session lands after the routine's createdAt", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3) });
  const seeded = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open("workout-pal");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction(["routines", "completedSessions"], "readonly");
    const read = <T>(req: IDBRequest<T>) =>
      new Promise<T>((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    const routine = await read(
      tx.objectStore("routines").get("active") as IDBRequest<{
        createdAt: number;
      }>,
    );
    const sessions = await read(
      tx.objectStore("completedSessions").getAll() as IDBRequest<
        { completedAt: number }[]
      >,
    );
    db.close();
    return { createdAt: routine.createdAt, sessions };
  });
  expect(seeded.sessions).toHaveLength(3);
  expect(
    seeded.sessions.filter((s) => s.completedAt >= seeded.createdAt),
  ).toHaveLength(3);
});

test("fresh routine — day 1 is next and first, nothing finished", async ({
  page,
}) => {
  await seed(page);
  await expectDayList(page, [
    [1, "next"],
    [2, "idle"],
    [3, "idle"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("finishing day 1 makes day 2 next and day 1 finished", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1) });
  await expectDayList(page, [
    [2, "next"],
    [1, "finished"],
    [3, "idle"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("mid-cycle — days 1,2,3 finished, day 4 next and first", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3) });
  await expectDayList(page, [
    [4, "next"],
    [1, "finished"],
    [2, "finished"],
    [3, "finished"],
    [5, "idle"],
  ]);
});

test("a newly generated routine starts a fresh cycle", async ({ page }) => {
  const sessions = completed(1, 2);
  await seed(page, { sessions });
  await expect(cards(page).first()).toHaveAttribute("href", "/workout/day-3");

  // The inversion of the seeding contract: the new routine is created AFTER the
  // existing sessions. Day ids are deliberately kept identical so the test can
  // only pass on the `completedAt >= createdAt` bound (design.md §D2) — every
  // row's `routineId` is the constant "active" and discriminates nothing.
  await seed(page, {
    sessions,
    routine: { ...ROUTINE, name: "Fresh Split", createdAt: Date.now() },
  });
  await expectDayList(page, [
    [1, "next"],
    [2, "idle"],
    [3, "idle"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("an edit keeps the cycle for the days that survive it", async ({
  page,
}) => {
  const sessions = completed(1, 2);
  await seed(page, { sessions });
  await expect(cards(page).first()).toHaveAttribute("href", "/workout/day-3");

  // What `assembleEditedRoutine` writes: same `createdAt`, same day ids, a
  // swapped exercise.
  const edited = {
    ...ROUTINE,
    days: ROUTINE.days.map((d) =>
      d.id === "day-3" ? { ...d, exercises: [exercise("Front Squat")] } : d,
    ),
  };
  await seed(page, { sessions, routine: edited });
  await expectDayList(page, [
    [3, "next"],
    [1, "finished"],
    [2, "finished"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("finishing the day that completes the set resets everything", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3, 4, 5) });
  await expectDayList(page, [
    [1, "next"],
    [2, "idle"],
    [3, "idle"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("re-finishing day 1 at 3/5 restarts the cycle from day 1", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3, 1) });
  await expectDayList(page, [
    [2, "next"],
    [1, "finished"],
    [3, "idle"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("re-finishing day 2 at 3/5 restarts the cycle from day 2", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3, 2) });
  await expectDayList(page, [
    [3, "next"],
    [1, "idle"],
    [2, "finished"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("next wins when the pointer wraps onto a finished day", async ({
  page,
}) => {
  await seed(page, { sessions: completed(1, 2, 3, 5) });
  await expectDayList(page, [
    [1, "next"],
    [2, "finished"],
    [3, "finished"],
    [4, "idle"],
    [5, "finished"],
  ]);
});

test("opening a day out of order changes nothing", async ({ page }) => {
  await seed(page, { sessions: completed(1, 2, 3) });
  await page.locator('a[href="/workout/day-2"]').click();
  await expect(page).toHaveURL("/workout/day-2");

  await page.goBack();
  await expectDayList(page, [
    [4, "next"],
    [1, "finished"],
    [2, "finished"],
    [3, "finished"],
    [5, "idle"],
  ]);
});

test("the cycle survives a reload", async ({ page }) => {
  await seed(page, { sessions: completed(1, 2) });
  await page.reload();
  await expectDayList(page, [
    [3, "next"],
    [1, "finished"],
    [2, "finished"],
    [4, "idle"],
    [5, "idle"],
  ]);
});

test("no routine, no day list and no states", async ({ page }) => {
  await seed(page, { routine: null, sessions: completed(1, 2) });
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /next|completed/i })).toHaveCount(
    0,
  );
});
