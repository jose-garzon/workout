# i18n Specification

## Purpose
TBD - created by archiving change i18n-spanish-support. Update Purpose after archive.
## Requirements
### Requirement: Language resolves from a stored choice, then from the browser

The app SHALL determine its display language from a language the user has chosen
on this device, if one exists. When no choice has been made, it SHALL fall back to
the browser's preferred language: a tag beginning with `es` (any region, any
casing) SHALL select Spanish; every other tag, including an unsupported one or
none at all, SHALL select English. A stored choice SHALL take precedence over the
browser's preferred language. The chosen language SHALL be the only
language-related value written to storage, and storing it SHALL NOT change any
storage schema.

#### Scenario: A Spanish browser with no choice gets Spanish

- **GIVEN** a browser whose preferred language is `es-ES` (or any `es-*` tag) and
  no language chosen on this device
- **WHEN** the app is opened
- **THEN** the display language is Spanish

#### Scenario: An English browser with no choice gets English

- **GIVEN** a browser whose preferred language is `en-US` (or any `en-*` tag) and
  no language chosen on this device
- **WHEN** the app is opened
- **THEN** the display language is English

#### Scenario: An unsupported or missing browser language falls back to English

- **GIVEN** a browser whose preferred language is `fr-FR`, or that reports no
  preferred language at all, and no language chosen on this device
- **WHEN** the app is opened
- **THEN** the display language is English

#### Scenario: A stored choice beats the browser's preferred language

- **GIVEN** a browser whose preferred language is `en-US` and a stored choice of
  Spanish
- **WHEN** the app is opened
- **THEN** the display language is Spanish

#### Scenario: The document language matches the resolved language

- **GIVEN** a stored choice of Spanish, or (with no choice) a browser preferring
  `es-ES`
- **WHEN** the app is opened
- **THEN** the document's language attribute is `es` before the first paint that
  contains any copy, so assistive technology pronounces the content correctly

#### Scenario: Only the chosen language is stored

- **WHEN** the app resolves its language and renders
- **THEN** the only language value in storage is the user's chosen language, if
  one has been chosen, and no storage schema changes

### Requirement: Changing the language applies immediately and persists

Choosing a language SHALL switch the visible UI copy to that language without a
reload, SHALL update the document's language attribute, and SHALL persist the
choice on-device so it still applies after a reload, regardless of the browser's
preferred language. Requests sent to the AI backend after the change SHALL carry
the newly chosen language.

#### Scenario: The UI switches without a reload

- **GIVEN** English is in effect
- **WHEN** the user chooses Spanish
- **THEN** the visible UI copy switches to Spanish with no reload, and the
  document's language attribute becomes `es`

#### Scenario: The choice survives a reload against a differing browser language

- **GIVEN** a browser whose preferred language is English and the user has chosen
  Spanish
- **WHEN** the app is reloaded
- **THEN** the app is still in Spanish

#### Scenario: AI content follows the chosen language

- **GIVEN** the user has chosen Spanish
- **WHEN** a routine is generated or edited after that point
- **THEN** the request carries Spanish as the active language and the returned
  exercise and day names are in Spanish

#### Scenario: Already-saved content is not retranslated

- **GIVEN** an active routine generated in English and the user chooses Spanish
- **WHEN** the app renders that routine
- **THEN** the app's own copy is in Spanish and the saved routine's stored names
  are left as they are

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
