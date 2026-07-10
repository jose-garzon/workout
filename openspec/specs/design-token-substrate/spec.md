# design-token-substrate

## Purpose

The design substrate: runtime-themeable tokens, self-hosted fonts, and a
persistent no-flash theme toggle.

## Requirements

### Requirement: Design tokens resolve via CSS custom properties

Rendered screens SHALL resolve their design tokens (color, spacing, radius,
control heights, motion) through CSS custom properties, so a theme change reskins
the app at runtime by flipping a single attribute.

#### Scenario: Tokens resolve from CSS variables

- **WHEN** a screen renders in the default dark theme
- **THEN** its colors, spacing, radius, and control-height values resolve from
  CSS custom properties defined in the token substrate

### Requirement: Self-hosted fonts load without a CDN

The Anton and Barlow typefaces SHALL be served from `public/assets/fonts/` via
`@font-face` (`.woff2`). No font SHALL be requested from a third-party CDN.

#### Scenario: Fonts served from origin only

- **WHEN** the app loads and network requests are inspected
- **THEN** Anton and Barlow load from `public/assets/fonts/` via `@font-face`,
  and no font request goes to an external CDN

### Requirement: Theme choice persists across reload with no flash

The app SHALL default to the dark theme and provide a manual dark/light toggle.
A chosen theme SHALL persist across reload, and the correct theme SHALL be
applied before first paint with no flash of the wrong theme.

#### Scenario: Toggled theme survives reload without flashing

- **WHEN** the user toggles to the light theme and reloads the page
- **THEN** the app renders in the light theme on first paint with no flash of
  the dark theme
