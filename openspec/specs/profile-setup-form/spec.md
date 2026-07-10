# profile-setup-form

## Purpose

The step-by-step onboarding form that collects the locked field set with low
friction: at most two inputs per step, a visible step tracker, backward
navigation, and forward validation on required fields. This spec states only
*what*.

## Requirements

### Requirement: Each step shows at most two inputs with a step tracker

Each step of the setup form SHALL present at most two input fields and SHALL show
a step tracker indicating the current position and the total number of steps.

#### Scenario: A step presents no more than two inputs and a tracker

- **GIVEN** the setup form is open
- **WHEN** any step is shown
- **THEN** the step presents at most two input fields and a step tracker
  indicating the current step and the total (for example "Step 2 of 3")

### Requirement: Back navigation preserves entered values

Every step after the first SHALL provide a Back control that returns to the
previous step. Values already entered SHALL be preserved when navigating
backward or forward.

#### Scenario: Back returns to the previous step with values intact

- **GIVEN** the user is on any step after the first
- **WHEN** the user activates the Back control
- **THEN** the previous step is shown with its previously entered values intact

### Requirement: Forward navigation is blocked until required fields are valid

The setup form SHALL require display name, units, bodyweight, primary goal, and
training days per week. Height SHALL be optional. When a required field on the
current step is empty or invalid, the continue action SHALL NOT advance and the
offending field SHALL be indicated. A blank optional field SHALL NOT block
advancing.

#### Scenario: Continue is blocked when a required field is invalid

- **GIVEN** a step with a required field that is empty or invalid
- **WHEN** the user activates the continue action
- **THEN** the form does not advance and the offending field is indicated

#### Scenario: A blank optional field does not block advancing

- **GIVEN** a step whose optional field (height) is left blank and whose required
  fields are valid
- **WHEN** the user activates the continue action
- **THEN** the form advances to the next step

### Requirement: The setup form collects the locked field set

The setup form SHALL collect display name, units (metric or imperial, defaulting
to metric), bodyweight, height (optional), primary goal (strength, hypertrophy,
endurance, or general), and training days per week, grouped across three steps as
name plus units, then bodyweight plus height, then goal plus training days.

#### Scenario: All locked fields are collected across the three steps

- **GIVEN** the user completes the setup form
- **WHEN** the user reaches the final step
- **THEN** display name, units, bodyweight, height, primary goal, and training
  days per week have each been offered for entry

### Requirement: Units selection governs weight and height labels

The selected units SHALL govern the labels and interpretation of the bodyweight
and height inputs, showing kilograms and centimetres for metric and pounds and
inches for imperial.

#### Scenario: Imperial units relabel the body inputs

- **GIVEN** the units toggle is set to imperial
- **WHEN** the bodyweight and height inputs are shown
- **THEN** their labels and interpretation use pounds and inches

### Requirement: Finishing setup saves and lands on home

When all required fields are valid, the final step SHALL provide a finish action
that persists the profile and goals and then navigates to home.

#### Scenario: Finish saves and lands on home

- **GIVEN** the final step with all required fields valid
- **WHEN** the user activates the finish action
- **THEN** the profile and goals are saved and the user lands on home
