---
name: rtl-no-auto-cleanup
description: Vitest runs with globals off so RTL has no built-in auto-unmount; src/test/setup.ts now calls afterEach(cleanup) globally — do not re-add file-level ones
metadata:
  type: reference
---

`vitest.config.ts` does not set `globals: true`, so **RTL never registers its own
auto-cleanup**. Without an explicit `cleanup()`, a `render`/`renderHook` from a
finished test stays MOUNTED and its effects keep writing to the module-level
Zustand stores (`useWorkoutStore`) and Dexie while the next test runs.

Symptom: a test passes under `-t "<name>"` in isolation but fails in the full
file run, holding values from a *previous* test's fixture. Cost me ~20 minutes on
the workout-mode seed effect — an old hook instance seeded the store, so the new
hook's seed became a no-op and its `seedStamp` never bumped.

**Fixed globally 2026-08-19:** `src/test/setup.ts` now calls `afterEach(cleanup)`
for every test file. Do NOT add file-level `afterEach(cleanup)` on top of it —
two file-level ones were removed when the global landed. Verified no behavior
change elsewhere: full suite before and after was identical (419 passed, plus the
long-standing `ProfileScreen › renders the name more prominently than the title`
red, which is unrelated). Nothing in the repo was silently relying on a leftover
mounted tree.
