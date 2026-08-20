# home-routine-dashboard Specification

## Purpose
TBD - created by archiving change routine-generation. Update Purpose after archive.
## Requirements
### Requirement: Identity header

Home SHALL show an identity header containing the user's saved display name and a
small badge indicating the user's saved training goal.

#### Scenario: Header shows name and goal badge

- **GIVEN** a device with a saved profile
- **WHEN** home is shown
- **THEN** the header displays the saved display name and a badge showing the
  user's training goal

### Requirement: Motivational line reflects the routine

When an active routine exists, the identity header SHALL show a short
motivational line specific to that routine (authored during generation). When no
routine exists, the header SHALL show a neutral invitation to build one instead.

#### Scenario: Routine present shows its motivational line

- **GIVEN** an active routine that carries a motivational line
- **WHEN** home is shown
- **THEN** the header shows that routine's motivational line

#### Scenario: No routine shows a neutral invitation

- **GIVEN** a device with a saved profile and no active routine
- **WHEN** home is shown
- **THEN** the header shows a neutral invitation to build a routine (not a
  routine-specific line)

### Requirement: Per-day routine summary

When an active routine exists, home SHALL present a summary of the routine as a
list of its days, each identifiable by name, giving an at-a-glance view of the
split. Each day SHALL render in one of three states taken from the current cycle:

- `next` — the one upcoming day: accent-highlighted, visually larger, and the
  FIRST card in the list;
- `finished` — completed in the current cycle: accent-wash background with the
  day number in accent text;
- `idle` — the existing gray card, unchanged.

Days other than `next` SHALL keep their natural routine order below it. Every
card SHALL show its own routine position number regardless of where it sits in
the list.

#### Scenario: Routine summary lists the days

- **GIVEN** an active routine with multiple days
- **WHEN** home is shown
- **THEN** home lists each day of the routine by name

#### Scenario: No routine shows no day summary

- **GIVEN** a device with a saved profile and no active routine
- **WHEN** home is shown
- **THEN** no per-day routine summary is shown (only the header and composer),
  and no `next` or `finished` treatment appears anywhere

#### Scenario: Fresh routine highlights day 1

- **GIVEN** a 5-day active routine with no completed sessions
- **WHEN** home is shown
- **THEN** day 1 renders as `next` and is the first card
- **AND** days 2, 3, 4, 5 render as `idle` in that order below it
- **AND** no card renders as `finished`

#### Scenario: Finished days show below the next day, in routine order

- **GIVEN** a 5-day active routine where days 1, 2, 3 have been completed in the
  current cycle
- **WHEN** home is shown
- **THEN** day 4 renders as `next` and is the first card
- **AND** the cards below read, in order: day 1, day 2, day 3, day 5
- **AND** days 1, 2, 3 render as `finished` and day 5 renders as `idle`

#### Scenario: Card numbers stay tied to the routine position

- **GIVEN** a 5-day active routine where day 3 renders as `next` and is therefore
  the first card
- **WHEN** home is shown
- **THEN** that card still shows the number `03`
- **AND** the card below it shows `01`

### Requirement: Tapping a day opens workout mode

When an active routine exists, the system SHALL let the user activate any day in
the summary to navigate to workout mode for that day. Workout mode is an
intentionally empty screen in this change.

#### Scenario: Activating a day navigates to workout mode

- **GIVEN** an active routine shown on home
- **WHEN** the user activates one of its days
- **THEN** the app navigates to workout mode for that day (an empty screen for
  now)

### Requirement: Day card state is perceivable without colour

The `next` and `finished` states SHALL be distinguishable from each other and
from `idle` by more than colour, and each SHALL carry a text equivalent available
to assistive technology. List position alone SHALL NOT be the only signal of the
`next` state.

#### Scenario: Next card is announced, not just coloured

- **GIVEN** an active routine shown on home
- **WHEN** a screen reader reads the day list
- **THEN** the `next` card's accessible name identifies it as the next day
- **AND** each `finished` card's accessible name identifies it as completed
