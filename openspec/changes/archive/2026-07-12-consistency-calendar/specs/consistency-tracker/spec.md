## ADDED Requirements

### Requirement: Current-week strip on home

The home screen SHALL render a 7-cell week strip for the current week
(Monday→Sunday), positioned between the identity block and the routine summary.
Each cell reflects that day's completed sessions read from IndexedDB.

#### Scenario: Strip renders in place

- **WHEN** home loads
- **THEN** a 7-cell week strip appears between the identity block (greeting +
  goal badge + motivation line) and the routine summary region

#### Scenario: Worked day is accent with only the day label

- **WHEN** a day in the current week has at least one completed session
- **THEN** that day's cell is filled in the accent color and shows only the day
  label (e.g. "Mon 10" — weekday abbrev + day-of-month), centered, with no
  session name on the strip

#### Scenario: Un-worked day is a muted placeholder

- **WHEN** a day in the current week has no completed session
- **THEN** that day's cell is a muted placeholder showing only the day label, with
  no session name

#### Scenario: Two sessions in one day render a single worked cell

- **WHEN** a day has two completed sessions
- **THEN** that day's cell is accent and renders as a single worked cell (no
  session name on the strip, no count badge)

#### Scenario: Current-month label appears in the counter row

- **WHEN** the week strip renders
- **THEN** a current-month label (the full month name, e.g. "July") appears in the
  counter row

### Requirement: Weekly target counter

WHEN an active routine exists, the strip SHALL display an "N of M this week"
counter, where N is the number of distinct days this week with at least one
completed session and M is the active routine's day count (`days.length`). WHEN
no active routine exists, the counter SHALL NOT be shown.

#### Scenario: Counter shown with an active routine

- **WHEN** an active routine with M days exists and the strip renders
- **THEN** an "N of M this week" counter appears alongside the strip with N =
  distinct worked days this week and M = the routine's day count

#### Scenario: N counts distinct days, not sessions

- **WHEN** another session is completed this week on a day not yet worked
- **THEN** N increases by one
- **WHEN** a second session is completed on an already-worked day this week
- **THEN** N does not change

#### Scenario: No routine hides the counter

- **WHEN** no active routine exists
- **THEN** the "N of M this week" counter is not shown

### Requirement: Activity drawer

Tapping the week strip SHALL open a drawer containing the full-year activity
tracker. The drawer SHALL animate on open and on close, and SHALL be dismissible
by tapping the backdrop, activating a close control, or pressing Esc.

#### Scenario: Open the drawer

- **WHEN** the user taps anywhere on the week strip
- **THEN** a drawer opens showing a title "Activity tracker", a short description,
  and the year grid

#### Scenario: Drawer animates in

- **WHEN** the drawer opens
- **THEN** it animates in rather than appearing instantly

#### Scenario: Drawer animates out

- **WHEN** the open drawer is dismissed
- **THEN** it animates out rather than disappearing instantly

#### Scenario: Dismissal restores home

- **WHEN** the drawer is open and the user taps the backdrop, activates the close
  control, or presses Esc
- **THEN** the drawer closes and home is fully interactive again

### Requirement: Full-year activity grid

The drawer SHALL render the current calendar year (Jan 1 → Dec 31) as a vertical
grid of rows of 7 day-squares (one per day), rows ordered top (January) to bottom
(December), aligned Monday-first. Individual squares are non-interactive.

#### Scenario: Grid layout

- **WHEN** the year grid renders
- **THEN** it is a vertical grid of rows of 7 day-squares, one square per day,
  ordered top (January) to bottom (December) for the current calendar year, with
  each row's columns aligned Monday-first

#### Scenario: Worked days are accent, others muted

- **WHEN** a day in the current year has at least one completed session
- **THEN** that day's square is accent
- **WHEN** a day in the current year has no completed session
- **THEN** that day's square is muted

### Requirement: Read-only and browser-only

The consistency tracker SHALL derive every view from IndexedDB alone and SHALL
make no network calls. It SHALL NOT create, edit, or delete any session, mark, or
annotation — it is a read-only reflection of `completedSessions`.

#### Scenario: No network, no writes

- **WHEN** the strip, counter, or year grid renders
- **THEN** all data is read from IndexedDB, no network request is made, and no
  completed-session record is created, modified, or deleted
</content>
