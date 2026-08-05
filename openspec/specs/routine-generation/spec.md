# routine-generation Specification

## Purpose
TBD - created by archiving change routine-generation. Update Purpose after archive.
## Requirements
### Requirement: Prompt composer on home

Home SHALL present a prompt composer as its primary action when no active routine
exists, allowing the user to describe the routine they want in free text. When an
active routine exists, the standing prompt composer SHALL be hidden in favor of
the edit affordance (see the `routine-editing` capability), which becomes the
post-creation way to change the routine.

#### Scenario: Composer is present after onboarding

- **GIVEN** a device with a saved profile and no routine
- **WHEN** home is shown
- **THEN** a prompt composer is present as the primary action, ready for input

#### Scenario: Composer is hidden when a routine exists

- **GIVEN** a device with an active routine
- **WHEN** home is shown
- **THEN** the standing prompt composer is not shown

#### Scenario: Empty prompt cannot be submitted

- **GIVEN** the composer with no text (or only whitespace) entered
- **WHEN** the user attempts to submit
- **THEN** no generation request is made and submission does not proceed

### Requirement: Generate a routine from the prompt and saved profile

On submitting a non-empty prompt, the system SHALL request a routine from the AI
backend using the typed prompt, the user's saved profile and goals (goal,
training days per week, bodyweight, units), and the **active language**. The user
SHALL NOT be required to re-enter data already captured during onboarding. The
human-readable text of the returned routine — routine name, subtitle, day names
and exercise names — SHALL be in the active language. The response's structure,
its JSON keys, and its validation SHALL be unchanged by the language, and the
routine SHALL be adopted and persisted exactly as before.

#### Scenario: Submitting a prompt starts generation

- **GIVEN** a saved profile and a non-empty prompt in the composer
- **WHEN** the user submits
- **THEN** the system requests a routine from the AI backend, incorporating the
  saved profile and goals alongside the typed prompt

#### Scenario: The request carries the active language

- **GIVEN** a saved profile and a non-empty prompt in the composer
- **WHEN** the user submits
- **THEN** the request sent to the AI proxy carries the active language

#### Scenario: Generated routine text is in the active language

- **GIVEN** Spanish is the active language and a submitted prompt
- **WHEN** the backend returns a valid structured routine
- **THEN** the routine name, subtitle, day names and exercise names are in
  Spanish, and the routine is adopted and persisted exactly as before

#### Scenario: English behaviour is unchanged

- **GIVEN** English is the active language and a submitted prompt
- **WHEN** the backend returns a valid structured routine
- **THEN** the routine's text is in English and the whole flow behaves as it did
  before language was carried

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

