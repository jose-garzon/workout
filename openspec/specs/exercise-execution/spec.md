# exercise-execution Specification

## Purpose

Working one exercise at a time: what the per-exercise view shows, entering the
set's reps and weight, seeing last time's weight, and advancing through an exercise's series
and on to the next exercise until the day is done. The stopwatch cycle that drives
"a series is complete" lives in `workout-timer`; this spec owns the exercise-level
structure around it.

## Requirements

### Requirement: Per-exercise view shows the plan and the set's reps and weight fields

The per-exercise view SHALL show the current exercise's name, its planned series and reps, and both entry fields for the current set — a reps field and a weight field.

#### Scenario: Current exercise is presented with its plan

- **GIVEN** a session in progress on a given exercise
- **WHEN** the per-exercise view is shown
- **THEN** it displays that exercise's name, its planned number of series, its planned reps, a reps field, and a weight field

### Requirement: Previous weight is shown when the exercise has prior history

The system SHALL show, as a reference, the weight logged for the same exercise in the user's most recent completed session, and SHALL show no previous weight when the exercise has no such history.

#### Scenario: Previous weight shown from the last completed session

- **GIVEN** the current exercise was logged with a weight in a prior completed session
- **WHEN** the per-exercise view is shown
- **THEN** the weight from the most recent completed session containing that exercise is shown as a reference

#### Scenario: First time ever shows no previous weight

- **GIVEN** the current exercise has never been logged in any completed session
- **WHEN** the per-exercise view is shown
- **THEN** no previous weight is shown and the weight field is presented without a reference value

### Requirement: Reps and weight are entered per set and both gate the start

The set's weight carries over between sets (a new set is pre-filled with the prior set's weight) and its reps are pre-filled per set index; both fields are editable while the set is not running and locked while it runs. A set MUST NOT start until both fields hold a value, and the values in effect when a set is completed MUST be recorded for that series. (Which fields the view presents is owned by "Per-exercise view shows the plan and the set's reps and weight fields".)

#### Scenario: Both fields filled starts the set

- **GIVEN** a set is armed with both reps and weight filled
- **WHEN** the user taps the stopwatch
- **THEN** the set starts in the work state exactly as before, and no field shows an error state

#### Scenario: An empty field blocks the start

- **GIVEN** a set is armed and either the reps field or the weight field is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts and the work state is not entered

#### Scenario: The values in effect are recorded per series

- **GIVEN** the user has a reps value and a weight value in effect on the per-exercise view before completing a set
- **WHEN** that set is recorded
- **THEN** the weight in effect and the reps in effect for that set are both stored on the set's record

#### Scenario: Weight carries over but an edit is captured per set

- **GIVEN** a set was completed at one weight and the user then edits the weight before the next set runs
- **WHEN** the next set is recorded
- **THEN** the earlier set keeps its own recorded weight and the next set records the edited weight — each set carries the weight in effect when it was completed

### Requirement: A blocked start attempt identifies every empty field

When a start attempt is blocked, the system SHALL put every empty required field into an error state — a red border, a red label, and a visible message, so color is never the only signal — and SHALL move keyboard focus to the first empty field, taking reps before weight. Fields that hold a value SHALL NOT be marked.

#### Scenario: Empty reps is identified

- **GIVEN** a set is armed, weight is filled and reps is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, the reps field shows its error state with a red border, a red label and a visible message, the weight field shows no error, and keyboard focus moves to the reps field

#### Scenario: Empty weight is identified

- **GIVEN** a set is armed, reps is filled and weight is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, only the weight field shows its error state, and keyboard focus moves to the weight field

#### Scenario: Both empty marks both and focuses reps

- **GIVEN** a set is armed and both reps and weight are empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts, both fields show their error state, and keyboard focus moves to the reps field as the first of the two

#### Scenario: Tapping again while still empty repeats the answer

- **GIVEN** both fields are shown in their error state
- **WHEN** the user taps the stopwatch again without filling anything
- **THEN** the errors remain shown and keyboard focus returns to the first empty field

### Requirement: Field errors clear on input and never outlive the set

A field's error state MUST clear as soon as the user edits that field, without a further tap, and MUST NOT reappear until the next blocked start attempt. Error state MUST NOT carry across a new set or a new exercise.

#### Scenario: Entering a value clears only that field's error

- **GIVEN** the reps field is showing its error state and the weight field is empty and also showing its error state
- **WHEN** the user enters any value in the reps field
- **THEN** the reps field's error state clears immediately and the weight field keeps its own error

#### Scenario: Re-emptying a field does not re-raise its error

- **GIVEN** a field showed an error and was then filled
- **WHEN** the user clears it back to empty
- **THEN** no error is shown for it again until the next blocked start attempt

#### Scenario: A new set or exercise starts with no errors

- **GIVEN** errors are showing on the current exercise
- **WHEN** a new set is armed or the user advances to the next exercise
- **THEN** no error state is carried over into the new set or exercise

### Requirement: Next exercise appears when all series are complete

When every planned series of the current exercise has been completed, the system SHALL reveal a Next exercise control that advances to the following exercise.

#### Scenario: Next exercise control appears after the final series

- **GIVEN** a session in progress on an exercise
- **WHEN** the exercise's last planned series is completed
- **THEN** the exercise is marked done and a Next exercise control appears

#### Scenario: Advancing to the following exercise

- **GIVEN** the Next exercise control is shown and more exercises remain in the day
- **WHEN** the user activates it
- **THEN** the per-exercise view for the next exercise in order is shown

### Requirement: Finishing the last exercise completes the session

When the last exercise of the day is completed, the system SHALL end the session and proceed to the completion view rather than to another exercise.

#### Scenario: Session completes after the final exercise

- **GIVEN** a session in progress on the day's final exercise
- **WHEN** that exercise is completed
- **THEN** the session ends and the completion view is shown
