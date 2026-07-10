# active-routine

The single active routine as persisted local state: how a generated routine
becomes the one the app remembers, how a later generation may replace it (never
silently), and the guarantee that exactly one exists at a time. Local-first —
the routine lives only in the browser.

## ADDED Requirements

### Requirement: First generated routine is adopted and persisted

When no routine exists and a generation succeeds, the system SHALL adopt the
generated routine as the active routine and persist it locally (IndexedDB),
without requiring an additional confirmation step.

#### Scenario: First success adopts the routine

- **GIVEN** a device with no active routine
- **WHEN** a generation completes successfully
- **THEN** the generated routine becomes the active routine and is persisted
  locally, with no extra save step required

#### Scenario: Adopted routine survives reload

- **GIVEN** a routine was adopted on this device
- **WHEN** the browser is fully reloaded or reopened
- **THEN** the same active routine is still present

### Requirement: Exactly one active routine

The system SHALL maintain at most one active routine at any time. Adopting a new
routine SHALL leave no more than one active routine persisted.

#### Scenario: No duplicate active routines after replacement

- **GIVEN** an active routine exists
- **WHEN** a new routine is adopted
- **THEN** exactly one active routine remains persisted (the new one)

### Requirement: Replacing an existing routine requires explicit confirmation

The system SHALL require explicit user confirmation before replacing an existing
active routine when a new generation succeeds. Without confirmation, the existing
routine SHALL remain the active routine.

#### Scenario: Confirming replaces the routine

- **GIVEN** an active routine exists and a new generation has succeeded
- **WHEN** the user explicitly confirms replacement
- **THEN** the new routine becomes the active routine and the previous one is
  discarded

#### Scenario: Declining keeps the current routine

- **GIVEN** an active routine exists and a new generation has succeeded
- **WHEN** the user declines or dismisses the replacement confirmation
- **THEN** the previous routine remains the active routine and the new one is not
  persisted

### Requirement: Active routine is readable across the app

The system SHALL expose the active routine (or its absence) so the home surface
can render it and so workout mode can be reached per day. Reading the active
routine SHALL NOT require a network call.

#### Scenario: Absence is distinguishable from presence

- **GIVEN** a device with no active routine
- **WHEN** the active routine is read
- **THEN** the result clearly indicates no routine exists (distinct from a loaded
  routine)
