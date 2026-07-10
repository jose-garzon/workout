# session-tracking

What a session records and where it lives: a completed session's date plus, per
exercise, the aggregates worth keeping — series, reps, weight, total work time,
total rest time — with no per-series breakdown, all on-device, and the ability to
resume an interrupted session. This supersedes the framing-v1 per-set logging
decision (see the proposal's Key decision 1).

## ADDED Requirements

### Requirement: A completed session records its date and per-exercise aggregates

A completed session MUST record its date and, for each exercise worked, the series count, the reps, the weight used, the total work time, and the total rest time.

#### Scenario: Finishing a session writes the aggregate record

- **GIVEN** the user completes every exercise in a day's session
- **WHEN** the session ends
- **THEN** a completed-session record is stored holding the session date and, per exercise, its series count, reps, weight, total work time, and total rest time

### Requirement: No per-series breakdown is stored

The session record SHALL store per-exercise aggregates only and MUST NOT store the weight, reps, or timing of individual series.

#### Scenario: Individual series are not persisted

- **GIVEN** an exercise worked across several series
- **WHEN** its record is stored
- **THEN** only the exercise-level aggregate is kept, with no separate entry per series

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
