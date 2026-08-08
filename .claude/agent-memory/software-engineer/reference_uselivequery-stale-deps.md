---
name: uselivequery-stale-deps
description: dexie-react-hooks useLiveQuery returns the PREVIOUS subscription's result after its deps change — stamp results with the dep and treat a mismatch as loading
metadata:
  type: reference
---

`useLiveQuery(querier, deps)` does **not** reset to `undefined` when `deps`
change. In `node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs` (~lines
40–67) `monitor.current.hasResult` / `.result` are refs that survive the
`useMemo` re-run, so the hook keeps returning the OLD subscription's value until
the new observable emits — one full paint plus an IndexedDB round trip later.

`result === undefined` therefore only catches "nothing has EVER emitted", not
"nothing has emitted for the current deps".

**Where this bites:** any live query keyed on a value that arrives from ANOTHER
live query — the classic being `useLiveQuery(() => read(routine.createdAt),
[createdAt])` sitting on top of `useActiveRoutine()`. On a cold load `createdAt`
flips `null → T` and the stale `null`-branch result gets folded as if it were
the answer, so home paints a fabricated cycle (day 1 "Next") over a mid-cycle
routine before snapping to the real one.

**The pattern that fixes it** (in `modules/routine-generation/logic/useDayCycle.ts`):
stamp the querier's return with the dep it actually read, then treat a mismatch
exactly like "not emitted yet" — degrade to a neutral view, keep `loading: true`,
never derive anything from it.

```ts
const result = useLiveQuery(async () => ({ createdAt, ...(await read(createdAt)) }), [createdAt]);
if (result === undefined || result.createdAt !== createdAt) return neutralView;
```

A test only catches this if it asserts the INTERMEDIATE render — make the repo
read a promise you resolve by hand, assert the window, then release. Anything
that `waitFor`s the settled state passes either way.

`useCalendar` is immune only by accident: its `lower` dep is pinned with
`useMemo(…, [])` and never changes. Found by code review on 2026-08-08 and
verified against the dexie source. See [[integration-test-placement]].
