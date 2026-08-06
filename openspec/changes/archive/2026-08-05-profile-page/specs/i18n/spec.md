# i18n Specification (delta)

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Language is resolved from the browser's preferred language

**Reason:** Superseded and renamed. The old requirement stated that the resolved
language "SHALL apply for the whole page lifetime and SHALL NOT be persisted to
any storage", and its "Nothing about language is stored" scenario made that
explicit. Both are now false by intent: the profile page lets the user pick a
language, that choice is stored on-device, it wins over browser detection, and it
takes effect at runtime rather than only for the current page lifetime.

**Migration:** Replaced by "Language resolves from a stored choice, then from the
browser" plus "Changing the language applies immediately and persists". Browser
detection is unchanged and is still the behaviour on any device where no choice
has been made, so existing installs — which have no stored choice — resolve
exactly as before. The three detection scenarios (`es-*` → Spanish, `en-*` →
English, unsupported/missing → English) and the document-language scenario are
carried over verbatim into the new requirement; only the "nothing is stored" rule
is dropped, and is replaced by "Only the chosen language is stored".
