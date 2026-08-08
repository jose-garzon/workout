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

- **i18n (LOCKED 2026-08-04, change `i18n-spanish-support`):** hand-rolled translation system — NO i18n library (react-intl/next-intl/i18next all rejected). Per-language JSON dictionaries, `{variable}` interpolation. Languages: `en` + `es` only. Active language comes from the BROWSER's preferred language, auto-detected; a manual language switcher is deliberately deferred to a later change, not rejected. Active language is also sent to the AI on routine create AND edit so exercise names come back translated. **UPDATED 2026-08-05 (change `profile-page`):** the deferred manual language switcher is now IN — a language select on the new profile page, with the user's choice persisted on-device and winning over browser detection. This intentionally breaks the earlier "nothing about language is stored" requirement in `openspec/specs/i18n/spec.md`.

- **Personal-settings surface (2026-08-05, change `profile-page`):** there is ONE profile page, reached from a user-icon button in the app header (which REPLACES the header theme toggle). It holds the name, an entry to the profile edit form (its own page, not a drawer — the ProfileDrawer is removed), and a bottom row with theme toggle + language select at 50% width each. Home is left as pure routine content: no edit-profile affordance there.

- **Routine day cycle (LOCKED 2026-08-08, change `highlight-next-workout-day`):** home day cards have three states — `idle` (gray), `next` (accent-highlighted, rendered FIRST in the list), `finished` (accent-wash bg + accent number, same treatment as GoalBadge/InstallBanner). Progress is a CYCLE, not a week: it never resets on a calendar boundary. `next` = the day after the last finished day, wrapping; empty cycle → day 1. Reset happens on FINISH only (never on starting/opening a day) and only in two cases: (a) the last outstanding day is finished → all back to idle, next = day 1; (b) a day already finished this cycle is finished again → only that day stays finished, all others drop to idle. Case (a) fires when EVERY day is finished, whichever day completes the set — not literally the last day in order. `next` beats `finished` when the pointer wraps onto an already-finished card. The cycle is scoped to the active routine's DAYS: a newly generated routine starts fresh at day 1, but an EDIT keeps the cycle for days that survive it (edits preserve routine id + name-matched day ids). No animation of the reorder. Non-goals: dates, streaks, notifications, manual reset, per-day history on the card.

**Why:** these define MVP scope and shape; the user made deliberate calls to keep it lean and avoid guilt-driven scheduling.
**How to apply:** every proposal.md and any scope discussion must stay consistent with these. See [[change-slicing-order]] for build order.
