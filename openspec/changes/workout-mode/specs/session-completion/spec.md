# session-completion

The moment after the last exercise: a short, earned success view — congratulations
and a graphic — that also captures how the session felt via two optional 1–5
ratings, and a way back home. The completed session is already recorded by the
time this view appears, so nothing here is required in order to keep the workout.

## ADDED Requirements

### Requirement: A success view is shown when the session finishes

The system SHALL show a success view with a congratulatory message and a celebratory graphic when the day's final exercise is completed.

#### Scenario: Success view appears on finishing the day

- **GIVEN** a session in progress on the day's final exercise
- **WHEN** that exercise is completed and the session ends
- **THEN** a success view is shown with a congratulatory message and a celebratory graphic

### Requirement: Optional difficulty and fatigue ratings

The success view SHALL offer a difficulty rating (1–5) and a fatigue rating (1–5), storing each on the completed session when the user provides it, and MUST NOT require either in order to finish.

#### Scenario: Provided ratings are stored on the session

- **GIVEN** the success view is shown
- **WHEN** the user selects a difficulty value and a fatigue value
- **THEN** both values are stored on the completed session record

#### Scenario: Skipping the ratings still leaves a completed session

- **GIVEN** the success view is shown
- **WHEN** the user returns home without selecting a difficulty or fatigue value
- **THEN** the session remains recorded as completed with those ratings left unset

### Requirement: The completed session is recorded independently of the ratings

The completed session MUST be recorded when the final exercise finishes, so that leaving the success view — with or without ratings — never discards a finished workout.

#### Scenario: Closing the success view preserves the finished session

- **GIVEN** the success view is shown after the final exercise
- **WHEN** the view is left or the tab is closed before any rating is chosen
- **THEN** the finished session remains recorded as completed

### Requirement: Return to home from the success view

The success view SHALL provide an always-available control that returns the user to home.

#### Scenario: Back-home control returns to home

- **GIVEN** the success view is shown
- **WHEN** the user activates the return-home control
- **THEN** the user is taken to home and the session is no longer in progress
