---
name: e2e-stopwatch-taps
description: Stopwatch e2e taps — the lost-tap race is FIXED (2026-08-15); a blocked clock needs click({ force: true }) because Playwright counts aria-disabled as "not enabled"
metadata:
  type: reference
---

Two things about clicking the workout stopwatch in Playwright.

**1. The lost-tap race is fixed — do not re-diagnose it.** `useWorkoutSession.tap()`
used to `await saveInProgress(next)` *before* `store.setSession(next)`, so a
second tap inside that window read the stale session and vanished. It was the
real cause of the long-standing `e2e/workout-mode.spec.ts` "guide a full session"
red. Fixed 2026-08-15 (change `clock-button-empty-field-error`, task 1.4) by
committing to the store first, then persisting; that spec has been green since.
Awaiting the new phase between taps is still good spec style (a failure then
points at the tap that broke), but it is no longer load-bearing.

**2. A blocked clock must be clicked with `force: true`.** The stopwatch uses
`aria-disabled` (never native `disabled`) so a blocked tap can still be received.
Playwright 1.61's actionability check treats `aria-disabled="true"` as **not
enabled**, so a plain `.click()` times out with "element is not enabled". `force`
skips that wait and does *not* weaken the test: the browser dispatches no click
event at all for a natively `disabled` button, so the spec still fails if the
attribute ever comes back.

`force: true` is also needed in `work`/`rest`/`overtime` for an unrelated reason
— the pulse animation makes the button "not stable".
