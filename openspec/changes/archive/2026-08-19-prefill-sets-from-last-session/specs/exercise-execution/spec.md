## RENAMED Requirements

- FROM: `### Requirement: Previous weight is shown when the exercise has prior history`
- TO: `### Requirement: Last session's reps and weight are shown when the exercise has prior history`

## MODIFIED Requirements

### Requirement: Last session's reps and weight are shown when the exercise has prior history

The system SHALL show, as a read-only reference, the reps and the weight of the last set logged with a positive weight for the same exercise, searching completed sessions from most recent backwards. When the exercise has history but no set was ever logged with a positive weight, the system SHALL show the reps alone, with no weight and no unit. When the exercise has no history at all, the system SHALL show no reference. The reference SHALL be shown in the user's measurement unit.

#### Scenario: Reps and weight shown from the last weighted set

- **GIVEN** the last positive-weight set logged for the current exercise was 12 reps at 30 kg
- **WHEN** the per-exercise view is shown
- **THEN** the reference shows both 12 reps and 30 kg

#### Scenario: Bodyweight history shows reps alone

- **GIVEN** the current exercise's only history is sets logged at 12 reps with weight 0
- **WHEN** the per-exercise view is shown
- **THEN** the reference shows 12 reps with no weight value and no unit

#### Scenario: First time ever shows no reference

- **GIVEN** the current exercise has never been logged in any completed session
- **WHEN** the per-exercise view is shown
- **THEN** no reference is shown and the weight field is presented without a reference value

#### Scenario: The reference is shown in the user's unit

- **GIVEN** the user's measurement unit is imperial and the referenced set was logged at a weight the app displays as 66 lb
- **WHEN** the per-exercise view is shown
- **THEN** the reference reads 66 with the lb label, and the reps read the same in either unit

### Requirement: Reps and weight are entered per set and both gate the start

Both fields are editable while the set is not running and locked while it runs. A set MUST NOT start until both fields hold a value, and the values in effect when a set is completed MUST be recorded for that series. Where the fields' starting values come from is owned by "Set fields are prefilled from history or from the previous set". (Which fields the view presents is owned by "Per-exercise view shows the plan and the set's reps and weight fields".)

#### Scenario: Both fields filled starts the set

- **GIVEN** a set is armed with both reps and weight filled
- **WHEN** the user taps the stopwatch
- **THEN** the set starts in the work state exactly as before, and no field shows an error state

#### Scenario: A prefilled set is not blocked

- **GIVEN** a set is armed with both reps and weight prefilled and the user has touched neither field
- **WHEN** the user taps the stopwatch
- **THEN** the set starts and no field shows an error state

#### Scenario: An empty field blocks the start

- **GIVEN** a set is armed and either the reps field or the weight field is empty
- **WHEN** the user taps the stopwatch
- **THEN** no set starts and the work state is not entered

#### Scenario: The values in effect are recorded per series

- **GIVEN** the user has a reps value and a weight value in effect on the per-exercise view before completing a set
- **WHEN** that set is recorded
- **THEN** the weight in effect and the reps in effect for that set are both stored on the set's record

#### Scenario: An edit is captured per set and never rewrites an earlier set

- **GIVEN** a set was completed at one reps and weight, and the user then edits both before the next set runs
- **WHEN** the next set is recorded
- **THEN** the earlier set keeps its own recorded reps and weight and the next set records the edited values

## ADDED Requirements

### Requirement: Set fields are prefilled from history or from the previous set

A set's starting values SHALL depend on whether the exercise has prior history.

When the exercise HAS history: the first set SHALL be prefilled with the reps and weight of the last set that exercise logged in the most recent completed session containing it, regardless of whether that set carried a weight; a logged weight of zero SHALL leave the weight field empty while still prefilling the reps; and every set after the first SHALL keep the reps and weight in effect on the previous set rather than consulting history or the plan.

When the exercise has NO history: every set's reps SHALL be prefilled from the plan's reps for that set's own index, the first set's weight field SHALL be left empty, and every set after the first SHALL keep the weight in effect on the previous set.

Advancing to another exercise SHALL prefill from that exercise's own history. Prefilled values SHALL be shown in the user's measurement unit, SHALL remain editable, and SHALL NOT start a set on their own.

#### Scenario: First set is seeded from the last session's final set

- **GIVEN** the current exercise's last completed session logged set 1 at 12 reps / 30 kg and its final set at 9 reps / 35 kg, and the plan for set 1 calls for 10 reps
- **WHEN** the per-exercise view is shown on set 1
- **THEN** the reps field holds 9 and the weight field holds 35 — the final set's values, not set 1's and not the plan's 10

#### Scenario: First set falls back to the plan when there is no history

- **GIVEN** the current exercise has never been logged and the plan for set 1 calls for 10 reps
- **WHEN** the per-exercise view is shown on set 1
- **THEN** the reps field holds 10 and the weight field is empty

#### Scenario: Bodyweight history prefills reps only

- **GIVEN** the current exercise's only history is sets logged at 12 reps with weight 0
- **WHEN** the per-exercise view is shown on set 1
- **THEN** the reps field holds 12 and the weight field is empty

#### Scenario: Later sets carry both values from the previous set

- **GIVEN** the exercise has prior history, set 1 was seeded from it at 9 reps / 35 kg and completed unchanged, and the plan for set 2 calls for 10 reps
- **WHEN** set 2 is armed
- **THEN** the reps field holds 9 and the weight field holds 35

#### Scenario: Later sets of an unlogged exercise follow the plan's reps per set

- **GIVEN** the current exercise has never been logged and its plan calls for 12 reps on set 1, 10 on set 2 and 8 on set 3
- **WHEN** set 2 is armed after set 1 completed
- **THEN** the reps field holds 10, the plan's reps for set 2, not set 1's 12

#### Scenario: An unlogged exercise still carries the weight forward

- **GIVEN** the current exercise has never been logged, its plan calls for 12 reps on set 1 and 10 on set 2, and the user entered 40 kg on set 1
- **WHEN** set 2 is armed
- **THEN** the weight field holds 40 and the reps field holds 10

#### Scenario: An edited rep count does not carry within an unlogged exercise

- **GIVEN** the current exercise has never been logged, its plan calls for 12 reps on set 1 and 10 on set 2, and the user changed set 1 to 15 reps before completing it
- **WHEN** set 2 is armed
- **THEN** the reps field holds 10 and set 1's stored record still reads 15 reps

#### Scenario: An edit propagates forward to the next set

- **GIVEN** the exercise has prior history and set 2 was completed after the user changed reps to 8 and weight to 37.5
- **WHEN** set 3 is armed
- **THEN** the reps field holds 8 and the weight field holds 37.5

#### Scenario: Advancing reseeds from the next exercise's own history

- **GIVEN** the user finishes exercise 1 at 9 reps / 35 kg and exercise 2's last session ended on a final set of 8 reps / 60 kg
- **WHEN** the view advances to exercise 2
- **THEN** set 1 of exercise 2 holds 8 reps and 60 kg, never exercise 1's values

#### Scenario: Advancing to an exercise with no history

- **GIVEN** the user finishes exercise 1 at 9 reps / 35 kg and exercise 2 has never been logged, with its plan calling for 10 reps
- **WHEN** the view advances to exercise 2
- **THEN** set 1 of exercise 2 holds 10 reps and an empty weight field

#### Scenario: Prefilled weight is shown in the user's unit

- **GIVEN** the user's measurement unit is imperial and the exercise's last session ended on a final set at a weight the app displays as 66 lb
- **WHEN** the per-exercise view is shown on set 1
- **THEN** the weight field holds 66 with the lb label

#### Scenario: Prefilled values are editable and do not auto-start

- **GIVEN** set 1 is prefilled from the last session
- **WHEN** the user edits either field before tapping the stopwatch
- **THEN** the edited values are what the set starts with and what is recorded, and no set has started until the user taps
