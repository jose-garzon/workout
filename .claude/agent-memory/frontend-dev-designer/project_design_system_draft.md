---
name: project-design-system-draft
description: Design system at openspec/design-system.md — v0.3, sharp-rectangle/big-tap-target athletic identity, one fork (density) still open
metadata:
  type: project
---

`openspec/design-system.md` is the design-language source of truth (parallel
to `openspec/config.yaml`) — principles, guidelines, and full token set
(color for light+dark, type scale, spacing, radius/shape, elevation, motion,
breakpoints, z-index).

**v0.1 (2026-07-06):** initial draft, calm/Linear-style identity (indigo
accent, system-ui font, moderate 4-16px radii), 5 open forks.

**v0.2 (2026-07-06), same day:** user rejected the calm identity for an
**energetic gym-brand** one. Dark theme became default/preferred (light
stays first-class, manual persisted toggle). Accent became **Electric
Yellow `#E8FF3D`** with near-black (`#0B0B0B`) `on-accent` text — white text
on this accent fails AA (1.12:1). Typography became self-hosted **Anton**
(titles, static big numbers) + **Barlow** (body + the live/critical numeric
display), replacing system-ui. Radius (4-16px) was reconfirmed as-is.

**v0.3 (2026-07-06), same day again:** user refined shape/sizing —
**reversed** the v0.1/v0.2 radius call. Current state:
- **Shape:** zero border radius anywhere in the rectangular UI (buttons,
  inputs, cards, list rows, sheets, modals, tags/badges are all sharp
  rectangles). The one exception is genuinely circular shapes — the
  rest-timer progress ring stays a circle; that was never part of the
  radius scale to begin with.
- **Sizing:** new component-sizing tokens — `control-height-md` 56px
  (default buttons/inputs), `control-height-lg` 64px (the one primary CTA
  per screen + any mid-set control like rest-timer skip/restart), both well
  above the 44px WCAG floor (`tap-target-min`). Spacing rhythm shifted
  toward its larger steps (screen padding 20/32px, was 16/24px).
- **Density:** still the one open fork, unaddressed across all three
  rounds.
- Color, type, motion, a11y rules, and the four states are explicitly
  unchanged from v0.2 in this round.

**Why:** the user has now reversed a visual-identity decision (radius) in
the same session it was made, and made two consecutive same-day directional
pivots overall. Don't treat any single round of "resolved" forks as
permanent — always check the file's version number and status line first.
The pattern so far: v0.2 changed color/type, v0.3 changed shape/sizing,
neither touched principles/motion-doctrine/a11y/states — the user is
iterating on visual identity in layers, not rewriting UX doctrine each time.

**How to apply:** read `openspec/design-system.md` first for any UI work —
check version/status before assuming currency. Invariants worth preserving
across future rounds: (1) neutral scale, ink roles, and status colors stay
hex-identical to the `dataviz` skill's reference palette; (2) any new accent
gets checked against `dataviz`'s categorical/status hues AND specifically
against `warning` (yellow-family collision risk, resolved via hue
separation + different visual grammar, not by moving `warning`); (3) when
sizing/shape changes, re-verify the focus-ring recipe still passes contrast
(a plain accent-colored ring measured 1.06:1 on light in v0.2 — needed a
two-layer near-black+accent ring; re-check if the accent or a11y approach
ever changes); (4) don't assume `on-accent` is white — check both text-on-
color directions before picking one.
