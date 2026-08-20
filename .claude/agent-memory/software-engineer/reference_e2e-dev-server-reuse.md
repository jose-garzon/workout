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

**Worse (2026-08-15): a live `next dev` also OWNS `.next`.** `bun run build` in
the repo then dies with `ENOENT .next/server/pages-manifest.json`, or "succeeds"
and is clobbered a minute later, which shows up as an entire screen failing to
render in e2e. Build from an isolated copy instead:

```bash
rsync -a --exclude node_modules --exclude .next --exclude .git <repo>/ $GATE/
ln -s <repo>/node_modules $GATE/node_modules
cd $GATE && bun run build      # then webServer.command: cd $GATE && bun run start --port 3100
```

Keep `testDir` pointed at the real `e2e/` (specs only need `baseURL`).

**Always confirm :3100 is free before each run.** Playwright leaves its
`next start` behind on failure; the next run either errors with "port already
used" or silently runs against the *stale* build and produces a cascade of
`chrome-error://chromewebdata/` failures in specs you never touched (seen:
14 bogus reds that were 0 on a clean run). `pkill -f "next start --port 3100"` in
a wait loop until `ss -ltn | grep :3100` is empty.

**2026-08-19 update.** Ran the gate this way with a `next dev` live on :3000 and
the in-repo `bun run build` worked fine (72 passed / 1 skipped, whole chromium
suite) — the `.next` clash above is real but not guaranteed; try the plain
in-repo temp-config route first and only fall back to the rsync copy if the
build actually ENOENTs. **Pick the port from `ss -ltn` at run time**: :3123 was
already taken, almost certainly by the frontend-dev-designer running their own
gate in the same parallel apply. :3177 was free.
