# exercise-execution

Working one exercise at a time: what the per-exercise view shows, entering the
weight once, seeing last time's weight, and advancing through an exercise's series
and on to the next exercise until the day is done. The stopwatch cycle that drives
"a series is complete" lives in `workout-timer`; this spec owns the exercise-level
structure around it.

## ADDED Requirements

### Requirement: Per-exercise view shows the plan and a weight field

The per-exercise view SHALL show the current exercise's name, its planned series and reps, and a single weight field for the user to enter the weight used.

#### Scenario: Current exercise is presented with its plan

- **GIVEN** a session in progress on a given exercise
- **WHEN** the per-exercise view is shown
- **THEN** it displays that exercise's name, its planned number of series, its planned reps, and a weight field

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

### Requirement: One weight field per set; reps come from the plan

The per-exercise view MUST present a single weight field. Its value carries over between sets (a new set is pre-filled with the prior set's weight) and is editable while the set is not running, and the value in effect when a set is completed MUST be recorded for that series. Reps are taken from the routine's plan for that set index rather than entered.

#### Scenario: The weight in effect is recorded per series

- **GIVEN** the user enters or keeps a weight on the per-exercise view before completing a set
- **WHEN** that set is recorded
- **THEN** the weight in effect for that set is stored on the set's record, its reps are the planned reps for that set index, and the user is not asked to enter reps per series

#### Scenario: Weight carries over but an edit is captured per set

- **GIVEN** a set was completed at one weight and the user then edits the weight before the next set runs
- **WHEN** the next set is recorded
- **THEN** the earlier set keeps its own recorded weight and the next set records the edited weight — each set carries the weight in effect when it was completed

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
