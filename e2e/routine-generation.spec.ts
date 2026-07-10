import { expect, test } from "@playwright/test";

/**
 * Feature B end-to-end (tasks.md 9.4): onboarding → home → prompt → generating
 * (indicator + thinking) → routine summary → tap a day → workout mode, and the
 * routine survives a reload. The AI proxy is intercepted with a deterministic
 * SSE body so the flow never depends on a real OpenRouter call — the browser
 * still exercises the true stream-parse → validate → persist path.
 */

const ROUTINE = {
  name: "Push / Pull / Legs",
  subtitle: "Five days, no excuses.",
  days: [
    {
      name: "Push",
      exercises: [
        { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
      ],
    },
    {
      name: "Pull",
      exercises: [{ name: "Row", sets: [{ reps: 10, restSeconds: 90 }] }],
    },
  ],
};

function sseBody(): string {
  const json = JSON.stringify(ROUTINE);
  const event = (delta: object) =>
    `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
  return (
    event({ reasoning: "Planning a hypertrophy split" }) +
    event({ content: json }) +
    "data: [DONE]\n\n"
  );
}

async function completeOnboarding(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByLabel("Your name", { exact: false }).fill("Alex");
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

test("generate a routine, navigate to a day, and persist across reload", async ({
  page,
}) => {
  await completeOnboarding(page);

  // Intercept the proxy with a delayed SSE response so the in-flight UI is
  // observable before the routine resolves.
  await page.route("**/api/generate-routine", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(),
    });
  });

  await page
    .getByLabel("Describe the routine you want")
    .fill("push pull legs, chest priority");
  await page.getByRole("button", { name: "Build routine" }).click();

  // In-flight: the building indicator is shown.
  await expect(page.getByText("Building your routine…")).toBeVisible();

  // Success: the per-day summary appears and the subtitle drives the header.
  await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
  await expect(page.getByText("Five days, no excuses.")).toBeVisible();

  // Tapping a day opens workout mode (empty for now).
  await page.getByRole("link", { name: /Push/ }).click();
  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible();

  // The routine survives a reload (local-first persistence).
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Push/ })).toBeVisible();
});
