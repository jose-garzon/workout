---
name: project-workout-mode-ui
description: workout-mode (Feature D) UI build @2026-07-10 — Stopwatch phase-color/accent-budget design, Input gained a size="lg" live-numeral variant, ChoiceGroup reused (not rebuilt) for 1-5 ratings
metadata:
  type: project
---

Built `src/modules/workout-mode/ui/{WorkoutModeScreen,WorkoutModeBody,
SessionOverview,ExerciseView,Stopwatch,SuccessView}.tsx` in parallel with
the software-engineer's `logic/`, against the documented seam contract
(`useWorkoutSession(dayId)`). All groups 6/7/8.3 done; tsc/biome/depcruise
clean; 17 component tests green (mock the seam, independent of the
engineer's real engine) plus the pre-existing 106 tests still green.

**Stopwatch phase design (the one circular exception, design-system.md
§3.4) — how "one full-accent-fill per screen" holds across 4 phases:**
- `work`: solid `bg-accent` — the loud state, nothing else on the exercise
  screen is accent-filled at this moment (no CTA competes).
- `rest`: `bg-accent-wash` (tint, not the reserved full fill) + a draining
  SVG ring in `accent` stroke (a thin progress line, not read as "the"
  fill — same carve-out §3.4 gives the ring itself).
- `overtime`: `bg-warning` (a different token family entirely, so it never
  spends the accent budget), paired with a visible "Time's up — let's keep
  going" text label per the status-color pairing rule. Reused
  `text-on-accent` as "on-warning" text (near-black on the bright warning
  hue clears >10:1, same reasoning §3.1 gives for `on-accent`) — the token
  name doesn't say this explicitly, flagged in the component doc comment.
- `exercise-complete`: neutral border/surface, no pulse, so the "Next
  exercise" `Button` `ExerciseView` renders below is the only accent-filled
  thing on screen at that moment.
See [[feedback-radius-full-zeroed-and-errorboundary-hooks]] for the two
sharpest implementation gotchas hit building this (circle radius, error
boundary + hooks).

**`Input` primitive gained a `size?: "md" | "lg"` prop** (was hard-coded
56px) — `lg` is a NAMED design-system.md exception (§2 "Component sizing":
"the single most-used input in the app... `control-height-lg` 64px") for
exactly one real consumer: workout-mode's weight field. `lg` also renders
the typed value in `text-display` (Barlow 800, tabular-nums, 48px) — §3.2
explicitly names "any live/in-session weight-or-reps number" as using the
same live-numeral treatment as the rest-timer countdown, not just a bigger
label weight. Verified this fits: `CountStepper.tsx` already proves a
similarly-sized numeral (`text-display-brand`, 44px) inside the same 64px
row height.

**Reused `ChoiceGroup` for the two 1–5 ratings in `SuccessView` rather than
building a new "rating input" primitive** — tasks.md's group 7 said add a
rating primitive "ONLY if warranted"; `ChoiceGroup`'s existing generic
string-option segmented layout already covers "1".."5" with zero changes,
including the unselected-until-touched initial state ratings need (optional,
`value=""`). One less component, same accent-fill discipline
([[project-accent-fill-discipline]]) already built in.

**Error-state gap caught in self-critique, fixed same pass:** the original
`WorkoutModeBody`'s `ErrorBoundary` fallback reused `ComingSoon` (the
foundation-scope "not built yet" placeholder, which by its own doc comment
is explicitly NOT one of the product's real four states). That has no
actionable next step — a genuine miss against design-system.md's error-state
rule ("always paired with a next step"). Replaced with a real `ErrorState`
component (shares a `MessagePanel` shell with `NoRoutineState` — one
sentence + a bottom-anchored "back to home" `Button`). **Any future
`ErrorBoundary` fallback in a real (non-scaffold) feature should be checked
against whether it's still leaning on `ComingSoon` past the point where a
real error state should exist.**
