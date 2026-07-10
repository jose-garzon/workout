import { expect, test } from "@playwright/test";

/**
 * PWA offline baseline (tasks 7.2 / 7.3). Warm the service-worker cache with an
 * online load, then drop the network and assert the shell + data screens still
 * render (all data is local IndexedDB) — only generation needs the network.
 *
 * Foundation: the app shell is the only screen that exists yet, so this asserts
 * the shell survives offline. Feature changes extend this with the data screens
 * and the offline generation-error assertion.
 */
test("app shell is usable offline after the service worker caches it", async ({
  page,
  context,
}) => {
  // 1. Online: register + let the service worker precache the shell.
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker?.ready;
  });

  // 2. Go offline and reload — the shell must come from the SW cache.
  await context.setOffline(true);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "workout-pal" }),
  ).toBeVisible();

  await context.setOffline(false);
});
