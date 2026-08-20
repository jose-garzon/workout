## ADDED Requirements

### Requirement: Cycle is derived from the active routine's completed sessions

The system SHALL derive the current cycle — which days are finished and which day
is next — from the completed sessions recorded for the active routine, in the
order they were completed. No cycle state is stored; the cycle SHALL survive
reloads and app restarts because its inputs do.

#### Scenario: Fresh routine has an empty cycle

- **GIVEN** a 5-day active routine with no completed sessions
- **WHEN** the cycle is computed
- **THEN** no day is finished and day 1 is next

#### Scenario: Cycle survives a reload

- **GIVEN** a 5-day active routine where days 1 and 2 have been completed in the
  current cycle
- **WHEN** the app is reloaded and the cycle is recomputed
- **THEN** days 1 and 2 are still finished and day 3 is next

#### Scenario: Completed sessions of a previous routine are excluded

- **GIVEN** a 5-day routine where days 1 and 2 have been completed
- **WHEN** the user regenerates the routine and the cycle is computed
- **THEN** no day is finished and day 1 of the new routine is next

### Requirement: Editing the routine keeps the cycle for surviving days

Editing the active routine SHALL NOT reset the cycle. Days that survive the edit
SHALL keep their finished state; days that the edit replaced or renamed SHALL drop
out of the cycle. Only regenerating the routine starts a fresh cycle.

#### Scenario: A small edit keeps the user's place

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed in the current
  cycle
- **WHEN** the user edits the routine in a way that leaves those days in place
  (for example swapping one exercise) and the cycle is computed
- **THEN** days 1, 2, 3 are still finished and day 4 is still next

#### Scenario: Days replaced by the edit drop out

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed in the current
  cycle
- **WHEN** the user edits the routine so that day 2 is replaced by a different day
  and the cycle is computed
- **THEN** the replacement day is not finished
- **AND** days 1 and 3 are still finished

### Requirement: Finishing a day advances the cycle

Completing a session for a day SHALL mark that day finished and make the
following day in routine order the next day, wrapping from the last day back to
the first.

#### Scenario: Finishing the first day

- **GIVEN** a 5-day routine with no completed sessions
- **WHEN** the user completes day 1
- **THEN** day 1 is finished and day 2 is next

#### Scenario: Mid-cycle

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed in the current
  cycle
- **WHEN** the cycle is computed
- **THEN** days 1, 2, 3 are finished, day 4 is next, and day 5 is neither

#### Scenario: Next wins when the pointer lands on a finished day

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed and then day 5
  is completed
- **WHEN** the cycle is computed
- **THEN** day 1 is next (not finished), days 2, 3, 5 are finished, and day 4 is
  neither

### Requirement: Completing every day resets the cycle

When the day just completed makes every day of the routine finished — whichever day that is, not necessarily the last in order — the cycle SHALL empty and the first day of the routine SHALL become next.

#### Scenario: The last outstanding day is the final day

- **GIVEN** a 5-day routine where days 1, 2, 3, 4 have been completed in the
  current cycle
- **WHEN** the user completes day 5
- **THEN** no day is finished and day 1 is next

#### Scenario: The last outstanding day is not the final day

- **GIVEN** a 5-day routine where days 1, 2, 4, 5 have been completed in the
  current cycle
- **WHEN** the user completes day 3
- **THEN** no day is finished and day 1 is next (not day 4)

### Requirement: Re-finishing a finished day restarts the cycle from that day

When the user completes a day that is already finished in the current cycle, that day SHALL be the only finished day and the following day in routine order SHALL become next.

#### Scenario: Re-finishing day 1 at three of five

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed in the current
  cycle
- **WHEN** the user completes day 1 again
- **THEN** day 1 is the only finished day and day 2 is next

#### Scenario: Re-finishing day 2 at three of five

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed in the current
  cycle
- **WHEN** the user completes day 2 again
- **THEN** day 2 is the only finished day, day 1 is no longer finished, and day 3
  is next

### Requirement: Only finishing changes the cycle

The cycle SHALL change only when a session is completed. Opening a day's workout
screen, leaving it without finishing, and the passing of any calendar boundary
SHALL NOT change the cycle.

#### Scenario: Opening a day out of order changes nothing

- **GIVEN** a 5-day routine where days 1, 2, 3 have been completed and day 4 is
  next
- **WHEN** the user opens day 2's workout screen and leaves without finishing it
- **THEN** days 1, 2, 3 are still finished and day 4 is still next

#### Scenario: A week boundary changes nothing

- **GIVEN** a 5-day routine where days 1, 2, 3, 4 have been completed in the
  current cycle
- **WHEN** the calendar week rolls over
- **THEN** days 1, 2, 3, 4 are still finished and day 5 is still next

### Requirement: No active routine, no cycle

When no active routine exists, the system SHALL produce no cycle — no next day
and no finished days.

#### Scenario: Device with a profile and no routine

- **GIVEN** a device with a saved profile and no active routine
- **WHEN** the cycle is computed
- **THEN** it is empty: no next day and no finished days
