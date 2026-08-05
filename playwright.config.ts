import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e (design.md §6). A `chromium` project for the critical online
 * flows and an `offline` project that drives the PWA offline checks (shell +
 * data screens usable with no network; generation shows the offline error —
 * tasks 7.2 / 7.3). The offline specs first warm the service-worker cache
 * online, then go offline, so they live in the offline project only.
 *
 * A third `spanish` project runs the Story-4 i18n spec under `locale: "es-ES"`
 * (i18n-spanish-support design.md §Decision 7). It owns `i18n-spanish.spec.ts`
 * exclusively — `chromium` ignores that file, since its assertions are Spanish
 * and only hold when the browser's preferred language is `es-*`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // Build + start so the service worker is present (it is disabled in `dev`).
    command: "bun run build && bun run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [/.*\.offline\.spec\.ts/, /i18n-spanish\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "offline",
      testMatch: /.*\.offline\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "spanish",
      testMatch: /i18n-spanish\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], locale: "es-ES" },
    },
  ],
});
