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
reusing for any future multi-step flow with variable-length steps
(Feature B routine generation is the next likely candidate).
