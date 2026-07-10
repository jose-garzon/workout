---
name: project-welcome-view-status
description: welcome-view (Feature A onboarding) — merged and verified as of 2026-07-08 (44 tests green, T1 done); 2 post-merge polish fixes (vertical rhythm, breakpoints) also landed same day
metadata:
  type: project
---

As of 2026-07-08, `welcome-view` (Feature A: profile & goals / onboarding)
is **merged and verified**: 44 tests green, T1 done (`app/page.tsx` mounts
`FirstRunGate`, the old `ProfileGoalsScreen`/`ProfileGoalsBody` placeholder
retired), `tsc --noEmit` clean.

I (frontend-dev-designer) built the full designer slice (D1-D9): new
`shared/ui/primitives` atoms (`Input`, `ChoiceGroup`, `CountStepper`,
`Stepper`) and `modules/profile-goals/ui/{Splash,WelcomeFlow,
OnboardingForm,HomeScreen,FirstRunGate}.tsx`, plus RTL tests on
`OnboardingForm`. The software-engineer's slice (E1-E9) landed in parallel,
genuinely concurrent, not sequential.

**Post-merge polish round (same day, after the coordinator relayed 2 user
asks from my self-critique):**
1. *Vertical rhythm on short steps* — `OnboardingForm.tsx`'s field cluster
   was top-anchored under the `Stepper` while the CTA was bottom-anchored
   via `mt-auto`, leaving a large dead gap on short steps (1 and 2, ≤2
   fields) on tall viewports. Fixed by wrapping the fields in a
   `flex-1 justify-center` region between the (fixed) `Stepper` and the CTA
   block, and dropping the CTA's own `mt-auto` (the flex-1 sibling now
   absorbs the remainder, which keeps the CTA's bottom position IDENTICAL
   across all 3 steps — verified via screenshot comparison, not just
   asserted).
2. *Breakpoints* — only 390px had been checked before. Verified at 640px
   (sm) and 768px (md, tall) via Playwright: `AppShell`'s existing
   `max-w-[560px]` cap already keeps the intro description's measure
   reasonable (~2 lines, no single overlong line) at both — no component
   change was needed here, just verification.

**How to apply:** if asked to continue or check on `welcome-view`, check
`openspec/changes/welcome-view/tasks.md` checkbox state first — this memory
is a snapshot, not live status. The `flex-1 justify-center` pattern in
`OnboardingForm.tsx` (fixed header/tracker, centered variable content,
CTA pinned via a growing sibling rather than its own margin) is worth
reusing for any future multi-step flow with variable-length steps — it's
already been reused once, see [[project-routine-home-polish]] point 4.

**2026-07-10 — grew to 4 steps / 8 fields, verified as a pure-renderer
change with one deliberate non-fix.** The software-engineer added `gender`
(step 1, 3-option `ChoiceGroup` stack) and `age` (step 2, number input,
ordered before `unit`) to `model.ts`, `STEP_COUNT` 3→4. Confirmed the
"`OnboardingForm`'s `Field` is a pure mapper over `fields[]`, never
hard-codes step shape" contract (design.md §3.1) held exactly as
documented — zero UI code changes were needed for the new fields to render
correctly; only `OnboardingForm.test.tsx`'s hand-built `OnboardingApi` test
double needed updating (`stepCount: 3`→`4`, "Step 2 of 3"→"Step 2 of 4"
assertion) since it's a UI-owned file that hardcoded the old step count.

**Deliberate non-fix, worth recording so it isn't "fixed" reflexively
later:** at 360×740 (below the `sm` breakpoint, shorter than the common
390×844 target), step 4 — now the densest step, a 4-option `focus` stack +
`daysPerWeek` `CountStepper` — overflows the viewport by ~69px. Measured
via Playwright bounding boxes: the primary `Finish` CTA is ALWAYS fully
in-viewport with no scroll needed (confirmed y+height ≤ 740 exactly); only
the secondary `Back` button sits ~80% below the fold, reachable via a
single ordinary scroll with no clipping/jump once scrolled
(`scrollIntoViewIfNeeded` + bounding-box check confirmed a clean, exact
fit after scroll). Chose NOT to compress `ChoiceGroup`'s stack spacing or
any shared rhythm token to eliminate this — that would touch every other
step's already-verified vertical rhythm to fix one step at one
below-target viewport, and design-system.md §4.3 already locked
"comfortable, not compact" as the default over information density. The
rule that actually matters (primary CTA reachable without scroll,
design-system.md §2 "bottom-anchored... inside the thumb zone") holds at
every tested viewport; only a secondary, already-visited-once-per-flow
control needs a scroll on the single shortest tested phone. Re-evaluate
only if a 5th field is ever added to any step, or if a viewport shorter
than 740px becomes a real target.
