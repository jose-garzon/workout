# session-overview

The pre-start screen for a workout: the day's exercises listed with their planned
work, one editable rest default for the whole session, and a single Start action.
This spec states only *what*; the layout and the seam wiring are the design's.

## ADDED Requirements

### Requirement: Enter workout mode for a routine day

The system SHALL open workout mode for the specific day of the active routine that the user selected on home, showing that day's overview before any exercise begins.

#### Scenario: Tapping a day opens its overview

- **GIVEN** a device with an active routine
- **WHEN** the user opens the workout route for one of that routine's days
- **THEN** the overview for that day is shown, listing that day's exercises, before any exercise has started

#### Scenario: No runnable session without an active routine day

- **GIVEN** the workout route is opened for a day that is not part of the active routine (or no active routine exists)
- **WHEN** the screen loads
- **THEN** the system does not start a session and communicates that there is no routine to work, rather than showing an empty or broken screen

### Requirement: Overview lists each exercise with its planned work

The overview MUST list every exercise in the day in order, each showing its name and its planned series count and reps.

#### Scenario: Exercises shown with series and reps

- **GIVEN** the overview for a day whose exercises each have planned sets
- **WHEN** the overview is shown
- **THEN** each exercise appears in the day's order with its name, its number of planned series, and its planned reps

### Requirement: Editable session default rest time

The overview SHALL present a single editable default rest time that applies to every rest interval in the session, prefilled from the routine's prescribed rest for the day.

#### Scenario: Default rest prefills from the routine

- **GIVEN** the overview for a day whose plan prescribes rest between sets
- **WHEN** the overview is shown
- **THEN** the default rest time field is prefilled from the routine's prescribed rest for that day

#### Scenario: Edited default rest applies to the whole session

- **GIVEN** the user changes the default rest time on the overview before starting
- **WHEN** the session runs
- **THEN** every rest countdown in the session uses the edited default rest time

### Requirement: Start begins the session at the first exercise

The overview MUST provide a single Start action that begins the session at the day's first exercise.

#### Scenario: Start opens the first exercise

- **GIVEN** the overview for a day
- **WHEN** the user taps Start
- **THEN** the per-exercise view for the day's first exercise is shown and the session is now in progress
