# Tasks — Clock button: show why a set can't start

Owner tags: `[engineer]` = `logic/`, `types.ts`, repo/model. `[designer]` = `ui/`,
`shared/ui/primitives`, `shared/i18n`. Group 1 is the meeting point (design.md §D2) —
it lands first, then groups 2–4 run in parallel with nothing else blocking.

## 1. Seam: the gate and the interface (unblocks the designer)

- [x] 1.1 [engineer] Add `export type SetField = "reps" | "weight"` to `modules/workout-mode/types.ts`, re-export it from `logic/useWorkoutSession.ts` alongside the other view-models, and add it to `index.ts` (the barrel already exports `WorkoutSessionApi`, which will reference it).
- [x] 1.2 [engineer] Add `missingSetFields: SetField[]` to `WorkoutSessionApi` — ordered reps-before-weight, `[]` outside the `ready` phase — and redefine `canStartSet` as `status === "in-progress" && timer.phase === "ready" && missingSetFields.length === 0`.
- [x] 1.3 [engineer] Extend the seam's `tap` guard to refuse when `enteredReps === null` as well as `enteredWeightKg === null`.
- [x] 1.4 [engineer] Fix the lost-tap race in the same `tap`: it `await`s `saveInProgress(next)` *before* `store.setSession(next)`, so a second tap landing in that window reads the stale session and is silently dropped. Commit the state first, then persist. Folded in by user decision — it is the standing cause of `e2e/workout-mode.spec.ts`'s red.

## 2. Model: record only confirmed reps

- [x] 2.1 [engineer] In `logic/model.ts`, make the `ready` branch return the session unchanged when `enteredWeightKg === null || enteredReps === null`.
- [x] 2.2 [engineer] In the `work` branch, replace `session.enteredReps ?? exercise?.sets[i]?.reps ?? 0` with `session.enteredReps ?? 0` (design.md §D7), and correct the now-false doc comments on `SeriesLog.reps` and `SeriesView.reps`.

## 3. `Input` primitive

- [x] 3.1 [designer] Add `ref?: Ref<HTMLInputElement>` to `InputProps` and spread it onto the inner `<input>` (React 19 plain prop — no `forwardRef`).
- [x] 3.2 [designer] Apply `text-danger-text` to the `<label>` when `error` is set; leave the message and border branches as they are.

## 4. Exercise screen

- [x] 4.1 [designer] In `ui/Stopwatch.tsx`, replace `disabled={startDisabled}` with `aria-disabled={startDisabled || undefined}`, narrow `StopwatchProps.tap` to `() => void`, and leave `phaseClasses` keyed off `canStartSet` (no `opacity-40` / `pointer-events-none` — either re-swallows the tap).
- [x] 4.2 [designer] In `ui/ExerciseView.tsx`, hold the set-stamped error state `{ setKey, fields }` with `setKey = \`${currentExercise.id}:${timer.currentSeries}\`` and derive `shownErrors` from it (design.md §D2/§D6) — no `useEffect` reset.
- [x] 4.3 [designer] Add a sync `handleTap`: if `missingSetFields.length > 0`, stamp the errors, `focus()` the ref for `missingSetFields[0]`, and return without calling `tap()`; otherwise `void tap()`. Pass it to `Stopwatch`. Focus must not sit behind an `await`.
- [x] 4.4 [designer] Give `RepsField` / `WeightField` a `ref` and an `error` prop, and have each field's change handler drop its own field from `shownErrors`.
- [x] 4.5 [designer] Swap the stopwatch hint to the reworded key so it names both fields.
- [x] 4.6 [designer] Vertical fit (design.md §Risks): suppress the `workout.exercise.equipmentHint` caption below the fields row while any field error is shown, and verify at 375×667 that a both-empty blocked tap does not push the stopwatch further off-screen than it already is.

## 5. i18n (both locales in the same commit)

- [x] 5.1 [designer] Add `workout.exercise.fieldRequired` (shared by both fields) to `en.json` and `es.json`.
- [x] 5.2 [designer] Rename `workout.stopwatch.message.enterWeight` → `workout.stopwatch.message.enterRepsWeight` and reword it plus `workout.stopwatch.label.readyBlocked` to name reps and weight, in both locales.

## 6. Tests

- [x] 6.1 [engineer] `logic/model.test.ts` — a `ready` tap with null reps returns the session unchanged; a `work` tap logs the entered reps. Replace any assertion that a set logs planned reps.
- [x] 6.2 [engineer] `logic/useWorkoutSession.test.tsx` — `missingSetFields` ordering and emptiness by phase; `canStartSet` agrees with it. Update existing weight-only-gate assertions.
- [x] 6.3 [engineer] `workoutSession.integration.test.tsx` — fix any flow that starts a set without reps, and assert a completed set stores the confirmed reps.
- [x] 6.4 [engineer] Cover the first-ever session (no previous-session history): the reps prefill falls back to the plan's reps for the set index, so `missingSetFields` is `[]` and every set can start. This path is now the difference between "works" and "every set of a first workout is blocked", and nothing tests it today.
- [x] 6.5 [designer] `ui/workoutMode.test.tsx` (RTL) — blocked tap reddens the right field(s) and moves `document.activeElement`; entry clears one field but not the other; re-emptying does not re-error; a new set clears errors; the filled path still starts the set.
- [x] 6.6 [engineer] Make the pre-written `e2e/clock-button-empty-field-error.spec.ts` go green, and confirm `e2e/workout-mode.spec.ts` still passes untouched (reps are auto-prefilled, so the happy path should never hit the gate).
