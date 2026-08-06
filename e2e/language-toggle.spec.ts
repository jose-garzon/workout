import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Feature profile-page, "Language selection" end-to-end (tasks.md 8.2, retargeted
 * at the two-state toggle by 11.2), in the DEFAULT `chromium` project — i.e. an
 * English browser. The existing `i18n-spanish.spec.ts` (project `spanish`,
 * `locale: "es-ES"`) is untouched and still proves detection-without-a-choice;
 * this one proves a stored CHOICE beats the browser's preferred language.
 *
 * ── The contract asserted here (design.md D15) ───────────────────────────────
 *   - language toggle: a plain <button> (no `role="switch"`, no <select> and no
 *                      options list) whose VISIBLE text is the ACTIVE language
 *                      (`common.language.en` / `.es`) and whose accessible name
 *                      states the ACTION — the language it switches TO
 *                      (`common.language.toEnglish` / `.toSpanish`)
 *   - page title:      role heading "Profile" / "Perfil" (`profile.title`)
 *
 * The toggle is located by its visible label, so this stays independent of the
 * exact aria-label wording; only the *target language* inside that name is
 * asserted. The "switched immediately" assertion likewise leans on an EXISTING
 * dictionary entry (`common.theme.dark`: "Dark" / "Oscuro").
 */

// Playwright's default is `colorScheme: "light"`, which the app correctly
// resolves to the LIGHT theme (design-system.md §2: explicit `light` wins, and
// only dark/no-preference fall through to the dark default). Pin the preference
// so the toggle's label is the dark-theme one and this stays a LANGUAGE test.
test.use({ colorScheme: "dark" });

/**
 * The language toggle, by its visible state label: "English" while English is
 * active (English dictionary) and "Español" once Spanish is (Spanish
 * dictionary). Its accessible name is the ACTION, so `getByRole(…, { name })`
 * would match the target language instead — hence the text filter.
 */
function languageToggle(page: Page): Locator {
  return page.getByRole("button").filter({ hasText: /^(English|Español)$/ });
}

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

test("switching to Spanish flips the UI at once and survives a reload in an English browser", async ({
  page,
}) => {
  await completeOnboarding(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);

  // No choice yet → the toggle shows the browser-detected language, and its
  // accessible name offers the other one.
  const toggle = languageToggle(page);
  await expect(toggle).toHaveText("English");
  await expect(toggle).toHaveAttribute("aria-label", /spanish/i);
  await expect(page.getByRole("switch")).toHaveText("Dark");

  await toggle.click();

  // Switches with no reload, and the document language follows.
  await expect(toggle).toHaveText("Español");
  await expect(toggle).toHaveAttribute("aria-label", /ingl[eé]s/i);
  await expect(page.getByRole("switch")).toHaveText("Oscuro");
  await expect(
    page.getByRole("heading", { name: "Perfil" }).first(),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  // The choice is stored on-device and beats the English browser after a reload.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(languageToggle(page)).toHaveText("Español");
  await expect(page.getByRole("switch")).toHaveText("Oscuro");
});
