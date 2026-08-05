# consistency-tracker

## MODIFIED Requirements

### Requirement: Current-week strip on home

The home screen SHALL render a 7-cell week strip for the current week
(Monday→Sunday), positioned between the identity block and the routine summary.
Each cell reflects that day's completed sessions read from IndexedDB. The
weekday name in each cell's day label and the current-month label SHALL be
rendered in the **active language**, drawn from the same dictionary as the rest
of the UI (never from a browser locale API), so the calendar never disagrees with
the copy around it.

#### Scenario: Strip renders in place

- **WHEN** home loads
- **THEN** a 7-cell week strip appears between the identity block (greeting +
  goal badge + motivation line) and the routine summary region

#### Scenario: Worked day is accent with only the day label

- **WHEN** a day in the current week has at least one completed session
- **THEN** that day's cell is filled in the accent color and shows only the day
  label (weekday abbrev + day-of-month, e.g. "Mon 10" in English), centered, with
  no session name on the strip

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
- **THEN** a current-month label (the full month name, e.g. "July" in English)
  appears in the counter row

#### Scenario: Day and month labels follow the active language

- **GIVEN** Spanish is the active language
- **WHEN** the week strip and the counter row render
- **THEN** the weekday abbreviation and the month name are Spanish (e.g. "Lun 10"
  and "Julio"), with the same capitalisation convention as the rest of the UI

#### Scenario: English labels are unchanged

- **GIVEN** English is the active language
- **WHEN** the week strip and the counter row render
- **THEN** the labels read exactly as before — "Mon 10" and "July"
