## ADDED Requirements

### Requirement: Edit request carries a completed-session history summary

A submitted edit SHALL include an on-device summary of the active routine's
recent completed-session history in the request to the AI proxy, alongside the
current routine and the instruction, whenever that routine has one or more
completed sessions. The summary SHALL reflect only data workout-mode already records —
per-exercise logged weights and reps, adherence (sessions completed), and
difficulty/fatigue ratings where present — and MUST NOT introduce any new
capture or field.

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
- **THEN** it reports a per-exercise trend (session count and logged
  weights/reps) plus session-rating averages taken only over sessions that
  recorded them, using no data beyond what workout-mode already stores

#### Scenario: Experience-referencing instruction reaches the model with history

- **GIVEN** an active routine with completed sessions
- **WHEN** the user submits an instruction that references their experience
  (e.g. "ease off the bench, it's felt heavy")
- **THEN** the history summary is part of the payload the model sees, so the
  response can be informed by what the user actually logged rather than by the
  static routine alone

### Requirement: Edits proceed unchanged when there is no history

A submitted edit SHALL proceed exactly as a history-less edit when the active
routine has zero completed sessions (or no active routine exists): the request
SHALL omit the history summary, no error SHALL be shown, and submission SHALL
NOT be blocked. The request in this case MUST be equivalent to today's
history-less edit — no "no history" marker is sent.

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

### Requirement: Response contract unchanged for session-aware edits

A session-aware edit SHALL be held to the same strict JSON routine contract as
build and history-less edits (`response_format: json_schema` plus client-side
Zod validation). History is INPUT only; the response/output contract, routine
shape, and id-preservation behavior MUST NOT change. A malformed response SHALL
be rejected and the active routine left unchanged; a successful edit SHALL apply
only the requested change and preserve ids for unchanged days and exercises.

#### Scenario: Malformed response is rejected regardless of history

- **GIVEN** a session-aware edit whose request carried a history summary
- **WHEN** the AI returns a response that fails the strict JSON routine contract
- **THEN** the response is rejected, an error is surfaced, and the active
  routine is left unchanged

#### Scenario: Successful session-aware edit preserves ids for unchanged content

- **GIVEN** a session-aware edit that succeeds
- **WHEN** it is applied
- **THEN** only the requested change takes effect and ids for unchanged days and
  exercises are preserved, keeping workout history linked

### Requirement: History stays on-device except via the existing proxy

The history summary SHALL be computed on-device and sent ONLY to the existing
stateless AI proxy route — no new network call and no server-side persistence.
When no edit is in progress, nothing about session history SHALL leave the
browser.

#### Scenario: Dispatched edit uses only the existing proxy

- **GIVEN** an active routine with completed-session history
- **WHEN** the user submits an edit
- **THEN** the summary is computed in the browser and sent only to the existing
  stateless AI proxy route, with no new network call and no server-side
  persistence

#### Scenario: Idle history never leaves the browser

- **GIVEN** completed sessions stored on-device
- **WHEN** no edit is in progress
- **THEN** nothing about session history leaves the browser
