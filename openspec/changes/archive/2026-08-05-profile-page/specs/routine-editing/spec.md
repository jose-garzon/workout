# routine-editing Specification (delta)

## MODIFIED Requirements

### Requirement: Edit affordance on home

When an active routine exists, home SHALL present an edit control next to the
routine title as the post-creation way to change the routine. The control SHALL be
icon-only — no visible text, no border, muted colour — and SHALL expose an
accessible name to assistive technology from a label rather than from visible
button text. When no active routine exists, no edit control SHALL be shown.

#### Scenario: Icon-only edit control present next to the routine title

- **GIVEN** a device with an active routine
- **WHEN** home is shown
- **THEN** an edit control is present next to the routine title, showing an icon
  with no visible text, no border, and a muted colour

#### Scenario: The edit control is named for assistive technology

- **GIVEN** a device with an active routine
- **WHEN** the edit control is inspected by assistive technology
- **THEN** it exposes an accessible name identifying it as the routine's edit
  control

#### Scenario: No edit control without a routine

- **GIVEN** a device with no active routine
- **WHEN** home is shown
- **THEN** no edit control is shown

#### Scenario: Behaviour is unchanged

- **GIVEN** a device with an active routine
- **WHEN** the user activates the edit control
- **THEN** the floating routine editor opens exactly as it did before the restyle
