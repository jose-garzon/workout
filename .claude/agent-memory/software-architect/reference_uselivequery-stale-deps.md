---
name: uselivequery-stale-deps
description: dexie-react-hooks useLiveQuery returns the PREVIOUS result after a deps change — any seam hook with deps must stamp and reject stale results
metadata:
  type: reference
---

`useLiveQuery(fn, deps)` keeps returning the **previous subscription's value** after `deps` change: `monitor.current.hasResult` is a ref that is never reset (`node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs:40-67`). So the usual `result === undefined ⇒ loading` guard does **not** fire on a deps flip — the old answer is served for a paint plus an IndexedDB round trip.

This bites any hook whose deps go `null → value` on a cold load. Found in `useDayCycle` (change `highlight-next-workout-day`, 2026-08-08): deps `[routine.createdAt]` flipped `null → T`, the leftover no-routine result (`dayIds: []`) was folded, and home painted a **fabricated cycle** — day 1 as `next` over a mid-cycle routine. Same shape exists in `useCalendar` (`[lower]`) and `useSessionSummary` (`[routineId]`); harmless there so far, not by design.

**Pattern to specify in `design.md` for any deps-carrying seam hook:** have the querier return its dep alongside the data (`{ createdAt, dayIds }`), and treat a result whose stamp ≠ the current dep as *not an answer* — degrade to a safe view and keep reporting `loading`. Never let a stale read produce a plausible-looking derived value.

**How to apply:** when designing a seam hook over Dexie, write the "deps not yet emitted" row into the hook's state table explicitly, separate from "nothing emitted yet". See [[cross-feature-session-reads]].
