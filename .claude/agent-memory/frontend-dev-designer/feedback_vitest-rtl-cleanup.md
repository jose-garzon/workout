---
name: feedback-vitest-rtl-cleanup
description: vitest.config.ts has no test.globals, so RTL tests need an explicit afterEach(cleanup) or renders leak across tests
metadata:
  type: feedback
---

`vitest.config.ts` in this repo does not set `test.globals: true`. RTL
(`@testing-library/react`) auto-registers its post-test `cleanup()` by
detecting a global `afterEach` — without `test.globals`, that never fires,
so every `render()` after the first in a file appends into the *same*
jsdom document instead of a fresh one. Symptom: `getByRole`/`getByText`
throw "multiple elements found" even though each `it()` only renders once.

**Why this matters:** easy to misdiagnose as a component bug (duplicate
rendering) when it's actually a test-harness gap — cost real time on the
`welcome-view` change's `OnboardingForm.test.tsx` before finding the cause.

**How to apply:** any new RTL test file in this repo needs
`import { afterEach, ... } from "vitest"` +
`import { cleanup, ... } from "@testing-library/react"` +
`afterEach(cleanup);` near the top, until/unless someone adds
`test.globals: true` to `vitest.config.ts` (a config change outside my
UI-only lane — flag to the architect/engineer if it recurs enough to be
worth centralizing, e.g. by adding the `afterEach(cleanup)` call to the
shared `src/test/setup.ts` instead of repeating it per file).

Also: `@testing-library/user-event` is **not** an installed dependency in
this repo (only `@testing-library/dom`, `jest-dom`, `react`) — use
`fireEvent` from `@testing-library/react` for interaction tests instead of
reaching for `userEvent`, or ask before adding the dependency.
