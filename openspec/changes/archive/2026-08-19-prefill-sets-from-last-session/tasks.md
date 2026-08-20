## 1. Interface first — unblocks both builders

- [x] 1.1 **[engineer]** Add `HistorySet`, `ExerciseHistory` and the seam view-model `PreviousSetView` to `src/modules/workout-mode/types.ts` (design D1/D4). Update the `WorkoutSession.enteredReps` doc comment: it is no longer reset per set.
- [x] 1.2 **[engineer]** Land the `WorkoutSessionApi` signature change in `logic/useWorkoutSession.ts`: remove `previousWeight`, add `previousSet: PreviousSetView | null` and `seedKey: string` (design D4/D5). Re-export `PreviousSetView` through `logic/useWorkoutSession.ts` and `index.ts`. Returning `null` / `""` at this point is fine — the point is that the contract compiles.

## 2. Failing tests that pin the reported bug

- [x] 2.1 **[engineer]** Write `e2e/prefill-sets-from-last-session.spec.ts` from AC1, AC3 and AC10 — seed `completedSessions` with the `page.evaluate` IDB pattern in `e2e/consistency-calendar.spec.ts`, with history reps deliberately different from the plan's reps. Expected red.
- [x] 2.2 **[engineer]** Add the failing integration cases to `src/modules/workout-mode/workoutSession.integration.test.tsx` for AC3 and AC7, asserting the **rendered input values** (not the seam's `reps`/`weight`) so the D5 remount bug is actually covered. Expected red. Confirms whether the current per-index reps prefill is broken (design Risks).

## 3. Data layer

- [x] 3.1 **[engineer]** Replace `getPreviousWeight` + `getPreviousReps` with `getExerciseHistory(exerciseId)` in `api/sessionRepo.ts`, using the single newest-first scan in design D1. Fix the stale `getPreviousWeight` reference in the `logic/summary.ts` comment.
- [x] 3.2 **[engineer]** Rewrite the two repo describes in `api/sessionRepo.test.ts` for `getExerciseHistory` — including the divergence case (tail set at weight 0 after an earlier positive set) and a positive weight found in an older session.

## 4. Rules and seam

- [x] 4.1 **[engineer]** `logic/model.ts`: add the pure `seedFromHistory` and `toPreviousSetView` (design D3), and drop `enteredReps: null` from `tap`'s `rest → ready` branch (design D2). `advanceExercise` unchanged.
- [x] 4.2 **[engineer]** Cover 4.1 in `logic/model.test.ts`, including a regression pin that `rest → ready` now **keeps** `enteredReps`.
- [x] 4.3 **[engineer]** `logic/useWorkoutSession.ts`: collapse the two lookup effects into one `getExerciseHistory` effect backed by the `historyCache` map + `inFlightRef` (build the map directly — there is no single-stamp intermediate, design D2/D8); turn the reps auto-default effect into the seed-once effect (set 1 only, both fields, per-field null guard, `filledSetRef` keyed by exercise id, resolved test = `armedExerciseId in historyCache`); wire `previousSet`, `seedStamp`/`seedKey`, and widen `armedExerciseId` to `overview` (design D2/D5/D6).
- [x] 4.4 **[engineer]** Extend `logic/useWorkoutSession.test.tsx`: seed fires once per exercise, never for set 2+, never stomps a filled field, reseeds after `nextExercise`, is a no-op on a resumed session that already holds values, and `seedKey` does not change on a user edit.
- [x] 4.5 **[engineer]** Pin the no-flash behaviour in `workoutSession.integration.test.tsx`, red first: after `nextExercise()`, exercise 2's seeded reps and weight are readable with a synchronous `getBy*` — no `findBy*`, no extra `await` for a repo read. Fails until 4.6.
- [x] 4.6 **[engineer]** Add the prefetch half (design D8): have the lookup effect also ensure an entry for `nextExerciseId`, and clear `historyCache` where the mount/resume effect resets the session. `seedKey` is untouched — no designer impact.

## 5. UI

- [x] 5.1 **[designer]** Add `workout.exercise.lastTime` (now with `{reps}`) and `workout.exercise.lastTimeReps` to `src/shared/i18n/en.json` and `es.json`, keeping the flat keys alphabetically sorted (design D7). Spanish uses the short `reps`, approved — do not align it to `setCell`'s `repeticiones`.
- [x] 5.2 **[designer]** `ui/ExerciseView.tsx`: render the caption from `previousSet` — nothing when `null`, `lastTime` when `weight != null`, `lastTimeReps` when `weight == null` (design D4). No unit math, no zero-checking in the component.
- [x] 5.3 **[designer]** `ui/ExerciseView.tsx`, two one-line changes: `WeightField`'s `key={currentExercise.id}` → `key={seedKey}` (design D5 — without it the seeded weight never reaches the input), and the local `setKey` that stamps `errored` → `` `${seedKey}:${timer.currentSeries}` `` (design Risks — a committed seed now clears a stale field error). Unaffected by the D8 prefetch.
- [x] 5.4 **[designer]** Update `ui/workoutMode.test.tsx`: swap the `previousWeight` stubs for `previousSet` + `seedKey`, and cover all three caption branches (AC1, AC2, AC9).

## 6. Full AC coverage and verify

- [x] 6.1 **[engineer]** Fill out `workoutSession.integration.test.tsx` for the integration ACs not already covered by 2.2 (AC3, AC7) and 4.5: **AC4** plan fallback with an empty weight field, **AC5** set 2 carries reps and weight, **AC6** an edit propagates to set 3 while sets 1 and 2 keep their own stored records, **AC8** advancing to an exercise with no history, **AC11** editing a prefilled field before the tap changes what is recorded and nothing auto-starts, **AC12** a fully prefilled set starts with no error state. Assert rendered input values throughout. Needs 5.2/5.3 landed.
- [x] 6.2 **[engineer]** Section 2's specs and 4.5 go green; `e2e/workout-mode.spec.ts` and `e2e/clock-button-empty-field-error.spec.ts` stay green.
- [x] 6.3 **[engineer]** Full suite + Biome + depcruise clean.

## 7. Scope amendment — no history falls back to the plan per set index (design D9)

- [x] 7.1 **[engineer]** Red first, in `workoutSession.integration.test.tsx`: an exercise with **no** history and a plan of 12/10/8 — set 1 shows 12, set 2 shows 10 (not 12), set 3 shows 8; a weight typed on set 1 still carries to set 2; and set 1 edited to 15 reps still leaves set 2 showing 10. Fails until 7.3.
- [x] 7.2 **[engineer]** `logic/model.ts`: replace `seedFromHistory` with `armedSetValues({ history, planReps, setIndex, carriedWeightKg })` per D9's branch table, returning `null` for the has-history `setIndex > 0` case. `tap` and `advanceExercise` stay untouched — the condition does not belong in a pure reducer. Cover all four branches in `logic/model.test.ts`.
- [x] 7.3 **[engineer]** `logic/useWorkoutSession.ts`: turn the seed-once effect into apply-once-per-**armed set** — `filledSetRef` key back to `` `${exerciseId}:${setIndex}` ``, fill-if-null per field at set index 0, overwrite at set index > 0, skip entirely when `armedSetValues` returns `null`. Stamp `filledSetRef` from the restored session in the mount/resume effect when the restored `setIndex > 0`, so a reload never overwrites what the user typed. Bump `seedStamp` only when the applied `weightKg` differs from the session's current value.
- [x] 7.4 **[engineer]** Extend `logic/useWorkoutSession.test.tsx` for the resume guard (restored at set 3 of an unlogged exercise keeps its persisted reps) and for `seedKey` not changing when only reps are re-applied. 7.1 green; sections 2, 4.5 and 6 stay green; full suite + Biome + depcruise clean.
