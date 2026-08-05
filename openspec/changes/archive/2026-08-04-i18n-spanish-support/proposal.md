# Proposal — i18n-spanish-support (Spanish, from the browser's language)

## Why

Every string in the app is hardcoded English, so a Spanish-speaking gym-goer
reads an English UI *and* gets English exercise names back from the AI. Spanish
is the first non-English audience we want; adding it now — before more screens
land — is far cheaper than retrofitting text extraction later.

## What Changes

- A **hand-rolled translation system**: one JSON dictionary per language, keys
  resolved at render, `{variable}` interpolation (`"Today is {day}"` →
  `"Today is Monday"`). **No i18n library** (decided).
- **Two languages**: `en` (existing copy, extracted as-is) and `es` (new).
- **Language comes from the browser's preferred language**, detected
  automatically on load. `es-*` → Spanish; anything else or unknown → English.
  **No language selector in this change.**
- **All existing static UI text is translated** — every screen shipped today:
  splash/first-run, welcome + 4-step onboarding, home (greeting, motivational
  line, prompt composer, routine summary, building/edit indicators), routine
  editor, profile drawer, week strip + weekly counter, activity drawer + year
  grid, workout mode (session overview, rest default, exercise view, stopwatch,
  success view + difficulty/fatigue ratings), plus shared UI: theme toggle,
  coming-soon, error boundary, primitive labels, validation and error messages.
- **Calendar date labels follow the active language** (`"Mon 10"` → `"Lun 10"`,
  `"July"` → `"Julio"`). Weekday/month names are currently hardcoded English
  arrays, so a Spanish UI would otherwise show an English calendar.
- **The AI receives the active language** on both routine **creation** and
  **edit**, and returns exercise names and any generated text in that language.
  Same stateless proxy, no new network call.
- A **missing key falls back to English** rather than rendering a blank or a raw
  key.

## Capabilities

### New Capabilities

- `i18n`: the translation substrate — per-language JSON dictionaries,
  `{variable}` interpolation, browser-language detection with English fallback,
  missing-key fallback, and the rule that no user-visible static string is
  hardcoded in a component. Covers full `en` + `es` coverage of every shipped
  screen.

### Modified Capabilities

- `routine-generation`: the generation request SHALL carry the active language,
  and the returned routine's exercise names/text SHALL be in that language.
  (Today's requirement says the request carries prompt + profile only.)
- `routine-editing`: the edit request SHALL likewise carry the active language,
  so edited/added exercises come back in it and a routine doesn't end up
  half-Spanish.
- `consistency-tracker`: the day label and current-month label SHALL be rendered
  in the active language (its scenarios currently pin `"Mon 10"` / `"July"`).

**Not modified — and why.** `ai-proxy-route`'s requirements are statelessness and
the import firewall only; forwarding one more request field changes neither.
`onboarding-welcome`, `profile-setup-form`, `profile-edit`, `first-run-routing`,
`home-routine-dashboard`, `session-overview`, `exercise-execution`,
`session-completion`, `session-tracking`, `workout-timer`, `active-routine` all
describe *behavior*, not literal copy (e.g. "a step indicator showing current and
total", "a human-readable message") — translating their strings satisfies them
unchanged, so no deltas.

## User stories & acceptance criteria

**Story 1 — I open the app and it speaks my language.** *As a Spanish-speaking
gym-goer, I want the app in Spanish automatically, so I don't hunt for a setting.*

- **AC1.1** GIVEN a browser whose preferred language is `es-ES` (or any `es-*`)
  WHEN the app is opened for the first time THEN every visible static string
  renders in Spanish, with no English text on screen.
- **AC1.2** GIVEN a browser whose preferred language is `en-*`, or is unset or
  unsupported (e.g. `fr-FR`) WHEN the app is opened THEN the UI renders in
  English, identical to today.
- **AC1.3** GIVEN any language WHEN a string with a placeholder is rendered
  (e.g. step indicator `{current}`/`{total}`, greeting `{name}`) THEN the
  placeholder is replaced with the runtime value and no `{...}` token remains
  visible.
- **AC1.4** GIVEN a key missing from the Spanish dictionary WHEN it is rendered
  THEN the English string is shown — never a blank, never the raw key.

**Story 2 — nothing was left behind.** *As a Spanish user, I don't want to hit an
English screen halfway through a workout.*

- **AC2.1** GIVEN `es` is active WHEN each shipped screen is visited — splash,
  welcome, each onboarding step, home, routine editor, profile drawer, activity
  drawer, year grid, session overview, exercise view, success view — THEN all
  labels, buttons, headings, placeholders, empty states, validation messages and
  error messages are Spanish.
- **AC2.2** GIVEN `es` is active WHEN the week strip and month counter render
  THEN weekday and month names are Spanish (e.g. `Lun 10`, `Julio`).

**Story 3 — my routine is in my language too.** *As a Spanish user, I want
"Press de banca", not "Bench Press".*

- **AC3.1** GIVEN `es` is active WHEN the user submits a prompt to generate a
  routine THEN the request sent to the AI proxy carries the active language.
- **AC3.2** GIVEN that request WHEN the AI returns a valid routine THEN exercise
  names and any generated text are in Spanish, and the routine is adopted and
  persisted exactly as today (contract and validation unchanged).
- **AC3.3** GIVEN `es` is active and an active routine WHEN the user submits an
  edit THEN the edit request carries the language and any new/renamed exercises
  come back in Spanish.
- **AC3.4** GIVEN `en` is active THEN AC3.1–AC3.3 hold with English, i.e.
  behavior is unchanged from today.

**Story 4 — demonstrable output.** GIVEN a browser configured with Spanish as its
preferred language WHEN the app is loaded and a routine is generated THEN the
whole experience — UI and generated routine — is in Spanish. This is the bar for
"done".

## Non-goals

- **No language selector / switcher UI.** Browser preference is the only source
  in this change.
- **No persisted per-user language override.** Nothing stored, nothing to
  migrate.
- **No third language.** `en` + `es` only.
- **No retroactive re-translation of stored data.** A routine generated in
  English stays English until it is regenerated or edited; we do not translate
  content already in IndexedDB, nor the user's own typed prompts.
- **No QA/validation process for AI-generated Spanish.** We ask the model for the
  language; we don't build review tooling for what it returns.
- **No locale-driven units or number formats.** kg/lb stays a user choice,
  independent of language.
- **No RTL or layout-direction work.**
- **No translation of PWA install metadata** (manifest name/description).

## Impact

- **Every shipped UI file** across `profile-goals`, `routine-generation`,
  `workout-mode`, `calendar`, and `shared/ui` — strings move out of components
  into dictionaries.
- **Calendar day/month labels** — currently hardcoded English arrays in the
  calendar's logic layer.
- **Routine build + edit requests and the AI prompt** — gain a language field;
  response contract, schema validation, statelessness and the import firewall are
  all unchanged.
- **Tests** — existing tests assert English copy and will need to resolve strings
  through the same system.
- **No new runtime dependency** (explicitly: no i18n library), no server-side
  persistence, no additional network calls.
- *Where the dictionaries live, how language is detected and delivered to
  components, and how the seam reaches the AI layer are the architect's calls in
  `design.md`.*
