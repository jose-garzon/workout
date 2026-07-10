---
name: locked-product-decisions
description: workout-pal MVP product decisions the user locked in the first framing session (persona, scheduling, logging, AI boundary, scope edges)
metadata:
  type: project
---

The user resolved the opening product forks for workout-pal MVP on 2026-07-06. These are settled — do not re-litigate without a new signal.

- **Target persona (LOCKED):** intermediate gym-goer, full gym equipment, efficiency over hand-holding. Beginner/form-guidance concerns are dropped. Note: `config.yaml` still lists target user as open — this memory is the current truth until config is updated.
- **Scheduling / calendar (Feature C):** NO rigid dates. Weekly session target is DERIVED from the AI routine (e.g. "4 sessions/week"), not user-set. User trains whenever. Calendar only marks days a session was actually completed. No planned-vs-missed, no per-day guilt, no auto-reschedule. It's a completed-session log + consistency view ("3 of 4 target sessions this week").
- **Logging depth (Feature D):** richer than mark-complete. Per set, log actual weight + actual reps + actual rest taken. A per-session record exists. Progress analytics / PR charts are an explicit non-goal for now (data captured, not yet visualized).
- **Interrupted session (Feature D):** resume exactly where left off (set + timer state restored). Rest timer has skip/exit and restart controls.
- **AI boundary:** AI proposes routine STRUCTURE only (split, exercise selection, sets/reps/rest targets). App owns execution and never silently changes a saved routine. Regeneration requires explicit user confirmation.
- **One active routine at a time** for MVP; switching/library is a non-goal.
- **Timer cue:** visual countdown + best-effort audible/vibration at zero (permission-gated).
- **Offline:** everything works offline except AI generation (matches config hard constraint).
- **Feature A onboarding field set (LOCKED 2026-07-08, change `welcome-view`):** collected via a 3-step first-run form (≤2 inputs/step). REQUIRED: display name, units (metric/imperial, default metric), bodyweight, primary goal (strength/hypertrophy/endurance/general), training days/week. OPTIONAL: height (kept but cuttable). NOT collected: experience level (persona assumed intermediate), equipment (full-gym assumed), age/sex/injuries/diet (out of scope for a structure-only generator). Step grouping: name+units · bodyweight+height · goal+days. Maps to existing `Profile`/`Goals` types in `modules/profile-goals/types.ts`. Every required field earns its place by feeding Feature B (AI routine gen) or the home greeting.

**Why:** these define MVP scope and shape; the user made deliberate calls to keep it lean and avoid guilt-driven scheduling.
**How to apply:** every proposal.md and any scope discussion must stay consistent with these. See [[change-slicing-order]] for build order.
