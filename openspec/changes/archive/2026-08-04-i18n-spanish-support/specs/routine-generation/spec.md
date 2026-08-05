# routine-generation

## MODIFIED Requirements

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
