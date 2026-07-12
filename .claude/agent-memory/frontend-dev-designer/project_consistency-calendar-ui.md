---
name: project-consistency-calendar-ui
description: consistency-calendar (Feature C) UI build — accent-heatmap exception to the one-accent-fill rule, animated-drawer exit lifecycle pattern, backdrop-click-target trick
metadata:
  type: project
---

Built `src/modules/calendar/ui/{WeekCell,CalendarWeekStrip,YearGrid,
ActivityDrawer}.tsx` (2026-07-11) — a 7-cell home week strip (button that
opens a year-activity drawer) + a Jan→Dec heatmap grid. Verified visually
with real Playwright screenshots (dark/light, 320/375/390 widths) and
interaction scripts (Esc/backdrop/close-button dismiss, exit-animation
timing, reduced-motion instant-unmount, focus-on-open) — all passed first
try; typecheck/biome/depcruise/vitest (164 tests) all clean.

**1. The "exactly one accent fill per screen" rule (see
[[project-accent-fill-discipline]]) has a second sanctioned exception beyond
the Logo mark: a repeated status mark in a data heatmap.** Design.md/
proposal.md explicitly specced every "worked" day (week-strip cell AND
year-grid square) as full-saturation `accent`, and a week/year can have many
worked days on screen at once — directly reads as multiple full-yellow
blocks, which the rule's literal text forbids. Ran the `dataviz` skill
against this before building: a binary worked/not-worked mark across many
small non-competing cells is a **status/heatmap pattern**, not a "selected
control" competing with a primary CTA for attention — same grammar as
GitHub's contribution graph. Treated it as a second named exception (the
first being the Logo mark) and built it as specced, verified visually that
it does NOT read as competing with the composer's accent CTA below it on
home (screenshot-confirmed, both dark and light). **Reusable rule:** if a
future spec calls for accent fill on every item in a repeated array of
same-type marks (a heatmap, a status dot list), that's the same class of
exception — check with `dataviz` framing (status color, not categorical/
selection), don't reflexively downgrade to `accent-wash` the way a
"selected chip" would.

**2. Animated dialog exit needs a CSS counterpart the design system didn't
have — added `.anim-rise-exit` / `wp-rise-exit` to
`shared/ui/tokens/globals.css`.** The system only defined an entrance
`anim-rise`; AC "animates out, not removed synchronously" needed a real exit
keyframe (reverse of rise: opacity 1→0, translateY 0→8px, `ease-in` per the
existing "elements leaving" curve role) plus adding it to the
`prefers-reduced-motion` block alongside `anim-rise`. **The unmount-on-
`animationend` lifecycle also needs a JS-side reduced-motion check**, not
just the CSS media query: under reduced motion the CSS sets
`animation: none`, which never fires `animationend`, so a component that
only unmounts on that event hangs open forever. Fix: check
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` in the same
effect that would otherwise set the "closing" flag, and unmount synchronously
instead when it's true. **Reusable pattern for any future animated-exit
component** (toast, sheet, anything with `onClose` + a real exit animation).

**3. Backdrop click-to-dismiss without `stopPropagation` on the panel.**
The obvious pattern (backdrop `onClick={onClose}`, panel
`onClick={(e) => e.stopPropagation()}`) trips Biome's
`lint/a11y/useKeyWithClickEvents` on BOTH elements (2 violations, 2
biome-ignores). Cleaner: only the backdrop gets an `onClick`, guarded by
`if (event.target === event.currentTarget)` — a click that bubbled up from
inside the panel has a different `target`, so it's a no-op; the panel needs
no click handler at all. Still needs one biome-ignore pair on the backdrop
itself (`useKeyWithClickEvents` + `noStaticElementInteractions` — a
decorative full-screen scrim with Esc/close-button as its real keyboard
equivalents; deliberately not made a real focusable `<button>` since that'd
add a confusing extra Tab stop before the close button). **Reuse this
target-vs-currentTarget guard for any future backdrop-click-to-dismiss
without needing `stopPropagation` on the content.**

**4. `noArrayIndexKey` biome-ignore placement — confirmed the existing rule
from [[project-routine-home-polish]] generalizes beyond
`useExhaustiveDependencies`:** the suppression comment must sit directly
above the exact JSX line carrying the flagged prop (`key={...}`), not above
the parent opening tag one or more lines up — "no effect" if it's misplaced,
same one-line-directly-above rule as the effect-dependency case.

See also [[project-design-system-draft]] (design-system.md source of
truth) and [[project-routine-home-polish]] (the `weekStrip` slot's sibling
identity-block/routine-region layout it's inserted into, unchanged by this
change).
