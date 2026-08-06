# session-aware-editing Specification

## MODIFIED Requirements

### Requirement: Edit request carries a completed-session history summary

A submitted edit SHALL include an on-device summary of the active routine's
recent completed-session history in the request to the AI proxy, alongside the
current routine and the instruction, whenever that routine has one or more
completed sessions. The summary SHALL reflect only data workout-mode already records —
per-exercise logged weights and reps, adherence (sessions completed), and
difficulty/fatigue ratings where present — plus the active routine's prescribed
exercises and the user's saved weekly session target, and MUST NOT introduce any new
capture or field. It SHALL additionally report adherence against that weekly target,
per-exercise exposure count and trend direction, prescribed exercises never logged in
the window, and a training-time figure and direction. The summary SHALL be built by a
pure function that receives the sessions, the prescribed exercises, the split's day
count, and the weekly target as arguments, and performs no I/O of its own. An empty
session window SHALL still produce no summary.

#### Scenario: History present is included in the edit request

- **GIVEN** an active routine with one or more completed sessions
- **WHEN** the user submits an edit
- **THEN** the request to the AI proxy includes a summary of the active
  routine's recent completed-session history, in addition to the current routine
  and the instruction

#### Scenario: Summary reflects only recorded workout data

- **GIVEN** completed-session history with logged weights, reps, and some
  recorded difficulty/fatigue ratings
- **WHEN** the summary is built
- **THEN** it reports a per-exercise trend (exposure count and logged
  weights/reps) plus session-rating averages taken only over sessions that
  recorded them, using no data beyond what workout-mode already stores, the active
  routine, and the saved weekly target

#### Scenario: Experience-referencing instruction reaches the model with history

- **GIVEN** an active routine with completed sessions
- **WHEN** the user submits an instruction that references their experience
  (e.g. "ease off the bench, it's felt heavy")
- **THEN** the history summary is part of the payload the model sees, so the
  response can be informed by what the user actually logged rather than by the
  static routine alone

#### Scenario: Ratings line is still omitted when nothing was rated

- **GIVEN** completed sessions that recorded neither difficulty nor fatigue
- **WHEN** the summary is built
- **THEN** no session-ratings line is emitted

#### Scenario: Empty window still produces no summary

- **GIVEN** an empty session window
- **WHEN** the summary is built
- **THEN** the result is empty and the edit request carries no history block

#### Scenario: Summary is not shown to the user

- **GIVEN** any completed-session history
- **WHEN** the summary is built
- **THEN** it is written in a single fixed language regardless of the app's active
  language, weights are expressed in canonical kilograms with no unit conversion, and
  it is never rendered on screen

### Requirement: Edits proceed unchanged when there is no history

A submitted edit SHALL proceed exactly as a history-less edit when the active
routine has zero completed sessions (or no active routine exists): the request
SHALL omit the history summary, no error SHALL be shown, and submission SHALL
NOT be blocked. The request in this case MUST be equivalent to today's
history-less edit — no "no history" marker is sent. The user message of a
history-less edit SHALL remain byte-identical to the message built before this
change: current routine plus instruction, with no history block and no diagnostic
text. All new edit-time guidance SHALL live in the system message only.

#### Scenario: Zero completed sessions omits the summary and proceeds

- **GIVEN** an active routine with zero completed sessions
- **WHEN** the user submits an edit
- **THEN** the request omits the history summary, submission proceeds normally,
  and no error is shown

#### Scenario: Absent history leaves the request byte-identical to today's edit

- **GIVEN** an active routine with no completed-session history
- **WHEN** the edit request is built
- **THEN** the summary field is absent from the request body, making it
  equivalent to a history-less edit

#### Scenario: Missing and blank summaries produce the same user message

- **GIVEN** the same routine and instruction
- **WHEN** the edit messages are built with no summary, and again with a
  whitespace-only summary
- **THEN** both user messages are identical, contain the routine and the
  instruction, and contain no history block

#### Scenario: Present summary still appears as the same distinct history block

- **GIVEN** a non-empty session summary
- **WHEN** the edit messages are built
- **THEN** the summary appears in the user message as the same distinct
  "Recent workout history" block used before this change

## ADDED Requirements

### Requirement: Summary reports adherence against the saved weekly target

The summary SHALL report sessions completed against an expected session count derived from the
window the logged sessions span and the user's saved weekly target. The window SHALL span from the
earliest to the latest completed session in scope, inclusive, so a routine started mid-window is
measured only from its own first session. When the window spans less than one week, the summary
SHALL report the raw count and the span and SHALL NOT rate it. When no weekly target is saved, the
adherence line SHALL be omitted entirely rather than assuming a target.

#### Scenario: Sessions are reported against an expected target

- **GIVEN** 8 completed sessions whose earliest and latest are 20 days apart, which the inclusive
  span makes 21 days or 3.0 weeks, for a user whose saved target is 4 days per week
- **WHEN** the summary is built
- **THEN** it reports 8 sessions completed against an expected count of 12

#### Scenario: A sub-week window is reported but not rated

- **GIVEN** 3 completed sessions spanning 5 days, for a user whose saved target is 4 days per week
- **WHEN** the summary is built
- **THEN** it reports the session count and the span, and states that the window is under one week
  and not rated

#### Scenario: No saved target omits the adherence line

- **GIVEN** completed sessions and no saved weekly target
- **WHEN** the summary is built
- **THEN** no adherence line is emitted

#### Scenario: The window is stated so adherence is read in context

- **GIVEN** any non-empty session window
- **WHEN** the summary is built
- **THEN** the summary header states how many sessions the window holds and how many weeks it spans

### Requirement: Summary reports per-exercise exposures and a trend direction

The summary SHALL report, per exercise, the number of exposures in the window — one exposure being
one session that logged that exercise — and, when at least three exposures carry a usable load and
reps, a trend direction of up, flat, or down. The trend SHALL be computed from load multiplied by
reps over at most the last four usable exposures, comparing the earliest to the latest, with a
tolerance band so that small variation reads as flat. Sets whose weight is the unset/bodyweight
sentinel SHALL be excluded from the trend metric while still counting toward the exposure count.
Fewer than three usable exposures SHALL yield no trend for that exercise.

#### Scenario: Four rising exposures report an upward trend

- **GIVEN** an exercise logged in 4 sessions with strictly increasing load by reps
- **WHEN** the summary is built
- **THEN** that exercise is reported with 4 exposures and an upward trend

#### Scenario: Four identical exposures report a flat trend

- **GIVEN** an exercise logged in 4 sessions with the same weight and reps each time
- **WHEN** the summary is built
- **THEN** that exercise is reported with a flat trend

#### Scenario: Four falling exposures report a downward trend

- **GIVEN** an exercise logged in 4 sessions with decreasing load by reps
- **WHEN** the summary is built
- **THEN** that exercise is reported with a downward trend

#### Scenario: Two exposures declare no trend

- **GIVEN** an exercise logged in only 2 sessions
- **WHEN** the summary is built
- **THEN** that exercise is reported with 2 exposures and no trend direction

#### Scenario: Bodyweight-only exposures count but do not drive the trend

- **GIVEN** an exercise whose logged sets all carry the unset/bodyweight weight sentinel
- **WHEN** the summary is built
- **THEN** those sessions count toward its exposure count and no trend is declared from them

### Requirement: Summary names prescribed exercises never logged in the window

The summary SHALL name the exercises prescribed by the active routine that have zero exposures across
the whole window. This line SHALL be emitted only when the window holds at least as many sessions as
the routine has training days, so an exercise whose day has not yet come round is not reported as
skipped. The line SHALL be phrased as scoped to the window. A logged exercise that is no longer part
of the routine SHALL NOT be reported as skipped.

#### Scenario: Never-logged prescribed exercises are named

- **GIVEN** a routine of 12 prescribed exercises and a window of 12 sessions in which 4 of those
  exercises were never logged
- **WHEN** the summary is built
- **THEN** the summary names those 4 exercises as prescribed but never logged in the window

#### Scenario: Too few sessions suppresses the skipped line

- **GIVEN** a 4-day routine and a window of 2 completed sessions
- **WHEN** the summary is built
- **THEN** no skipped-exercise line is emitted

#### Scenario: A renamed exercise is not reported as skipped

- **GIVEN** a prescribed exercise that was renamed by an earlier edit but keeps its identity, and has
  logged sessions in the window
- **WHEN** the summary is built
- **THEN** it is not reported as skipped

#### Scenario: An exercise removed from the routine is not reported as skipped

- **GIVEN** logged sessions for an exercise that is no longer prescribed by the active routine
- **WHEN** the summary is built
- **THEN** that exercise is not reported as skipped

### Requirement: Summary reports a training-time figure and its direction

The summary SHALL report an average per-session training time equal to the sum of the logged work
seconds across all sets and the logged rest seconds across all exercises in that session. It SHALL
report a direction across the window only when the window holds at least four sessions, computed by
comparing the mean of the earlier half against the mean of the later half with a tolerance band so
that small variation reads as steady. No new stored field and no wall-clock session duration SHALL be
introduced.

#### Scenario: Training time is the sum of logged work and rest

- **GIVEN** sessions whose logs carry work seconds per set and rest seconds per exercise
- **WHEN** the summary is built
- **THEN** it reports a per-session training-time figure equal to their sum

#### Scenario: A four-session window reports a direction

- **GIVEN** a window of at least 4 sessions whose later sessions take substantially longer
- **WHEN** the summary is built
- **THEN** the training-time line reports a rising direction across the window

#### Scenario: A short window reports the figure without a direction

- **GIVEN** a window of 3 sessions
- **WHEN** the summary is built
- **THEN** the training-time line reports the average with no direction

### Requirement: Summary length stays bounded

The summary SHALL bound its own length regardless of how many exercises the window contains: the
per-exercise section SHALL be capped, the exercises kept SHALL be those with the most exposures, and
the omitted count SHALL be stated. The named skipped-exercise list SHALL likewise be capped with an
omitted count.

#### Scenario: A window with many exercises is truncated with a count

- **GIVEN** a window containing more distinct exercises than the per-exercise cap
- **WHEN** the summary is built
- **THEN** only the most-exposed exercises up to the cap are listed, and the number of omitted
  exercises is stated

#### Scenario: A full window stays within a modest size

- **GIVEN** a full 20-session window across a large routine
- **WHEN** the summary is built
- **THEN** the resulting summary stays within a few kilobytes, leaving the edit request well within
  its budget
