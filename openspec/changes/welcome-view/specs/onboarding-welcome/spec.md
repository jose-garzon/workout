# onboarding-welcome

The first-run welcome screen: it introduces the app and offers a single entry
into setup. This spec states only *what*; the *how* is the architect's
`design.md`.

## ADDED Requirements

### Requirement: Welcome screen introduces the app and offers Start

The welcome screen SHALL display the app name, a one-line description of what the
app does, and a single primary Start action. Activating Start SHALL open the
profile setup form at its first step.

#### Scenario: Welcome screen shows identity and a Start action

- **GIVEN** a device with no saved profile
- **WHEN** the app opens
- **THEN** the welcome screen shows the app name, a one-line description of what
  the app does, and a single primary Start action

#### Scenario: Start opens the setup form

- **GIVEN** the welcome screen is shown
- **WHEN** the user activates Start
- **THEN** the profile setup form opens at step 1
