# home-routine-dashboard Specification

## Purpose
TBD - created by archiving change routine-generation. Update Purpose after archive.
## Requirements
### Requirement: Identity header

Home SHALL show an identity header containing the user's saved display name and a
small badge indicating the user's saved training goal.

#### Scenario: Header shows name and goal badge

- **GIVEN** a device with a saved profile
- **WHEN** home is shown
- **THEN** the header displays the saved display name and a badge showing the
  user's training goal

### Requirement: Motivational line reflects the routine

When an active routine exists, the identity header SHALL show a short
motivational line specific to that routine (authored during generation). When no
routine exists, the header SHALL show a neutral invitation to build one instead.

#### Scenario: Routine present shows its motivational line

- **GIVEN** an active routine that carries a motivational line
- **WHEN** home is shown
- **THEN** the header shows that routine's motivational line

#### Scenario: No routine shows a neutral invitation

- **GIVEN** a device with a saved profile and no active routine
- **WHEN** home is shown
- **THEN** the header shows a neutral invitation to build a routine (not a
  routine-specific line)

### Requirement: Per-day routine summary

When an active routine exists, home SHALL present a summary of the routine as a
list of its days, each identifiable by name, giving an at-a-glance view of the
split.

#### Scenario: Routine summary lists the days

- **GIVEN** an active routine with multiple days
- **WHEN** home is shown
- **THEN** home lists each day of the routine by name

#### Scenario: No routine shows no day summary

- **GIVEN** a device with a saved profile and no active routine
- **WHEN** home is shown
- **THEN** no per-day routine summary is shown (only the header and composer)

### Requirement: Tapping a day opens workout mode

When an active routine exists, the system SHALL let the user activate any day in
the summary to navigate to workout mode for that day. Workout mode is an
intentionally empty screen in this change.

#### Scenario: Activating a day navigates to workout mode

- **GIVEN** an active routine shown on home
- **WHEN** the user activates one of its days
- **THEN** the app navigates to workout mode for that day (an empty screen for
  now)

