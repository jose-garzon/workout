# first-run-routing

## Purpose

Routing on app open depends solely on whether this device has a saved profile,
and the home stub greets the returning user by name. This spec states only
*what*.

## Requirements

### Requirement: App open routes on presence of a saved profile

On app open, the app SHALL route to the welcome flow when no saved profile exists
on the device, and SHALL route directly to home when a saved profile exists. When
routing directly to home, the app SHALL NOT flash the onboarding flow.

#### Scenario: No saved profile routes to welcome

- **GIVEN** a device with no saved profile
- **WHEN** the app opens
- **THEN** the app routes to the welcome flow rather than home

#### Scenario: Saved profile routes straight to home

- **GIVEN** a device with a saved profile
- **WHEN** the app opens
- **THEN** the app routes directly to home without showing or flashing the
  onboarding flow

### Requirement: Home greets the user by name

The home screen SHALL display the saved display name. No other feature content is
required on home in this change.

#### Scenario: Home shows the saved name

- **GIVEN** a device with a saved profile
- **WHEN** the home screen is shown
- **THEN** it displays the user's saved display name
