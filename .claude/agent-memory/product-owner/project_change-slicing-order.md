---
name: change-slicing-order
description: Confirmed OpenSpec change order for workout-pal MVP — one change per feature, A then B then D then C
metadata:
  type: project
---

Confirmed change slicing for workout-pal MVP (user-approved 2026-07-06). One OpenSpec change per feature, built in dependency order:

1. **Change 1 — Feature A: register personal data & goals.** DONE (archived `welcome-view`).
2. **Change 2 — Feature B: AI-prompt routine generation.** DONE (archived `2026-07-10-routine-generation`).
3. **Change 3 — Feature D: workout mode + rest timer.** Proposal written 2026-07-10 (`openspec/changes/workout-mode`, proposal + 5 specs, validates strict). Depends on B. The differentiated core. NOTE: this change REVERSED the framing-v1 per-set logging decision → now per-EXERCISE aggregates (series/reps/weight/total work/total rest), no per-series tracking, resume at the current EXERCISE not per-set. Flagged in proposal Key decision 1; architect to update config.yaml + foundation `SetLog` types.
4. **Change 4 — Feature C: completed-session log + consistency calendar.** Depends on D's session-complete signal. NOTE: calendar reads D's `CompletedSession` (now per-exercise aggregate + optional difficulty/fatigue 1–5 ratings) via the barrel.

**Why:** data foundation must come first; C depends on D emitting completion events, so D precedes C (not the natural 1-2-3-4 numbering).
**Thinnest shippable slice:** A -> B -> D (plan in, routine out, guided logged workout). C is the retention layer and the first cut if needed.
**How to apply:** scaffold Change 1 (Feature A) next. Keep consistent with [[locked-product-decisions]].
