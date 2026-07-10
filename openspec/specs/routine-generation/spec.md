# routine-generation Specification

## Purpose
TBD - created by archiving change routine-generation. Update Purpose after archive.
## Requirements
### Requirement: Prompt composer on home

Home SHALL present a persistent prompt composer as its primary action, allowing
the user to describe the routine they want in free text. The composer SHALL
remain available whether or not a routine already exists.

#### Scenario: Composer is present after onboarding

- **GIVEN** a device with a saved profile and no routine
- **WHEN** home is shown
- **THEN** a prompt composer is present as the primary action, ready for input

#### Scenario: Composer remains available with a routine present

- **GIVEN** a device with an active routine
- **WHEN** home is shown
- **THEN** the prompt composer is still present, allowing another generation

#### Scenario: Empty prompt cannot be submitted

- **GIVEN** the composer with no text (or only whitespace) entered
- **WHEN** the user attempts to submit
- **THEN** no generation request is made and submission does not proceed

### Requirement: Generate a routine from the prompt and saved profile

On submitting a non-empty prompt, the system SHALL request a routine from the AI
backend using both the typed prompt and the user's saved profile and goals (goal,
training days per week, bodyweight, units). The user SHALL NOT be required to
re-enter data already captured during onboarding.

#### Scenario: Submitting a prompt starts generation

- **GIVEN** a saved profile and a non-empty prompt in the composer
- **WHEN** the user submits
- **THEN** the system requests a routine from the AI backend, incorporating the
  saved profile and goals alongside the typed prompt

#### Scenario: Generated routine reflects the split the AI returns

- **GIVEN** a submitted prompt
- **WHEN** the backend returns a valid structured routine
- **THEN** the routine has one or more days, each with one or more exercises, and
  each exercise with one or more planned sets (reps and rest)

### Requirement: In-flight building indicator

While a generation request is in progress, the system SHALL show an animated
building indicator, positioned between the identity header and the composer, that
communicates the routine is being built.

#### Scenario: Indicator appears during generation

- **GIVEN** a generation request has been submitted and not yet resolved
- **WHEN** home is shown
- **THEN** an animated building indicator is visible between the identity header
  and the composer

#### Scenario: Indicator clears on completion

- **GIVEN** a generation request in progress
- **WHEN** the request resolves (success or failure)
- **THEN** the animated building indicator is no longer shown

### Requirement: Live thinking summary

While a generation request is in progress, the system SHALL display a summary of
the model's thinking, positioned above the composer, updating as the model works.

#### Scenario: Thinking summary streams during generation

- **GIVEN** a generation request in progress that is emitting reasoning
- **WHEN** the model produces thinking output
- **THEN** a summary of that thinking is shown above the composer and updates as
  more arrives

#### Scenario: Generation succeeds without emitted thinking

- **GIVEN** a generation request that completes without producing any thinking
  output
- **WHEN** the request resolves successfully
- **THEN** the absence of a thinking summary does not block the routine from being
  produced

### Requirement: Generation failure and offline are surfaced legibly

When a generation request fails, the system SHALL present a specific,
human-readable message (never a raw technical string) and SHALL leave any
existing active routine unchanged. When the device is offline, the system SHALL
communicate that generation needs a connection without attempting a network call.

#### Scenario: Backend error shows a human message

- **GIVEN** a generation request in progress
- **WHEN** the backend returns an error
- **THEN** a specific human-readable message is shown and the user can try again

#### Scenario: Offline submission is blocked with a clear message

- **GIVEN** the device is offline
- **WHEN** the user submits a prompt
- **THEN** the system indicates a connection is required and makes no network call

#### Scenario: A failed generation preserves the current routine

- **GIVEN** an active routine already exists
- **WHEN** a subsequent generation fails
- **THEN** the existing active routine remains unchanged

