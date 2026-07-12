---
name: project-accent-fill-discipline
description: How "exactly one full-saturation accent fill per screen" (design-system.md §2) plays out in practice on a form with a primary CTA + selection controls
metadata:
  type: project
---

design-system.md §2 "Color usage" is stricter than it first reads: "exactly
**one** element per view may use the full-saturation `accent` fill (the one
primary action, **or** the one active/selected indicator)" — it's an
either/or across the *whole* screen, not one-per-component-type. On any
screen that already has a primary CTA (Continue/Finish, `Button
variant="primary"`), every other "selected" affordance (a chosen unit
toggle, a chosen radio option) must NOT also use a full `bg-accent` fill —
it has to fall back to `accent-wash` (bg tint) + `accent-text` (border/text)
instead, per the system's own sanctioned "everything else" treatment.

**Why this matters:** it's an easy, plausible-looking mistake — a selected
segmented-toggle option filled solid `bg-accent` reads correct in isolation
(matches an iOS-style segmented control mental model) but breaks the rule
the instant it shares a screen with the primary CTA, which is nearly always
in this app given "one primary action per screen" is also a hard rule.

**How to apply:** built into `shared/ui/primitives/ChoiceGroup.tsx`
(`welcome-view` change) — selected state is `bg-accent-wash
text-accent-text border-accent-text`, never `bg-accent`. Reuse this
component (or its pattern) for any future single-select control rather than
reinventing a solid-fill "selected" state. `CountStepper.tsx` in the same
change sidesteps the question entirely by staying fully neutral (no accent
at all) since it has no discrete "selected vs. unselected" siblings to
contrast.

See also [[project-design-system-draft]] for the wider token/identity
context this rule lives in, and [[project-consistency-calendar-ui]] for a
second named exception (a repeated status mark in a data heatmap — every
"worked" day in the consistency calendar's week strip/year grid — is a
different grammar from a "selected control" and is allowed full `accent`
fill even with many on screen at once).
