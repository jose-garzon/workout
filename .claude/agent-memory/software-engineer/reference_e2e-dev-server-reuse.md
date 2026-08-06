---
name: e2e-dev-server-reuse
description: Playwright reuses a developer's `next dev` on :3000, running the suite in DEV mode and producing ~15 bogus failures — run the gate on a free port with its own build
metadata:
  type: reference
---

`playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. If the user
(or another agent) already has `bun run dev` on `http://localhost:3000`,
`bun run e2e` silently **reuses it** instead of running its own
`bun run build && bun run start`. The suite then runs against a DEV server: no
service worker, slower first compiles, and ~15 failures spread across specs that
are actually green (edit-routine, routine-generation, i18n-spanish, all of
profile-page…).

**How to spot it:** far more reds than expected, in files you did not touch.
Check with `ss -ltnp | grep :3000` / `ps aux | grep 'next dev'`.

**How to run the gate anyway** (never kill the user's dev server): copy the
config to a temp one in the PROJECT ROOT (module resolution for
`@playwright/test` fails from `/tmp`) with an absolute `testDir`,
`reuseExistingServer: false`, `webServer.command: "bun run build && bun run start
--port 3100"`, and `baseURL: http://localhost:3100` — then
`bunx playwright test --config=<that file>` and delete it afterwards. Full suite
takes ~1 min on a free port.

Verified 2026-08-05 during the profile-page rework: 15 failures on :3000 (dev)
vs. 39 passed / 2 failed (the known standing reds) on a private prod build. See
[[e2e-theme-color-scheme]] for those standing reds.
