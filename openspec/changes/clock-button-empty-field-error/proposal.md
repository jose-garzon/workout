# Clock button: show why a set can't start

## Why

Mid-workout, tapping the stopwatch with an empty reps or weight field does nothing — the control is natively disabled, so the tap is swallowed and the user gets zero feedback and no idea what to fix. Worse, only weight is actually gated today: an empty reps field silently lets the set start and the set records fallback reps the user never confirmed.

## What Changes

- A set requires **both** reps and weight to be non-empty. **BREAKING** (behavior): an empty reps field now blocks the set instead of silently falling back to the plan's reps.
- Tapping the stopwatch while blocked no longer does nothing — it reports which field is missing: every empty field enters an error state (red border + red label + a short message), and focus moves to the first empty field (reps before weight).
- The blocked stopwatch stops being an inert, unclickable control. It still reads as "waiting", still announces "not available yet" to assistive tech, but it accepts taps so it can answer the question the user is asking by tapping it.
- A field's error clears the moment it holds a value again — no second tap needed.
- The muted hint under the stopwatch is **reworded to name both fields** (it currently says weight only) and kept: it explains the block *before* the user taps; the error states explain it *after*.

## User Stories

- As a gym-goer mid-set, I want the app to tell me which field is missing when I tap the clock, so I don't lose seconds poking at a dead button.
- As a gym-goer, I want an empty reps field to stop the set from starting, so a set is never logged with a number I didn't confirm.

## Acceptance Criteria

### Blocked tap surfaces the missing field

- **GIVEN** a set is armed (not running), weight is filled and reps is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, the reps field shows its error state (red border, red label, and a visible message — red is never the only signal), the weight field shows no error, and keyboard focus moves to the reps field

- **GIVEN** a set is armed, reps is filled and weight is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, only the weight field shows its error state, and focus moves to the weight field

- **GIVEN** a set is armed and both reps and weight are empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, both fields show their error state, and focus moves to the reps field (the first of the two)

- **GIVEN** both fields are shown in their error state
- **WHEN** the user taps the stopwatch again without filling anything
- **THEN** the errors remain shown and focus returns to the first empty field

### Errors clear on input

- **GIVEN** the reps field is showing its error state
- **WHEN** the user enters any value in it
- **THEN** that field's error state clears immediately, while an empty weight field keeps its own error

- **GIVEN** a field showed an error and was then filled
- **WHEN** the user clears it back to empty
- **THEN** no error is shown again until the next blocked tap

- **GIVEN** errors are showing on the current exercise
- **WHEN** a new set is armed or the user advances to the next exercise
- **THEN** no error state is carried over into the new set/exercise

### A completed set records the reps the user confirmed

- **GIVEN** a set whose plan prescribes 12 reps, and the user enters 10 reps at 40 kg
- **WHEN** the set is completed
- **THEN** the stored set records 10 reps and a volume of 400 kg (10 × 40) — the confirmed reps, never the planned 12

- **GIVEN** the start gate now requires a non-empty reps field
- **WHEN** any set in any session is completed
- **THEN** its stored reps are a value the user confirmed for that set; no set is ever recorded with plan-derived reps

### The set still starts normally

- **GIVEN** a set is armed with both reps and weight filled
- **WHEN** the user taps the stopwatch
- **THEN** the set starts (work phase) exactly as today, with no error state shown

### Blocked state is still conveyed, not just implied

- **GIVEN** a set is armed and at least one of reps/weight is empty
- **WHEN** the stopwatch is presented
- **THEN** it keeps its distinct "waiting" appearance, is reachable and tappable, and is exposed to assistive tech as unavailable-for-now (`aria-disabled` semantics rather than a native `disabled` attribute, which would swallow the tap)
- **AND** a hint below it names both required fields, not weight alone

## Non-Goals

- No change to reps prefill / progressive-overload defaulting (previous session's reps for that set index).
- No validation beyond "non-empty" — no min/max, ranges, or plausibility checks.
- No change to the lock on both fields while a set is running (`work`/`rest`/`overtime`).
- No change to the session record's shape, to the timer cycle, or to session persistence — only to *which* reps value a set records.
- No error styling for any other form in the app.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `exercise-execution`: a set MUST NOT start until both reps and weight hold a value; a blocked start attempt MUST identify each empty field with an error state and move focus to the first one; error state clears on input and does not persist across sets/exercises. Note: this spec's current text predates the reps field entirely ("reps come from the plan… the user is not asked to enter reps"), so the delta must reconcile it with the shipped reps-entry behavior.
- `workout-timer`: the stopwatch in its armed-but-blocked state MUST remain tappable and respond to a tap with feedback instead of being inert, while still being conveyed as unavailable to assistive tech.
- `session-tracking`: **spec/code drift, fixed here.** The spec says a set's stored reps MUST be the *planned* reps for that set index; the code (`model.ts:202`) stores `enteredReps ?? plan`, so a set has recorded the user's reps ever since reps entry shipped. Reconciled requirement: a completed set MUST record **the reps the user confirmed for that set** — with volume = confirmed reps × entered weight — and MUST NOT record plan-derived reps. The plan's reps stay a *prefill*, not the record. The `?? plan` fallback becomes unreachable once the gate requires non-empty reps (reps are also locked while the set runs), so it is at most an inert implementation defense, not behavior: the spec asserts only the confirmed-reps contract, and whether the code keeps the fallback is the architect's call. The existing "planned reps, not counted reps" scenario is replaced, not amended.

## Impact

- Workout-mode exercise screen: the stopwatch control, the reps and weight fields, and the hint line beneath the stopwatch.
- The start gate in workout-mode logic (currently weight-only) plus whatever per-field validation state the seam must expose to the UI.
- The shared `Input` primitive: it already supports an error message and red border, but does not redden the label — the design system's "never color alone" rule means the message stays mandatory alongside it.
- Existing tests that start a set without filling reps will need updating; that is expected, not a regression.
- No data-model, storage, or network impact: the stored set keeps its shape, only the reps value's meaning is pinned to the user's entry. Any test asserting a set logs *planned* reps now asserts confirmed reps.
