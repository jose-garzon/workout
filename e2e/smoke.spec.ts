import { expect, test } from "@playwright/test";

test("home route loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "workout-pal" }),
  ).toBeVisible();
});

test("serves the PWA manifest", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = (await res.json()) as { name: string; display: string };
  expect(manifest.name).toBe("workout-pal");
  expect(manifest.display).toBe("standalone");
});
