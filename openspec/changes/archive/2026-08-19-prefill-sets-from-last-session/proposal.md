## Why

An intermediate lifter repeats the same exercises week after week at nearly the same numbers, but workout mode makes them retype reps and weight every session. The "Last time" caption also hides half the useful information — it shows the weight but not the reps that produced it.

## What Changes

- The "Last time" reference shows the previous session's **reps and weight**, not weight alone. Its source rule is unchanged: the last set logged with a positive weight.
- The **first set** of an exercise arrives with **both** reps and weight prefilled from the **last set** that exercise logged in the most recent completed session — what you finished on.
- **Sets 2 and later, when the exercise has history**: carry both reps and weight from the previous set of the current session (weight already does; reps currently re-default per set index).
- **Sets 2 and later, when the exercise has NO history**: reps keep coming from the plan's reps at that set index (a 12/10/8 plan still reads 12, 10, 8), including after the user edits an earlier set. Weight is empty on set 1 and carries from the previous set thereafter, since there is nothing to seed it from.
- Advancing to the next exercise in the same session reseeds from *that* exercise's own last-session values.
- Zero-weight (bodyweight) history: the caption shows reps alone and set 1 prefills reps only, weight left empty.
- No history for an exercise: no "Last time" caption.
- Prefilled values remain fully editable; nothing is auto-recorded. The value stored for a set is still whatever the user has in the fields when the set completes.
- **Accepted divergence:** caption and prefill use independent rules, so they disagree when the last session's final set was logged at weight 0 — the caption shows the last positive-weight set, the prefill shows the last set. This is intentional; the caption is a reference, the prefill is a starting point.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `exercise-execution`: "Previous weight is shown when the exercise has prior history" becomes a reps-and-weight reference, with a reps-only form when the referenced weight is 0. "Reps and weight are entered per set and both gate the start" changes its prefill rule: set 1 is seeded from the last set of the last completed session (reps **and** weight), sets 2+ from the previous set — but only when the exercise has history. With no history the plan's reps per set index drive every set's reps and the weight carries from the previous set.

## Impact

- Workout mode's per-exercise view (the "Last time" caption and the initial state of the reps/weight fields) and the session history lookup behind them.
- i18n: `workout.exercise.lastTime` gains a reps value, **and** a reps-only variant string is needed for the zero-weight case (no weight, no unit). Both strings must ship in en and es together.
- No change to what a completed session records, to routine data, or to any network behavior. Local-first constraint untouched — the lookup reads on-device session history only.

## User Stories

1. As a returning lifter, I want the first set of an exercise to open with the reps and weight I finished on last time so I can tap start instead of retyping.
2. As a returning lifter, I want the "Last time" line to show reps *and* weight so I can judge whether to push, hold, or back off.
3. As a lifter mid-exercise, I want each following set to keep the numbers I just used so I only touch a field when something actually changes.
4. As a first-timer on an exercise, I want the app to fall back to the plan's reps rather than guess a weight.

## Acceptance Criteria

**AC1 — Caption shows reps and weight**
- GIVEN the last positive-weight set logged for the current exercise was 12 reps at 30 kg
- WHEN the per-exercise view is shown
- THEN the "Last time" caption shows both 12 reps and 30 kg

**AC2 — No caption without history**
- GIVEN the current exercise has never been logged in any completed session
- WHEN the per-exercise view is shown
- THEN no "Last time" caption is shown

**AC3 — First set prefilled from last session's LAST set**
- GIVEN the current exercise's last completed session logged set 1 at 12 reps / 30 kg and its final set at 9 reps / 35 kg, and the plan for set 1 calls for 10 reps
- WHEN the per-exercise view is shown on set 1
- THEN the reps field holds 9 and the weight field holds 35 — the final set's values, not set 1's and not the plan's 10

**AC4 — First set falls back to the plan when there is no history**
- GIVEN the current exercise has never been logged and the plan for set 1 calls for 10 reps
- WHEN the per-exercise view is shown on set 1
- THEN the reps field holds 10 and the weight field is empty

**AC5 — Sets 2+ carry from the previous set (exercise HAS history)**
- GIVEN the exercise has prior history, set 1 was seeded from last session's final set (9 reps / 35 kg) and completed unchanged, and the plan for set 2 calls for 10 reps
- WHEN set 2 is armed
- THEN the reps field holds 9 and the weight field holds 35

**AC6 — An edit propagates to the next set, not backwards**
- GIVEN set 2 was completed after the user changed reps to 8 and weight to 37.5
- WHEN set 3 is armed
- THEN the reps field holds 8 and the weight field holds 37.5, and set 2's stored record still reads 8 reps at 37.5 kg while set 1's still reads 9 reps at 35 kg

**AC7 — Advancing exercise reseeds from that exercise's history**
- GIVEN the user finishes exercise 1 at 9 reps / 35 kg and exercise 2's last session ended on a final set of 8 reps / 60 kg
- WHEN the view advances to exercise 2
- THEN set 1 of exercise 2 holds 8 reps and 60 kg — never exercise 1's values

**AC8 — Advancing to an exercise with no history**
- GIVEN the user finishes exercise 1 at 9 reps / 35 kg and exercise 2 has never been logged, with its plan calling for 10 reps
- WHEN the view advances to exercise 2
- THEN set 1 of exercise 2 holds 10 reps and an empty weight field

**AC9 — Zero-weight history shows and prefills reps only**
- GIVEN the current exercise's only history is sets logged at 12 reps with weight 0
- WHEN the per-exercise view is shown on set 1
- THEN the caption reads "Last time: 12 reps" with no weight and no unit, the reps field holds 12, and the weight field is empty

**AC10 — Values are shown in the user's unit**
- GIVEN the user's profile unit is imperial and the exercise's last session ended on a final set at a weight the app displays as 66 lb
- WHEN the per-exercise view is shown on set 1
- THEN both the "Last time" caption and the prefilled weight field read 66 with the lb label; reps are identical in either unit setting

**AC11 — Prefills are editable and do not auto-start**
- GIVEN set 1 is prefilled from the last session
- WHEN the user edits either field before tapping start
- THEN the edited values are what the set starts with and what is recorded, and no set has started until the user taps

**AC12 — A prefilled set is not blocked**
- GIVEN set 1 is prefilled with both reps and weight from the last session
- WHEN the user taps the stopwatch without touching a field
- THEN the set starts and no field shows an error state

**AC13 — No history: every set's reps come from the plan at that index**
- GIVEN the current exercise has never been logged and the plan calls for 12 / 10 / 8 reps across three sets
- WHEN set 1, then set 2, then set 3 are armed in that session
- THEN the reps field reads 12, then 10, then 8, and the weight field is empty on set 1 and holds the previous set's weight on sets 2 and 3

**AC14 — No history: an earlier set's reps edit does not override the plan**
- GIVEN the current exercise has never been logged, the plan calls for 12 / 10 / 8, and the user edits set 1's reps to 15 and completes it
- WHEN set 2 is armed
- THEN the reps field reads the plan's 10, not 15, and set 1's stored record still reads 15 reps

## Non-goals

- No progressive-overload logic: no suggested increments, no "+2.5 kg", no trend arrows or PR badges.
- No editing, deleting, or browsing of past session history from workout mode.
- No per-set history beyond seeding set 1 from last session's final set — sets 2+ never look at last session's set 2, set 3, etc.
- No reconciling the caption's rule with the prefill's rule; the divergence above is accepted, not a bug to design around.
- No change to what a completed session stores.
- No settings toggle for prefill behavior; one behavior for everyone.
- No cross-routine or cross-exercise inference (e.g. matching "Incline DB Press" to "DB Press").
