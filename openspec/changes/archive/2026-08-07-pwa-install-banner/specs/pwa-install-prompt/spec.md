# pwa-install-prompt

The home-screen invitation to install the PWA. *How* (where the hook lives,
detection, tokens) is in [`design.md`](../../design.md); this spec states only
*what*.

## ADDED Requirements

### Requirement: Install banner on the home screen

While the app is not installed, the home screen SHALL render an install banner
directly below the header, containing a title and a muted description. The
banner SHALL NOT render on any other screen.

#### Scenario: Banner appears on home

- **WHEN** the user opens the home screen and the app is not installed
- **THEN** a banner is rendered below the header with a title and a muted
  description

#### Scenario: Banner appears with no routine yet

- **WHEN** the user opens the home screen with no routine created and the app is
  not installed
- **THEN** the banner appears exactly as it does for a user who has a routine

#### Scenario: Not shown on other screens

- **WHEN** the user opens workout mode, the profile page, or onboarding while
  the app is not installed
- **THEN** no install banner is rendered on those screens

### Requirement: Native install prompt

When the browser exposes a native install prompt, the banner SHALL render an
install button to the right of the text, and activating it SHALL trigger the
browser's install flow. When no native prompt is available, no install button
SHALL be rendered.

#### Scenario: Button shown and triggers the browser flow

- **WHEN** the browser has offered a native install prompt and the user
  activates the banner's install button
- **THEN** the browser's install flow is triggered

#### Scenario: Native prompt is declined

- **WHEN** the user declines the browser's install prompt
- **THEN** the banner remains on screen with manual instructions and no install
  button

### Requirement: Manual install instructions

When no native install prompt is available, the banner's description SHALL tell
the user how to install manually, in one of exactly two variants: an iOS variant
and a generic variant.

#### Scenario: iOS device

- **WHEN** the user opens the home screen on an iOS device, the app is not
  installed, and no native prompt is available
- **THEN** the banner renders title and description, no install button, and the
  description names the Share menu and the "Add to Home Screen" action

#### Scenario: Any other browser without a native prompt

- **WHEN** the user opens the home screen on a non-iOS browser that offers no
  native install prompt and the app is not installed
- **THEN** the banner renders title and description, no install button, and the
  description is a single generic sentence telling the user to add the app to
  their home screen from the browser menu

### Requirement: Hidden once installed

The banner SHALL NOT be rendered while the app is running as an installed app,
and SHALL disappear as soon as an installation completes.

#### Scenario: Running standalone

- **WHEN** the home screen is opened in standalone display mode
- **THEN** no install banner is rendered anywhere on the screen

#### Scenario: Install completes while the banner is visible

- **WHEN** the installation completes while the banner is on screen
- **THEN** the banner is removed without a manual reload

### Requirement: Localized banner strings

The banner's title, description, and button label SHALL be rendered in the
active application language.

#### Scenario: English and Spanish

- **WHEN** the banner is shown with the app language set to English or Spanish
- **THEN** its title, description, and button label are rendered in that
  language
