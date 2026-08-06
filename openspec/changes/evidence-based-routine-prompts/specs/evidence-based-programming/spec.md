# evidence-based-programming Specification

## Purpose

The coaching frame both AI prompts carry: volume dose, split-by-frequency mapping, rep/rest bands per
exercise tier and per training focus, exercise-selection and ordering rules, age adjustments, the
edit-time diagnostic rules — and the invariants that keep all of it out of the emitted JSON.

## Requirements

### Requirement: Create prompt states a volume dose and a per-session cap

The routine-creation system prompt SHALL state a weekly hard-set range per muscle group and a
per-session hard-set cap per muscle group, and SHALL instruct the model to distribute volume across
training days rather than exceed the per-session cap. It SHALL state that frequency is a tool for
distributing volume, not an additional stimulus.

#### Scenario: Volume dose and cap are present for any profile

- **WHEN** the create messages are built for any profile and any prompt
- **THEN** the system prompt states a weekly per-muscle hard-set range
- **AND** it states a per-session per-muscle hard-set cap
- **AND** it instructs splitting volume across days rather than exceeding that cap

### Requirement: Split guidance is derived from the requested weekly frequency

The routine-creation system prompt SHALL carry split guidance selected from the requested
training-days count, and SHALL still require exactly as many day entries as requested. The mapping
SHALL cover every value: 2 or fewer, 3, 4, 5, and 6 or more days.

#### Scenario: Four days per week gets four-day split guidance

- **WHEN** the create messages are built with a training-days count of 4
- **THEN** the system prompt carries split guidance for a 4-day week
- **AND** the directive requiring exactly as many day entries as the requested count is still present

#### Scenario: Out-of-range day counts still get guidance

- **WHEN** the create messages are built with a training-days count of 1 or of 9
- **THEN** the system prompt still carries non-empty split guidance
- **AND** no error is thrown

#### Scenario: Fractional and non-finite day counts still get guidance

- **WHEN** the create messages are built with a training-days count of 3.5, and again with a
  non-finite number
- **THEN** the system prompt still carries non-empty split guidance in both cases
- **AND** no error is thrown

### Requirement: Rep and rest bands are stated per exercise tier and per focus

The routine-creation system prompt SHALL state rep and rest bands that distinguish heavy compounds,
secondary compounds, and isolation work. The bands SHALL vary by the user's training focus:
`strength` biases to lower reps and longer rest, `endurance` to high reps and short rest,
`hypertrophy` and `general` to the default bands, with `general` additionally asking for balanced
coverage of every major muscle group. An unrecognized focus value SHALL fall back to the default
bands rather than omitting the block.

#### Scenario: Tiered bands are present for any focus

- **WHEN** the create messages are built for any profile
- **THEN** the system prompt states rep and rest bands distinguishing heavy compounds, secondary
  compounds, and isolation

#### Scenario: Endurance focus gets a high-rep, short-rest band

- **WHEN** the create messages are built with focus `endurance`
- **THEN** the system prompt states a high-rep, short-rest band

#### Scenario: Strength focus gets a low-rep, long-rest band

- **WHEN** the create messages are built with focus `strength`
- **THEN** the system prompt states a low-rep, long-rest band

#### Scenario: General focus adds balanced muscle-group coverage

- **WHEN** the create messages are built with focus `general`
- **THEN** the system prompt states the default bands
- **AND** it additionally asks for balanced coverage of every major muscle group

#### Scenario: Unknown focus falls back to the default bands

- **WHEN** the create messages are built with a focus value that is not one of the four known focuses
- **THEN** the system prompt states the default (hypertrophy) bands
- **AND** no error is thrown

### Requirement: Bands never become range values in the emitted JSON

The routine-creation system prompt SHALL instruct the model to pick a concrete whole number inside
each stated band for every set's reps and rest, and SHALL forbid writing a range, a plus sign, or a
proximity-to-failure value into any schema field.

#### Scenario: Concrete-integer directive accompanies the bands

- **WHEN** the create messages are built for any profile
- **THEN** the system prompt instructs picking a concrete whole number inside the band for reps and
  rest, and forbids writing a range into any field

### Requirement: Exercise selection and ordering rules are stated

The routine-creation system prompt SHALL state exercise-selection rules: bias toward exercises that
load the muscle in a lengthened position, coverage of each trained muscle's functions, and ordering
exercises within a session from most to least technically demanding and systemically fatiguing.

#### Scenario: Selection and ordering rules are present

- **WHEN** the create messages are built for any profile
- **THEN** the system prompt states a lengthened-position bias
- **AND** it states per-muscle function coverage
- **AND** it states most-to-least-demanding ordering within a session

### Requirement: Age-conditioned adjustments apply below 18 and from 40 upward

The routine-creation system prompt SHALL carry an age adjustment block when the user's age is under
18 or 40 and above, and SHALL carry none from 18 through 39. Onboarding accepts ages from 13, so the
under-18 band is a reachable case. The 60-and-above block SHALL bias volume to the low end of the
range and bias the highest-load movements toward machines and cables. The under-18 block SHALL state
whole-body day composition, a moderate rep floor on every working set, and avoidance of near-maximal
loading; it SHALL NOT state technique instruction or a proximity-to-failure target, neither of which
the schema can carry.

#### Scenario: A 63-year-old gets the 60+ adjustment

- **WHEN** the create messages are built with age 63
- **THEN** the system prompt carries the low-end-volume and machine/cable-bias adjustment

#### Scenario: A 28-year-old gets no age adjustment

- **WHEN** the create messages are built with age 28
- **THEN** the system prompt carries no age adjustment block

#### Scenario: A 16-year-old gets the under-18 adjustment

- **WHEN** the create messages are built with age 16
- **THEN** the system prompt carries whole-body day composition, a moderate rep floor on every
  working set, and an avoid-near-maximal-loading instruction
- **AND** it carries no technique instruction and no proximity-to-failure target

#### Scenario: Band boundaries fall on the stated side

- **WHEN** the create messages are built with age 18, and again with age 40, and again with age 60
- **THEN** age 18 carries no age adjustment block, age 40 carries the mid-band adjustment, and age 60
  carries the 60-and-above adjustment

### Requirement: An age adjustment never changes the requested day count

An age adjustment block SHALL modify only how training days are composed, which exercises are
selected, and the rep and rest values used. It SHALL NOT state, cap, or comment on the number of
training days, and the directive requiring exactly as many day entries as requested SHALL take
precedence over any frequency guidance the source material attaches to an age band. Where an age
block narrows a value already set by the focus bands, the age block SHALL be stated after them and
SHALL say explicitly that it narrows the band above.

#### Scenario: A minor training six days a week still gets six days

- **WHEN** the create messages are built with age 16 and a training-days count of 6
- **THEN** the system prompt still requires exactly as many day entries as the requested count
- **AND** the age adjustment block states no weekly frequency, day cap, or day count of its own
- **AND** it states that the requested day count is kept and only day composition is adjusted

#### Scenario: The under-18 rep floor overrides a conflicting focus band

- **WHEN** the create messages are built with age 16 and focus `strength`
- **THEN** the age adjustment block appears after the focus bands
- **AND** it states that its rep floor narrows the band stated above it

#### Scenario: Age never surfaces in the emitted routine

- **WHEN** the create messages are built for any age
- **THEN** the system prompt still forbids naming the reasoning behind any adjustment in the routine
  name, subtitle, day names, or exercise names

### Requirement: The coaching frame governs reasoning only and never reaches the output

The system prompts SHALL state that the programming principles govern internal reasoning only, and
SHALL forbid explaining, justifying, reporting volume totals, or naming any concept the schema cannot
hold (proximity to failure, mesocycles, deloads, warm-ups, nutrition) anywhere in the response —
including the routine name, the subtitle, a day name, and an exercise name. No directive SHALL ask
the model a question or invite it to ask one; an unsupported request SHALL be answered by silently
designing the closest safe alternative.

#### Scenario: No directive asks the model to explain or report

- **WHEN** the create messages are built for any profile
- **THEN** no directive asks the model to explain, justify, report volume totals, or emit anything
  outside the one JSON object

#### Scenario: Principles are marked internal-only

- **WHEN** the create messages are built for any profile
- **THEN** the system prompt states that the principles are internal reasoning only and must not
  appear in the routine name, subtitle, day names, or exercise names

#### Scenario: Unsupported requests are handled silently

- **WHEN** the create messages are built for any profile
- **THEN** the system prompt instructs designing the closest safe alternative without explaining the
  deviation and without asking the user to clarify

### Requirement: The JSON output contract survives the longer prompt

The existing output contract, plain-language schema restatement, worked example,
generous-interpretation directive, and never-ask-for-clarification directive SHALL all remain present
in the create system prompt. Every coaching block SHALL appear BEFORE the output contract, and the
language directive SHALL remain the last block of the system prompt.

#### Scenario: Contract blocks are all still present

- **WHEN** the create messages are built for any profile
- **THEN** the output contract, the schema restatement, the example, the generous-interpretation
  directive, and the never-ask-for-clarification directive are all present

#### Scenario: Coaching blocks never bury the contract

- **WHEN** the create messages are built for any profile
- **THEN** every coaching block appears earlier in the system prompt than the output contract
- **AND** the output contract, schema restatement, and example appear in that order after them

#### Scenario: Language directive is still last

- **WHEN** the create messages are built for any profile and language
- **THEN** the language directive is the last block of the system prompt, after the example

#### Scenario: Response schema is unchanged

- **WHEN** the emitted routine is validated
- **THEN** it is validated against exactly the same schema as before this change, with no added or
  removed field

### Requirement: Edit prompt carries diagnostic rules for reading session history

The routine-edit system prompt SHALL state diagnostic rules for interpreting the recent workout
history, framed as guidance for shaping the change the user asked for: read adherence before
considering volume, require at least three exposures before treating a lift as stalled, weight
objective load-by-reps progression above subjective difficulty and fatigue ratings, cut exercises
rather than rest when time is the constraint, and preserve exercise continuity by changing an
exercise only for a stated reason. It SHALL state that an exercise never logged within the window may
have been added recently and must not be removed unless the instruction asks.

#### Scenario: Diagnostic rules are present on every edit

- **WHEN** the edit messages are built for any instruction
- **THEN** the system prompt states the adherence-first, three-exposure-minimum,
  objective-over-subjective, cut-exercises-not-rest, and exercise-continuity rules

#### Scenario: Diagnostics are scoped to the requested change

- **WHEN** the edit messages are built for any instruction
- **THEN** the system prompt frames the diagnostic rules as guidance for shaping the requested change,
  not as authorization for changes the instruction did not ask for

#### Scenario: A never-logged exercise is not treated as removable

- **WHEN** the edit messages are built for any instruction
- **THEN** the system prompt states that an exercise never logged in the window may have been added
  recently and must not be removed unless the instruction asks

### Requirement: Edit prompt forbids proactive revision

The routine-edit system prompt SHALL continue to require applying only the requested change and
leaving everything the instruction does not mention identical, and SHALL additionally forbid revising,
adding, removing, or rebalancing anything the instruction did not reference, however strongly the
history suggests it.

#### Scenario: Only the requested change, plus an explicit anti-proactive directive

- **WHEN** the edit messages are built for any instruction
- **THEN** the system prompt requires applying only the requested change and leaving everything
  unmentioned identical
- **AND** it explicitly forbids revising anything the instruction did not reference

### Requirement: Prompt building stays pure and server-safe

The prompt builders and the coaching content they use SHALL remain pure, deterministic, and free of
persistence, network, and browser-only imports, so the stateless proxy route's import firewall is
unaffected.

#### Scenario: Identical inputs produce identical messages

- **WHEN** the create messages are built twice with the same prompt, context, and language
- **THEN** the two results are deeply equal

#### Scenario: No browser-only module enters the server graph

- **WHEN** the architecture firewall checks run
- **THEN** neither the prompt builder nor the coaching content imports the persistence layer, any
  repository, or the browser AI client, and the checks pass
