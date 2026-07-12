# workout-timer Specification

## Purpose

The single stopwatch control that carries the user through each series: it counts
work time up, then rest time down, and warns when rest runs out. It is the
heartbeat (design-system Principle 3) — exact, never smoothed, always the real
number. This spec states the states and their triggers and the "time's up" prompt;
the colors, pulse rhythm, and shape are the designer's.

## Requirements

### Requirement: A single control cycles work, rest, and overtime

The stopwatch SHALL be a single control whose taps cycle a series through a work interval, then a rest interval, and — if rest runs out before the user advances — an overtime state.

#### Scenario: Control starts in the work state for a series

- **GIVEN** the user has started an exercise or advanced to a new series
- **WHEN** the per-exercise view is shown
- **THEN** the stopwatch is in the work state, counting elapsed work time upward from zero for the current series

### Requirement: Tapping during work ends the series and begins rest

Tapping the control during the work state SHALL end the current series' work interval and begin a rest countdown from the session's default rest time.

#### Scenario: Work tap starts the rest countdown

- **GIVEN** the stopwatch is in the work state during a series
- **WHEN** the user taps the control
- **THEN** the work interval ends and the control enters the rest state, counting down from the session default rest time

### Requirement: Rest counts down and enters overtime when it elapses untapped

The rest state MUST count down to zero, and if the user has not tapped to continue by the time it reaches zero, the control SHALL enter an overtime state that surfaces an encouraging "time's up, let's continue" prompt.

#### Scenario: Rest completes without a tap enters overtime

- **GIVEN** the stopwatch is in the rest state
- **WHEN** the rest countdown reaches zero and the user has not tapped to continue
- **THEN** the control enters the overtime state and shows an encouraging "time's up, let's continue" prompt

### Requirement: Tapping during rest or overtime starts the next series

Tapping the control during the rest or overtime state SHALL end the rest and begin the next series in the work state — unless the completed series was the exercise's last.

#### Scenario: Tap during rest starts the next series

- **GIVEN** the stopwatch is in the rest state and unfinished series remain in the exercise
- **WHEN** the user taps the control
- **THEN** the rest ends and the stopwatch enters the work state for the next series

#### Scenario: Tap during overtime starts the next series

- **GIVEN** the stopwatch is in the overtime state and unfinished series remain in the exercise
- **WHEN** the user taps the control
- **THEN** the rest ends and the stopwatch enters the work state for the next series

### Requirement: Ending the final series completes the exercise without a trailing rest

Tapping to end the work interval of an exercise's last series SHALL complete the exercise directly, with no rest or overtime cycle afterward.

#### Scenario: Final series ends the exercise, not another rest

- **GIVEN** the stopwatch is in the work state during the exercise's last planned series
- **WHEN** the user taps the control to end that series
- **THEN** the exercise is marked complete and no rest countdown starts

### Requirement: The timer is exact and survives interruption

The countdown and elapsed values MUST always be the real values — never smoothed or estimated — and MUST remain correct across tab backgrounding and page refresh.

#### Scenario: Refresh during rest resumes the correct remaining time

- **GIVEN** the stopwatch is mid-rest with a known number of seconds remaining
- **WHEN** the tab is backgrounded or the page is refreshed and reopened
- **THEN** the control resumes in the correct state showing the true remaining time, consistent with the elapsed wall-clock time
