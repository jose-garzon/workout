---
name: change-slicing-order
description: Confirmed OpenSpec change order for workout-pal MVP — one change per feature, A then B then D then C
metadata:
  type: project
---

Confirmed change slicing for workout-pal MVP (user-approved 2026-07-06). One OpenSpec change per feature, built in dependency order:

1. **Change 1 — Feature A: register personal data & goals.** Foundation; forces the architect's first stack + local-persistence decision. FIRST to scaffold.
2. **Change 2 — Feature B: AI-prompt routine generation.** Depends on A.
3. **Change 3 — Feature D: workout mode + rest timer + per-set logging.** Depends on B. The differentiated core.
4. **Change 4 — Feature C: completed-session log + consistency calendar.** Depends on D's session-complete signal.

**Why:** data foundation must come first; C depends on D emitting completion events, so D precedes C (not the natural 1-2-3-4 numbering).
**Thinnest shippable slice:** A -> B -> D (plan in, routine out, guided logged workout). C is the retention layer and the first cut if needed.
**How to apply:** scaffold Change 1 (Feature A) next. Keep consistent with [[locked-product-decisions]].
