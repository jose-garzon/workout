# session-tracking Specification

## Purpose

What a session records and where it lives: a completed session's date plus, per
exercise, a per-series record — each set's reps, weight, work time, and volume —
with rest kept as an exercise-level aggregate, all on-device, and the ability to
resume an interrupted session. This reverses the interim per-exercise-aggregate
cut and restores per-series logging (see the proposal's Key decision 1, revised
2026-07-11).

## Requirements

### Requirement: A completed session records its date and a per-series record for each exercise

A completed session MUST record its date and, for each exercise worked, a per-series record: one entry per completed set holding that set's reps, weight, work time, and volume (weight × reps), plus the exercise's total rest time as an aggregate.

Each set's reps — and therefore its volume — MUST be the PLANNED reps from the routine for that set index, not a count of reps actually performed (rep-counting is a non-goal). This is a deliberate, tested contract: the record captures the prescribed load at the weight the user entered.

#### Scenario: Finishing a session writes a per-series record

- **GIVEN** the user completes every exercise in a day's session
- **WHEN** the session ends
- **THEN** a completed-session record is stored holding the session date and, per exercise, a `series[]` array with one entry per completed set — each carrying that set's reps, weight, work time, and volume — plus the exercise's total rest time

#### Scenario: Each set records the planned reps, not counted reps

- **GIVEN** an exercise whose plan prescribes varying reps across sets (e.g. 12/10/8)
- **WHEN** its sets are recorded
- **THEN** each set's stored reps equal that set index's planned reps, and its volume equals the entered weight × those planned reps — never a count of reps the user actually performed

### Requirement: An interrupted session resumes at the exercise in progress

An interrupted session SHALL resume at the exercise that was in progress, preserving already-completed exercises' data and restoring the in-progress exercise's entered weight and series progress.

#### Scenario: Returning to an interrupted session resumes it

- **GIVEN** a session in progress that is interrupted (tab closed or page left) partway through the day
- **WHEN** the user reopens workout mode for that day
- **THEN** the session resumes at the exercise that was in progress, with already-completed exercises' data preserved and the in-progress exercise's entered weight and series progress restored

#### Scenario: A resumed session is not restarted from the first exercise

- **GIVEN** a session interrupted after some exercises were completed
- **WHEN** it is resumed
- **THEN** the completed exercises are not re-worked and the session does not restart from the first exercise

### Requirement: All session data is stored on-device with no network call

Workout mode MUST persist and read all session data in the browser only and MUST make no network requests.

#### Scenario: Working a session makes no network call

- **GIVEN** the device is offline
- **WHEN** the user works and completes a session
- **THEN** the session runs and is recorded normally, and no network request is attempted at any point
