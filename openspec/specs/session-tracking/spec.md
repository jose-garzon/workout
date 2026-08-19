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

Each set's reps — and therefore its volume — MUST be the reps the user confirmed for that set, and MUST NOT be plan-derived. The routine's reps for a set index are a PREFILL for the reps field, never the record: a set cannot start until the field holds a value, and the field is locked while the set runs, so the value recorded is always one the user confirmed for that set.

#### Scenario: Finishing a session writes a per-series record

- **GIVEN** the user completes every exercise in a day's session
- **WHEN** the session ends
- **THEN** a completed-session record is stored holding the session date and, per exercise, a `series[]` array with one entry per completed set — each carrying that set's reps, weight, work time, and volume — plus the exercise's total rest time

#### Scenario: Each set records the reps the user confirmed

- **GIVEN** a set whose plan prescribes 12 reps, and the user enters 10 reps at 40 kg
- **WHEN** the set is completed
- **THEN** the stored set records 10 reps and a volume of 400 kg (10 × 40) — the confirmed reps, never the planned 12

#### Scenario: No set is ever recorded with plan-derived reps

- **GIVEN** the start gate requires a non-empty reps field
- **WHEN** any set in any session is completed
- **THEN** its stored reps are a value the user confirmed for that set, and no code path records the plan's reps for that set index

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
