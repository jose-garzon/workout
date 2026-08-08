## Why

workout-pal is already a PWA, but nothing tells the user to install it. Installed
means a home-screen icon, full-screen launch, and a reliable offline app at the
gym — the difference between a site you remember to open and an app you reach for.
Browsers only surface their own install affordance quietly, and iOS Safari never
does. Users stay on the tab version and lose the offline-first payoff the app was
built for.

## What Changes

- Add an install banner directly below the header on the **home screen only**.
- Banner content: a title, a muted description, and an install button on the right.
- When the browser offers a native install prompt, the button triggers it.
- When the browser offers no native prompt, the button is omitted and the
  description carries manual steps: iOS Safari gets its own wording, every other
  such browser gets one generic sentence.
- The banner is hidden whenever the app is already installed / running standalone,
  and disappears as soon as an install completes.
- New user-visible strings in `en.json` + `es.json`.

## User stories

1. As a gym-goer on Chrome/Android, I want a one-tap install so the app lives on
   my home screen and works offline in the gym.
2. As a gym-goer on iPhone Safari, I want to be told *how* to install, since my
   browser gives me no button.
3. As a user who already installed the app, I never want to see install nagging
   again.

## Acceptance criteria

### Native prompt available

- **GIVEN** the app is not installed and the browser offers a native install prompt
- **WHEN** the user opens the home screen
- **THEN** a banner appears below the header with a title, a muted description, and
  an install button positioned to the right

- **GIVEN** that banner is shown
- **WHEN** the user activates the install button
- **THEN** the browser's install flow is triggered

- **GIVEN** the user activated the install button
- **WHEN** the user declines the browser's install prompt
- **THEN** the banner stays on screen, the install button is no longer rendered, and
  the description switches to the manual install instructions

### No native prompt — iOS Safari

- **GIVEN** the app is not installed and the browser is iOS Safari
- **WHEN** the user opens the home screen
- **THEN** the banner appears with title and description, no install button is
  rendered, and the description names the Share menu and the "Add to Home Screen"
  action

### No native prompt — any other browser

- **GIVEN** the app is not installed, the browser offers no native install prompt,
  and it is not iOS Safari
- **WHEN** the user opens the home screen
- **THEN** the banner appears with title and description, no install button is
  rendered, and the description is a single generic sentence telling the user to add
  the app to their home screen from the browser menu

### No routine yet

- **GIVEN** the app is not installed and the user has no routine
- **WHEN** the user opens the home screen
- **THEN** the banner appears exactly as it does for a user who has a routine

### Already installed

- **GIVEN** the app is running as an installed app (standalone display mode)
- **WHEN** the user opens the home screen
- **THEN** no install banner is rendered anywhere on the screen

### Install completes while the banner is visible

- **GIVEN** the banner is visible on the home screen
- **WHEN** the installation completes
- **THEN** the banner is removed from the screen without a manual reload

### Home only

- **GIVEN** the app is not installed
- **WHEN** the user opens workout mode, the profile page, or onboarding
- **THEN** no install banner is shown on those screens

### Localization

- **GIVEN** the app language is English or Spanish
- **WHEN** the banner is shown
- **THEN** its title, description, and button label are rendered in that language

## Non-goals

- No dismiss control — no X, no "remind me later", no dismissal persistence.
- No banner on any screen other than home.
- No install analytics, tracking, or conversion metrics.
- No re-engagement nudges, toasts, modals, or repeat prompting.
- No change to what installing the PWA actually does (manifest, service worker,
  offline behaviour stay as they are).
- No push notifications or any other PWA capability beyond install.
- No server-side state — detection and display are entirely client-side.

## Priority

Single slice, ship whole. The no-native-prompt path is not optional: iOS is a
primary gym device and is exactly the platform with no built-in affordance.

## Capabilities

### New Capabilities

- `pwa-install-prompt`: home-screen banner that invites installation, adapts to
  whether the browser exposes a native install prompt, and disappears once the app
  is installed.

### Modified Capabilities

None. `pwa-offline` already asserts the app is installable; this change adds the
invitation, not new offline behaviour.

## Impact

- Home screen gains a new region below the header.
- New shared translation keys in `en.json` / `es.json`.
- No manifest, service worker, data model, or persistence changes.
- E2E coverage needs browser contexts both with and without a native install
  prompt, plus a standalone-mode context.
