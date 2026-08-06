# profile-edit Specification

## Purpose
TBD - created by archiving change edit-profile. Update Purpose after archive.
## Requirements
### Requirement: Edit page opens pre-filled from saved data

The system SHALL provide a dedicated edit-profile page, reached from the profile
page, that pre-fills every field with the user's current saved value, converted to
the user's chosen display unit.

#### Scenario: Opening the edit page shows saved values

- **GIVEN** a device with a saved profile and goals
- **WHEN** the user opens the edit-profile page
- **THEN** all 8 fields (displayName, gender, age, unit, bodyweight, height,
  focus, daysPerWeek) are pre-filled with their current saved values
- **AND** bodyweight and height are shown in the user's chosen unit (kg/cm or
  lb/in)

#### Scenario: Edit page chrome is present

- **WHEN** the edit page is shown
- **THEN** `daysPerWeek` is presented as a two-column row and a Save control is
  present

### Requirement: Editing uses onboarding validation and unit-awareness

While the edit page is open, editing any of the 8 fields SHALL enforce the same
validation rules and unit-aware labels as onboarding.

#### Scenario: Field rules match onboarding

- **GIVEN** the edit page is open
- **WHEN** the user edits a field
- **THEN** that field enforces onboarding's rules (age 13–120, bodyweight
  required and positive, height optional, daysPerWeek 1–7, name/gender/focus
  required) and its label reflects the selected unit

### Requirement: Switching unit converts the shown values

While the edit page is open, changing the unit field SHALL convert the displayed
bodyweight and height to the newly selected unit (kg↔lb, cm↔in) so the shown
number matches its label, and a subsequent Save SHALL persist the correct
underlying value.

#### Scenario: Metric to imperial converts bodyweight

- **GIVEN** the edit page is open on a metric profile showing bodyweight 80 (kg)
- **WHEN** the user switches the unit field to imperial
- **THEN** the bodyweight field shows ~176 (lb) under a "(lb)" label, not 80
- **AND** saving without further edits persists a bodyweight equivalent to the
  original 80 kg

### Requirement: Save persists edits and returns to the profile page

Activating Save with valid values SHALL write the updated profile and goals to
IndexedDB with no network call and then navigate back to the profile page; the app
SHALL reflect the new values.

#### Scenario: Valid Save persists and returns

- **GIVEN** the edit page is open with valid edits
- **WHEN** the user activates Save
- **THEN** the updated profile and goals are written to IndexedDB and no network
  request is made
- **AND** the app navigates to the profile page, which shows the new values

### Requirement: Invalid input blocks Save

Activating Save when any required field is empty or any field is invalid SHALL
NOT persist, SHALL indicate the offending field(s), and SHALL leave the user on
the edit page.

#### Scenario: Empty required field blocks Save

- **GIVEN** the edit page is open and bodyweight has been cleared
- **WHEN** the user activates Save
- **THEN** nothing is persisted, the bodyweight field is indicated as invalid,
  and the user stays on the edit page

### Requirement: Leaving the edit page without saving discards the edits

Navigating away from the edit page without activating Save SHALL leave the saved
data unchanged, and re-entering the edit page SHALL show the saved values rather
than the abandoned edits.

#### Scenario: Abandoned edits are not persisted

- **GIVEN** the edit page with unsaved changes in one or more fields
- **WHEN** the user leaves the page without saving
- **THEN** the saved profile and goals are unchanged

#### Scenario: Re-entering shows saved values

- **GIVEN** the user edited fields then left the edit page without saving
- **WHEN** the user opens the edit page again
- **THEN** every field again shows the saved value, not the abandoned edit

### Requirement: Profile editing is reachable only through the profile page

The only path to the profile form SHALL be header → profile page → edit page. No
profile drawer SHALL exist anywhere in the app, and the home screen SHALL present
no edit-profile control.

#### Scenario: Home has no profile drawer or edit control

- **GIVEN** a saved profile
- **WHEN** the home screen is shown
- **THEN** no profile drawer exists and no edit-profile control is present on home

#### Scenario: No drawer can be opened from anywhere

- **GIVEN** any screen in the app
- **WHEN** the user exercises every available control
- **THEN** no profile drawer opens

