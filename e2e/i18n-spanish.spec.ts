import { expect, type Page, test } from "@playwright/test";

/**
 * i18n-spanish-support — Story 4 end to end, in the `spanish` Playwright project
 * (`locale: "es-ES"`, see playwright.config.ts). Load → onboard → generate a
 * routine → open workout mode, with every assertion in Spanish.
 *
 * Two guards ride along:
 *  - `<html lang>` is `es` before/after hydration (design §Decision 4).
 *  - Any console error fails the run. A component that renders `t()` on the
 *    server would flash English and log a hydration mismatch — a console error
 *    is how that standing invariant is caught (design §Decision 4, task 10.3).
 *
 * The AI proxy is intercepted with a deterministic SSE body containing a
 * SPANISH routine, mirroring what the model returns once the request carries
 * `language` (§Decision 5) — the browser still runs the real stream-parse →
 * validate → persist path.
 *
 * The Spanish strings asserted here are the contract for `es.json`; keep the
 * dictionary and this spec in step.
 */

const ROUTINE = {
  name: "Empuje / Tirón / Pierna",
  subtitle: "Cinco días, sin excusas.",
  days: [
    {
      name: "Empuje",
      exercises: [
        { name: "Press de banca", sets: [{ reps: 8, restSeconds: 120 }] },
      ],
    },
    {
      name: "Tirón",
      exercises: [{ name: "Remo", sets: [{ reps: 10, restSeconds: 90 }] }],
    },
  ],
};

function sseBody(): string {
  const json = JSON.stringify(ROUTINE);
  const event = (delta: object) =>
    `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
  return (
    event({ reasoning: "Planificando una rutina de hipertrofia" }) +
    event({ content: json }) +
    "data: [DONE]\n\n"
  );
}

/**
 * Collect every console error and uncaught page error. Asserted empty at the
 * end of the test — a server-rendered `t()` shows up here as a React hydration
 * mismatch.
 */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Empezar" }).click();

  await page.getByLabel("Tu nombre", { exact: false }).fill("Alex");
  await page.getByRole("radio", { name: "Hombre", exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Edad", { exact: false }).fill("28");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Peso corporal (kg)", { exact: false }).fill("80");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("radio", { name: "Fuerza", exact: true }).click();
  const increase = page.getByRole("button", { name: /^Aumentar/ });
  for (let i = 0; i < 4; i++) await increase.click();
  await page.getByRole("button", { name: "Finalizar" }).click();

  await expect(page.getByRole("heading", { name: /Hola, Alex/ })).toBeVisible();
}

test("the whole experience is Spanish: onboarding → generation → workout mode", async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang))
    .toBe("es");

  await completeOnboarding(page);

  // The generate request carries the active language (AC3.1); the proxy is
  // stubbed with a Spanish routine (AC3.2).
  let requestedLanguage: unknown;
  await page.route("**/api/generate-routine", async (route) => {
    requestedLanguage = route.request().postDataJSON()?.language;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(),
    });
  });

  await page
    .getByLabel("Describe la rutina que quieres")
    .fill("empuje tirón pierna, prioridad pecho");
  await page.getByRole("button", { name: "Crear mi rutina" }).click();

  // In-flight copy is Spanish.
  await expect(page.getByText(/Creando tu rutina/)).toBeVisible();

  // Success: the Spanish routine is adopted and rendered.
  await expect(page.getByRole("link", { name: /Empuje/ })).toBeVisible();
  await expect(page.getByText("Cinco días, sin excusas.")).toBeVisible();
  expect(requestedLanguage).toBe("es");

  // Workout mode: the shell title is Spanish and the exercise came back Spanish.
  await page.getByRole("link", { name: /Empuje/ }).click();
  await expect(
    page.getByRole("heading", { name: "Entrenamiento" }),
  ).toBeVisible();
  await expect(page.getByText("Press de banca")).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();

  // Still Spanish after a client-side navigation + the document language holds.
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  expect(consoleErrors).toEqual([]);
});
