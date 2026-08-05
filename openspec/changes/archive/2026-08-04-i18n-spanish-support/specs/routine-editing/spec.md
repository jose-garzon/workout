# routine-editing

## MODIFIED Requirements

### Requirement: Submitting a targeted edit

A non-empty instruction submitted from the editor SHALL send the current active
routine, the instruction, and the **active language** to the AI backend, and on
success SHALL apply the returned routine directly with no confirmation dialog.
The applied result SHALL reflect the requested change while leaving the parts of
the routine the instruction did not reference unchanged. Any exercise or day the
edit newly adds or renames SHALL come back in the active language. An empty or
whitespace-only instruction SHALL NOT be submitted and SHALL make no request.

#### Scenario: Empty or whitespace instruction cannot be submitted

- **GIVEN** the editor is open with no text or only whitespace entered
- **WHEN** the user attempts to submit
- **THEN** no request is made and submission does not proceed

#### Scenario: Submitting sends the current routine, instruction and language

- **GIVEN** a non-empty instruction in the editor
- **WHEN** the user submits
- **THEN** the system sends the current active routine together with the
  instruction and the active language to the AI backend

#### Scenario: Newly added content comes back in the active language

- **GIVEN** Spanish is the active language and a submitted edit that adds an
  exercise
- **WHEN** the backend returns a valid updated routine
- **THEN** the newly added exercise's name is in Spanish

#### Scenario: English behaviour is unchanged

- **GIVEN** English is the active language and a submitted edit
- **WHEN** the backend returns a valid updated routine
- **THEN** the result is in English and the whole flow behaves as it did before
  language was carried

#### Scenario: Only the requested change is applied

- **GIVEN** a submitted edit
- **WHEN** the backend returns a valid updated routine
- **THEN** the active routine reflects the requested change and the parts the
  instruction did not reference remain unchanged

#### Scenario: A successful edit applies directly

- **GIVEN** a submitted edit that succeeds
- **WHEN** the update is applied
- **THEN** it takes effect directly with no confirmation dialog
