# routine-generation Specification (delta)

## MODIFIED Requirements

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
