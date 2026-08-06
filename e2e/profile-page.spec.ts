import { expect, type Page, test } from "@playwright/test";

/**
 * Feature profile-page end-to-end: the header entry point, the profile page's
 * contents, going back, the drawer's removal, and the theme toggle's new home.
 *
 * Updated for the design rework (design.md D11–D17): the name is hero content
 * with a goal badge under it, the edit entry is a list card rather than an
 * accent CTA, and the header profile link hides itself on `/profile*`.
 *
 * ── The contract asserted here ───────────────────────────────────────────────
 *   - header entry:    role LINK, exact name "Profile"   (`common.profile.open`)
 *                      — absent on /profile and /profile/edit (D14)
 *   - back control:    role LINK, exact name "Back"      (`common.back`)
 *   - edit entry:      role LINK, exact name "Edit profile" (`profile.edit.cta`)
 *                      inside a one-item list (D16)
 *   - goal badge:      the focus label, e.g. "Strength"  (`home.goal.strength`)
 *   - page title:      role heading "Profile"            (`profile.title`)
 *   - theme toggle:    role SWITCH (unchanged control, moved to /profile) —
 *                      "no theme toggle here" is asserted as "no role=switch"
 *   - language toggle: role BUTTON showing the ACTIVE language (D15); see
 *                      `e2e/language-toggle.spec.ts` for its behaviour
 *
 * Page titles are asserted with `.first()`: `AppShell` renders the screen title
 * as an sr-only `<h1>` and the page also renders a visible title, so the
 * accessible name legitimately matches twice.
 */

// Playwright's default is `colorScheme: "light"`, which the app correctly
// resolves to the LIGHT theme (design-system.md §2: explicit `light` wins, and
// only dark/no-preference fall through to the dark default). Pin the preference
// so the relocated toggle starts from the documented dark default.
test.use({ colorScheme: "dark" });

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByLabel("Your name", { exact: false }).fill("Alex");
  // exact:true — a substring match on "Male" also hits "Female".
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Age", { exact: false }).fill("28");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Bodyweight (kg)", { exact: false }).fill("80");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "Strength" }).click();
  const increase = page.getByRole("button", {
    name: "Increase Training days per week",
  });
  for (let i = 0; i < 4; i++) await increase.click();
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page.getByRole("heading", { name: /Hey, Alex/ })).toBeVisible();
}

async function openProfile(page: Page) {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

test.describe("profile-page", () => {
  test("the header shows a profile entry instead of the theme toggle, and it opens /profile", async ({
    page,
  }) => {
    await completeOnboarding(page);

    const entry = page.getByRole("link", { name: "Profile", exact: true });
    await expect(entry).toBeVisible();
    // The theme toggle is gone from the header (and from home entirely).
    await expect(page.getByRole("switch")).toHaveCount(0);

    await entry.click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole("heading", { name: "Profile" }).first(),
    ).toBeVisible();
  });

  test("the header profile link is hidden on the profile pages themselves", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);

    const entry = page.getByRole("link", { name: "Profile", exact: true });
    await expect(entry).toHaveCount(0);

    await page.getByRole("link", { name: "Edit profile", exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/edit$/);
    await expect(entry).toHaveCount(0);

    // …and it comes back on every other screen.
    await page.goto("/");
    await expect(entry).toBeVisible();
  });

  test("the profile page stacks title, name, goal badge and edit card from the top", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);

    // Level 2 — `AppShell`'s sr-only `<h1>` carries the same name (D11).
    const title = page.getByRole("heading", { name: "Profile", level: 2 });
    const name = page.getByText("Alex", { exact: true });
    // The same badge home shows — onboarding above picked the Strength focus.
    const badge = page.getByText("Strength", { exact: true });
    const card = page.getByRole("link", { name: "Edit profile", exact: true });

    for (const item of [title, name, badge, card]) {
      await expect(item).toBeVisible();
    }

    // Order from the top: title row → name → badge → card.
    const boxes: { y: number }[] = [];
    for (const item of [title, name, badge, card]) {
      const box = await item.boundingBox();
      if (!box) throw new Error("profile content not laid out");
      boxes.push(box);
    }
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
    }

    // The edit entry is a list card (design.md D16), not the old accent CTA:
    // one item in one list, and the section is the only card that ships.
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("listitem").getByRole("link")).toHaveText(
      "Edit profile",
    );
  });

  test("the settings row holds exactly two controls, side by side at 50% each", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);

    // Exactly the theme toggle + the language toggle, side by side, each half
    // the row. Equal widths on a shared baseline is the observable form of
    // "50% each" (the row's own width is their sum + gap).
    const theme = page.getByRole("switch");
    // By visible label, not by accessible name: the language toggle's name is
    // the ACTION it performs (design.md D15) — see `e2e/language-toggle.spec.ts`.
    const language = page.getByRole("button").filter({ hasText: "English" });
    await expect(theme).toHaveCount(1);
    await expect(language).toHaveCount(1);

    const themeBox = await theme.boundingBox();
    const languageBox = await language.boundingBox();
    if (!themeBox || !languageBox) throw new Error("settings row not laid out");
    expect(Math.abs(themeBox.width - languageBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(themeBox.y - languageBox.y)).toBeLessThanOrEqual(4);
  });

  test("back from the profile page goes home", async ({ page }) => {
    await completeOnboarding(page);
    await openProfile(page);

    await page.getByRole("link", { name: "Back", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Hey, Alex/ }),
    ).toBeVisible();
  });

  test("no profile drawer is reachable and home has no edit-profile control", async ({
    page,
  }) => {
    await completeOnboarding(page);

    // Home: no drawer, no edit-profile affordance of any kind.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Edit your data")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /edit profile/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /edit profile/i })).toHaveCount(
      0,
    );

    // The one path to the form is header → /profile → /profile/edit, and it
    // navigates rather than opening an overlay.
    await openProfile(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("link", { name: "Edit profile", exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/edit$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the theme toggle lives only on the profile page, and the choice still survives a reload with no flash", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);

    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // No flash: the inline <head> script has already applied the stored theme
    // by the time the document is parsed, before React hydrates.
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe("light");

    // …and nowhere else offers the toggle.
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("switch")).toHaveCount(0);
  });
});
