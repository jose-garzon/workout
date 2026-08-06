import { expect, type Page, test } from "@playwright/test";

/**
 * Feature profile-page, "Editing the profile" + "Invalid input on the edit page"
 * end-to-end (tasks.md 8.1). Retargeted from the deleted drawer: editing is now
 * reached only through header → `/profile` → `/profile/edit`, Save returns to
 * `/profile`, and leaving without saving discards.
 *
 * Written RED-first — neither route exists yet, so every test here is expected
 * to FAIL until the two pages land.
 *
 * ── Names/URLs coined here for the designer to converge on ───────────────────
 *   - header entry:   role LINK, exact name "Profile"      (`common.profile.open`,
 *                     a next/link to /profile — design.md D6)
 *   - back control:   role LINK, exact name "Back"         (`common.back`, D9)
 *   - edit entry on /profile: role LINK, exact name "Edit profile"
 *                     (`profile.edit.cta`, links to /profile/edit)
 *   - edit page title: role heading "Edit your data"       (`profile.edit.title`,
 *                     unchanged from the drawer)
 *   - Save:           role button "Save"                   (unchanged)
 *   - fields:         onboarding's unit-aware labels, moved verbatim from the
 *                     drawer (`Your name`, `Age`, `Bodyweight (kg|lb)`,
 *                     `Height (cm|in)`, radios Male/Female/Other,
 *                     Metric/Imperial, Strength/…, radiogroup
 *                     "Training days per week" of radios "1".."7")
 *
 * Unit CONVERSION on toggle (kg↔lb) is unchanged by this change and is covered
 * by the ProfileEditScreen RTL test (tasks.md 4.4); what this spec still asserts
 * end-to-end is that the page opens pre-filled in the SAVED unit.
 *
 * Page titles are asserted with `.first()`: `AppShell` renders the screen title
 * as an sr-only `<h1>` and the page also renders a visible title, so the
 * accessible name legitimately matches twice.
 */

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

/** Home → profile page, through the header entry point (the only path). */
async function openProfile(page: Page) {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

/** Profile page → edit page. */
async function openEditPage(page: Page) {
  await page.getByRole("link", { name: "Edit profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(
    page.getByRole("heading", { name: "Edit your data" }).first(),
  ).toBeVisible();
}

test.describe("edit-profile", () => {
  test("header → /profile → /profile/edit → Save returns to /profile with the new name", async ({
    page,
  }) => {
    let aiCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/generate-routine")) aiCalled = true;
    });

    await completeOnboarding(page);
    await openProfile(page);
    await expect(page.getByText("Alex")).toBeVisible();

    await openEditPage(page);

    // Pre-filled from the saved records, in the saved unit (metric → kg only).
    await expect(page.getByLabel("Your name", { exact: false })).toHaveValue(
      "Alex",
    );
    await expect(
      page.getByRole("radio", { name: "Male", exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel("Age", { exact: false })).toHaveValue("28");
    await expect(page.getByRole("radio", { name: "Metric" })).toBeChecked();
    await expect(
      page.getByLabel("Bodyweight (kg)", { exact: false }),
    ).toHaveValue("80");
    await expect(
      page.getByLabel("Bodyweight (lb)", { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Strength" })).toBeChecked();
    await expect(
      page
        .getByRole("radiogroup", { name: "Training days per week" })
        .getByRole("radio", { name: "4", exact: true }),
    ).toBeChecked();

    await page.getByLabel("Your name", { exact: false }).fill("Sam");
    await page.getByLabel("Bodyweight (kg)", { exact: false }).fill("85");
    await page.getByRole("button", { name: "Save" }).click();

    // Lands back on the profile page, showing the updated name.
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText("Sam")).toBeVisible();

    // Persisted to IndexedDB — survives a full reload, and no network call.
    await page.reload();
    await expect(page.getByText("Sam")).toBeVisible();
    await openEditPage(page);
    await expect(
      page.getByLabel("Bodyweight (kg)", { exact: false }),
    ).toHaveValue("85");
    expect(aiCalled).toBe(false);
  });

  test("leaving the edit page via Back discards the edits and keeps the saved values", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);
    await openEditPage(page);

    await page.getByLabel("Your name", { exact: false }).fill("Temp");
    await page.getByRole("link", { name: "Back", exact: true }).click();

    // Back from the edit page lands on the profile page, nothing persisted.
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText("Alex")).toBeVisible();
    await expect(page.getByText("Temp")).toHaveCount(0);

    // Re-entering re-seeds from the saved records, not the abandoned edit.
    await openEditPage(page);
    await expect(page.getByLabel("Your name", { exact: false })).toHaveValue(
      "Alex",
    );
  });

  test("Save with a cleared required field blocks, indicates, and stays on the edit page", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openProfile(page);
    await openEditPage(page);

    await page.getByLabel("Bodyweight (kg)", { exact: false }).fill("");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/profile\/edit$/);
    await expect(page.getByText(/enter your bodyweight/i)).toBeVisible();

    // Nothing persisted — the profile page still shows the saved name.
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page.getByText("Alex")).toBeVisible();
  });
});
