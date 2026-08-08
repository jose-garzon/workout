import { expect, type Page, test } from "@playwright/test";
import en from "../src/shared/i18n/en.json" with { type: "json" };

/**
 * pwa-install-banner end to end (design.md §D8) — the banner's four states, the
 * declined-prompt fallback, the empty home, and "home only". Three fixtures
 * carry this file:
 *
 *  1. FIXTURE — Playwright's Chromium NEVER fires `beforeinstallprompt` (it has
 *     no install service in automation). That is what makes a plain visit to
 *     home the generic `manual` case, and it is why the `native` case dispatches
 *     a synthetic event instead. If a future Chromium starts firing it for real,
 *     the `manual` test below fails loudly rather than confusingly.
 *  2. Every case seeds a profile first: home sits behind `FirstRunGate`, which
 *     renders `WelcomeFlow` when no profile exists — and most cases here assert
 *     ABSENCE, so unseeded they would pass against the wrong screen. `seed()`
 *     therefore ends by asserting the greeting is on screen.
 *  3. The banner is a `<section aria-label={t("install.title")}>` with the title
 *     as a `<p>`, NOT a heading (design §D7) — so it is located by role `region`
 *     + accessible name, never by heading role.
 *
 * The `install.*` strings are read straight out of `en.json` rather than
 * duplicated as literals here, so the spec cannot drift from the dictionary.
 */

/** An iPhone Safari UA — the `ios` branch is platform-sniffed (design §D4). */
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

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
          sets: [{ reps: 8, restSeconds: 3 }],
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

/**
 * The dictionary value for a key, falling back to the key itself while the
 * `install.*` strings are still unwritten (task 2.1, designer): a missing key
 * then reads as "install.title", which matches nothing, so the failure is a
 * clean "banner not found".
 */
const s = (key: string): string => (en as Record<string, string>)[key] ?? key;

const banner = (page: Page) =>
  page.getByRole("region", { name: s("install.title") });

/**
 * Seed the Dexie-created stores via raw IndexedDB, then land on home.
 * `withRoutine: false` covers the empty-home case — the banner must not depend
 * on a routine existing.
 */
async function seed(page: Page, { withRoutine = true } = {}) {
  await page.goto("/");
  // The welcome "Start" only renders after FirstRunGate's profile live-query
  // has run — which is what opens the Dexie DB and creates its object stores.
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
      if (routine) tx.objectStore("routines").put(routine);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { routine: withRoutine ? ROUTINE : null, profile: PROFILE, goals: GOALS },
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hey, Alex/ })).toBeVisible();
}

/** The synthetic `beforeinstallprompt` from design §D8. */
async function fireBeforeInstallPrompt(
  page: Page,
  outcome: "accepted" | "dismissed" = "accepted",
) {
  await page.evaluate((choice) => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: string }>;
    };
    event.prompt = () => {
      (window as unknown as { __promptCalled?: boolean }).__promptCalled = true;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: choice });
    window.dispatchEvent(event);
  }, outcome);
}

test("no native prompt, not iOS: generic banner with no install button", async ({
  page,
}) => {
  await seed(page);

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(s("install.description.manual"));
  await expect(banner(page).getByRole("button")).toHaveCount(0);
});

test.describe("iOS", () => {
  test.use({ userAgent: IPHONE_UA });

  test("names the Share menu and Add to Home Screen, with no button", async ({
    page,
  }) => {
    await seed(page);

    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText(s("install.description.ios"));
    await expect(banner(page)).toContainText(/Share/i);
    await expect(banner(page)).toContainText(/Add to Home Screen/i);
    await expect(banner(page).getByRole("button")).toHaveCount(0);
  });
});

test("a native prompt adds an install button that triggers the browser flow", async ({
  page,
}) => {
  await seed(page);
  await fireBeforeInstallPrompt(page);

  const install = banner(page).getByRole("button", { name: s("install.cta") });
  await expect(install).toBeVisible();
  await install.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __promptCalled?: boolean }).__promptCalled,
      ),
    )
    .toBe(true);
});

test("declining the native prompt drops the button and falls back to manual copy", async ({
  page,
}) => {
  await seed(page);
  await fireBeforeInstallPrompt(page, "dismissed");

  await banner(page)
    .getByRole("button", { name: s("install.cta") })
    .click();

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(s("install.description.manual"));
  await expect(banner(page).getByRole("button")).toHaveCount(0);
});

test("the banner shows on an empty home, before any routine exists", async ({
  page,
}) => {
  await seed(page, { withRoutine: false });

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(s("install.description.manual"));
});

test("the banner disappears when the install completes, with no reload", async ({
  page,
}) => {
  await seed(page);
  await fireBeforeInstallPrompt(page);
  await expect(banner(page)).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));

  await expect(banner(page)).toHaveCount(0);
});

test("no banner when the app runs standalone", async ({ page }) => {
  await seed(page);
  // Positive control: `hidden` also means "not yet detected", so a bare absence
  // assertion would pass on a thrown hook or a failed seed (design §D8).
  await expect(banner(page)).toBeVisible();

  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    // Every non-display-mode query MUST delegate: the no-flash theme script
    // queries `prefers-color-scheme` in this same document.
    window.matchMedia = (query: string) =>
      query.includes("display-mode")
        ? ({
            matches: query.includes("standalone"),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList)
        : real(query);
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: /Hey, Alex/ })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("the banner is home only: not in workout mode, not on the profile page", async ({
  page,
}) => {
  await seed(page);

  await page.goto(`/workout/${DAY_ID}`);
  await expect(page.getByText("Bench Press")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Profile" }).first(),
  ).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
