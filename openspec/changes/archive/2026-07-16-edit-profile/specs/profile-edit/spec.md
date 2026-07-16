# profile-edit

The post-onboarding edit surface: a drawer (on both mobile and desktop),
pre-filled from the saved profile and goals, that lets the user change all 8
profile/goals fields with onboarding's exact validation and unit-awareness,
Save (persist + close), or discard by four affordances. This spec owns *what the
edit surface does*; the seam hook, drawer internals, and unit conversion are the
design's.

## ADDED Requirements

### Requirement: Edit drawer opens pre-filled from saved data

The system SHALL provide a profile drawer, openable from the home surface, that
opens over the app on both mobile and desktop and pre-fills every field with the
user's current saved value, converted to the user's chosen display unit.

#### Scenario: Opening the drawer shows saved values

- **GIVEN** a device with a saved profile and goals
- **WHEN** the user opens the profile drawer
- **THEN** all 8 fields (displayName, gender, age, unit, bodyweight, height,
  focus, daysPerWeek) are pre-filled with their current saved values
- **AND** bodyweight and height are shown in the user's chosen unit (kg/cm or
  lb/in)

#### Scenario: Drawer chrome is present

- **WHEN** the drawer is shown
- **THEN** `daysPerWeek` is presented as a two-column row and a Save control is
  present

### Requirement: Editing uses onboarding validation and unit-awareness

While the drawer is open, editing any of the 8 fields SHALL enforce the same
validation rules and unit-aware labels as onboarding.

#### Scenario: Field rules match onboarding

- **GIVEN** the drawer is open
- **WHEN** the user edits a field
- **THEN** that field enforces onboarding's rules (age 13–120, bodyweight
  required and positive, height optional, daysPerWeek 1–7, name/gender/focus
  required) and its label reflects the selected unit

### Requirement: Switching unit converts the shown values

While the drawer is open, changing the unit field SHALL convert the displayed
bodyweight and height to the newly selected unit (kg↔lb, cm↔in) so the shown
number matches its label, and a subsequent Save SHALL persist the correct
underlying value.

#### Scenario: Metric to imperial converts bodyweight

- **GIVEN** the drawer is open on a metric profile showing bodyweight 80 (kg)
- **WHEN** the user switches the unit field to imperial
- **THEN** the bodyweight field shows ~176 (lb) under a "(lb)" label, not 80
- **AND** saving without further edits persists a bodyweight equivalent to the
  original 80 kg

### Requirement: Save persists edits and closes the drawer

Activating Save with valid values SHALL write the updated profile and goals to
IndexedDB with no network call and then close the drawer; the app SHALL reflect
the new values.

#### Scenario: Valid Save persists and closes

- **GIVEN** the drawer is open with valid edits
- **WHEN** the user activates Save
- **THEN** the updated profile and goals are written to IndexedDB, no network
  request is made, and the drawer closes
- **AND** re-reading the profile reflects the new values

### Requirement: Invalid input blocks Save

Activating Save when any required field is empty or any field is invalid SHALL
NOT persist, and SHALL indicate the offending field(s) with the drawer left open.

#### Scenario: Empty required field blocks Save

- **GIVEN** the drawer is open and bodyweight has been cleared
- **WHEN** the user activates Save
- **THEN** nothing is persisted, the bodyweight field is indicated as invalid,
  and the drawer stays open

### Requirement: Four discard affordances close without saving

The drawer SHALL close and leave saved data unchanged when the user swipes right,
clicks the backdrop outside the drawer, activates the header close (X) button, or
presses Escape. None of these persists any edit.

#### Scenario: Swipe right discards

- **GIVEN** the drawer is open with unsaved edits
- **WHEN** the user swipes right
- **THEN** the drawer closes and the saved data is unchanged

#### Scenario: Backdrop, X, and Escape discard

- **GIVEN** the drawer is open with unsaved edits
- **WHEN** the user clicks the backdrop OR activates the X button OR presses
  Escape
- **THEN** the drawer closes and the saved data is unchanged

#### Scenario: Reopening after discard shows saved values

- **GIVEN** the user edited fields then discarded via any affordance
- **WHEN** the user reopens the drawer
- **THEN** every field again shows the saved value, not the discarded edit
