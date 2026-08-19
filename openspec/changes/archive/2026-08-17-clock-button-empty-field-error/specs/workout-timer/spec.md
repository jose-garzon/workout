# workout-timer Delta

## ADDED Requirements

### Requirement: A blocked stopwatch stays tappable and answers the tap

While a set is armed but cannot start because a required field is empty, the stopwatch MUST keep its distinct "waiting" appearance, MUST remain keyboard-reachable and tappable, and MUST be exposed to assistive technology as unavailable-for-now via `aria-disabled` semantics rather than a native `disabled` attribute, which would swallow the tap. A tap in this state MUST NOT start the set and MUST instead surface which fields are missing. A hint below the control MUST name both required fields.

#### Scenario: The blocked control is reachable and reports the block

- **GIVEN** a set is armed and at least one of reps or weight is empty
- **WHEN** the stopwatch is presented
- **THEN** it keeps its distinct "waiting" appearance, is reachable by keyboard and tappable, and is announced to assistive technology as unavailable for now rather than being a native disabled control

#### Scenario: A tap while blocked gives feedback instead of nothing

- **GIVEN** a set is armed and at least one of reps or weight is empty
- **WHEN** the user taps the stopwatch
- **THEN** no work interval starts and the empty fields are surfaced to the user rather than the tap being silently ignored

#### Scenario: The hint names both required fields

- **GIVEN** a set is armed and at least one of reps or weight is empty
- **WHEN** the hint below the stopwatch is shown
- **THEN** it names both the reps field and the weight field, not weight alone
