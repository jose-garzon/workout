# routine-editing Specification

## Purpose
TBD - created by archiving change edit-routine. Update Purpose after archive.
## Requirements
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

### Requirement: Floating editor over the visible routine

Activating the edit button SHALL reveal a fixed editor docked at the bottom of
the screen that animates upward from the bottom on open. The routine content
SHALL remain visible and stationary behind the editor (not obscured by a dimming
scrim and not scrolled or moved). Dismissing the editor without submitting SHALL
animate it closed and leave the active routine unchanged.

#### Scenario: Editor rises from the bottom on open

- **GIVEN** a device with an active routine
- **WHEN** the user activates the edit button
- **THEN** a fixed editor docked at the bottom appears, animating upward from the
  bottom

#### Scenario: Routine stays visible and stationary behind the editor

- **GIVEN** the editor is open
- **WHEN** the user views the screen
- **THEN** the routine content is visible behind the editor and does not move or
  scroll while the editor is open

#### Scenario: Dismissing without submitting leaves the routine unchanged

- **GIVEN** the editor is open with no edit submitted
- **WHEN** the user dismisses it
- **THEN** the editor animates closed, the active routine is unchanged, and home
  returns to the routine view with the edit button

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

### Requirement: Edit-specific loading state

While an edit request is in progress, the system SHALL show a loading state that
uses edit-specific verbs (e.g. improving, enhancing, powering) distinct from the
routine-build verbs.

#### Scenario: Loading uses edit-specific verbs

- **GIVEN** an edit request in progress
- **WHEN** the loading state is shown
- **THEN** it uses edit-specific verbs distinct from the build verbs

### Requirement: The rest of the screen is blocked while an edit is loading

While an edit request is in flight, the system SHALL block interaction with the
rest of the screen behind the editor (the routine, the edit affordance, and app
chrome) — non-interactive to pointer and keyboard and removed from the tab order.
Interactivity SHALL be restored as soon as the request resolves, on both success
and failure. When the editor is open but no request is in flight, the routine
behind it stays interactive.

#### Scenario: Background is non-interactive during the request

- **GIVEN** an edit request is in flight
- **WHEN** the user attempts to interact with the routine or app chrome behind the
  editor
- **THEN** the interaction is refused (no pointer or keyboard reaches the
  background) until the request resolves

#### Scenario: Interactivity restores when the request resolves

- **GIVEN** an edit request has resolved (success or failure)
- **WHEN** the screen settles
- **THEN** the background is interactive again — on failure the editor stays open
  over an interactive routine so the user can retry or dismiss

### Requirement: Editor closes on success

When an edit succeeds, the editor SHALL animate closed (downward) and home SHALL
return to the normal routine view with the edit button.

#### Scenario: Success animates the editor closed

- **GIVEN** an edit request in progress
- **WHEN** it succeeds
- **THEN** the editor animates closed downward and home returns to the routine
  view with the edit button

### Requirement: Failed edits preserve the routine and keep the editor open

When an edit request fails, the system SHALL show a specific human-readable
message, leave the active routine unchanged, and keep the editor open so the user
can retry. When the device is offline, the system SHALL indicate a connection is
required, make no network call, leave the routine unchanged, and keep the editor
open.

#### Scenario: Backend error keeps the editor open

- **GIVEN** an edit request in progress
- **WHEN** the backend returns an error
- **THEN** a specific human-readable message is shown, the active routine is
  unchanged, and the editor stays open for retry

#### Scenario: Offline submission makes no network call

- **GIVEN** the device is offline
- **WHEN** the user submits an edit
- **THEN** the system indicates a connection is required, makes no network call,
  leaves the routine unchanged, and keeps the editor open

### Requirement: Edited routine preserves ids for unchanged content

An applied edit SHALL preserve the identifiers of days and exercises whose names
are unchanged, so that in-progress and completed workout history and calendar
records stay linked to them. Days and exercises that are newly added or renamed
SHALL receive fresh identifiers.

#### Scenario: Unchanged exercise keeps its previous-weight history

- **GIVEN** an exercise on a day that has recorded a logged weight in workout
  history
- **WHEN** the user applies an edit whose instruction does not reference that
  exercise or its day
- **THEN** that exercise retains its identifier and its previous logged weight is
  still shown when starting that day again

#### Scenario: A swapped-in exercise has no carried-over history

- **GIVEN** an active routine
- **WHEN** the user applies an edit that replaces one exercise with a
  differently-named exercise
- **THEN** the new exercise receives a fresh identifier and shows no previous
  logged weight
