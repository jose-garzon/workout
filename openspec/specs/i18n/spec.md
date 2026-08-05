# i18n Specification

## Purpose
TBD - created by archiving change i18n-spanish-support. Update Purpose after archive.
## Requirements
### Requirement: Language is resolved from the browser's preferred language

The app SHALL determine its display language from the browser's preferred
language on load. A preferred language whose tag begins with `es` (any region,
any casing) SHALL select Spanish; every other tag, including an unsupported one
or none at all, SHALL select English. The resolved language SHALL apply for the
whole page lifetime and SHALL NOT be persisted to any storage.

#### Scenario: A Spanish browser gets Spanish

- **GIVEN** a browser whose preferred language is `es-ES` (or any `es-*` tag)
- **WHEN** the app is opened
- **THEN** the display language is Spanish

#### Scenario: An English browser gets English

- **GIVEN** a browser whose preferred language is `en-US` (or any `en-*` tag)
- **WHEN** the app is opened
- **THEN** the display language is English and the UI is identical to before this
  change

#### Scenario: An unsupported or missing language falls back to English

- **GIVEN** a browser whose preferred language is `fr-FR`, or reports no preferred
  language at all
- **WHEN** the app is opened
- **THEN** the display language is English

#### Scenario: The document language matches the display language

- **GIVEN** a browser whose preferred language is `es-ES`
- **WHEN** the app is opened
- **THEN** the document's language attribute is `es` before the first paint that
  contains any copy, so assistive technology pronounces the content correctly

#### Scenario: Nothing about language is stored

- **WHEN** the app resolves its language and renders
- **THEN** no language value is written to localStorage or IndexedDB and no
  storage schema changes

### Requirement: Every user-visible static string comes from a language dictionary

No user-visible static string SHALL be hardcoded in a component or in logic.
Every such string SHALL be looked up by key from a per-language dictionary, and
the app SHALL ship one dictionary per supported language (`en`, `es`) covering
every shipped screen: splash, welcome, each onboarding step, home (greeting,
motivational line, prompt composer, routine summary, building and edit
indicators), routine editor, profile drawer, week strip and weekly counter,
activity drawer and year grid, workout mode (session overview, rest default,
exercise view, stopwatch, success view, difficulty and fatigue ratings), and
shared UI (theme toggle, coming-soon, error boundary, primitive labels,
validation messages, error messages).

#### Scenario: Every shipped screen renders in Spanish

- **GIVEN** Spanish is the active language
- **WHEN** each shipped screen is visited — splash, welcome, each onboarding step,
  home, routine editor, profile drawer, activity drawer, year grid, session
  overview, exercise view, success view
- **THEN** all labels, buttons, headings, placeholders, empty states, validation
  messages and error messages are in Spanish, with no English text on screen

#### Scenario: Strings produced outside components are translated too

- **GIVEN** Spanish is the active language
- **WHEN** a message that is composed in logic rather than in a component is
  shown — for example the failure message for an AI edit
- **THEN** that message is in Spanish

#### Scenario: Dictionaries are bundled, not fetched

- **WHEN** the app loads and renders any screen
- **THEN** the language dictionaries are already part of the application bundle
  and no network request is made to obtain them

### Requirement: Placeholders are interpolated at render

A dictionary string MAY contain `{variable}` placeholders. When such a string is rendered with the corresponding runtime values, each placeholder SHALL be
replaced by its value, and the replacement SHALL work for repeated and for
multiple distinct placeholders in one string.

#### Scenario: A single placeholder is replaced

- **GIVEN** any active language and a string containing `{name}`
- **WHEN** it is rendered with a value for `name`
- **THEN** the value appears in place of `{name}` and no `{...}` token remains
  visible

#### Scenario: Multiple placeholders in one string are replaced

- **GIVEN** any active language and a step-indicator string containing
  `{current}` and `{total}`
- **WHEN** it is rendered with values for both
- **THEN** both values appear in place of their placeholders and no `{...}` token
  remains visible

### Requirement: A missing translation falls back to English

When a key is absent from the active language's dictionary, the system SHALL
render the English string for that key. It SHALL NOT render a blank, `undefined`,
or the raw key.

#### Scenario: A key missing from Spanish renders in English

- **GIVEN** Spanish is the active language and a key that is absent from the
  Spanish dictionary
- **WHEN** that key is rendered
- **THEN** the English string for that key is shown, and it is neither blank nor
  the raw key

### Requirement: Dictionary key parity is enforced by the build

The English dictionary SHALL be the reference key set. Any other language
dictionary SHALL contain exactly the same keys — no missing keys and no extra
keys — and a divergence SHALL fail the type check and the test suite rather than
degrade silently at runtime. Referencing a key that does not exist SHALL be a
type error.

#### Scenario: A key added to English but not to Spanish fails the check

- **GIVEN** a new key is added to the English dictionary
- **WHEN** the same key is not added to the Spanish dictionary
- **THEN** the type check and the test suite fail, naming the missing key

#### Scenario: A key present only in Spanish fails the check

- **GIVEN** a key exists in the Spanish dictionary but not in the English one
- **WHEN** the type check and the test suite run
- **THEN** they fail, naming the extra key

#### Scenario: An unknown key cannot be referenced

- **GIVEN** code that looks up a key that exists in no dictionary
- **WHEN** the type check runs
- **THEN** it fails
