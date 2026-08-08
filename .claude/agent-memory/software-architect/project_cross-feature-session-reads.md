---
name: cross-feature-session-reads
description: The rule for how a feature gets at another feature's completed-session data without creating a dependency cycle — own repo vs composition-layer prop
metadata:
  type: project
---

When a feature needs `completedSessions` data owned by `workout-mode` (D), pick the precedent by **what kind of access it needs**:

- Needs D's **domain interpretation** of a session (`exerciseLogs`, `series`, ratings — i.e. D's `model.ts`) → compute it in D, thread a primitive through `app/page.tsx` as a prop. Precedent: `useSessionSummary` → `sessionSummary={...}` (also `weekStrip`).
- Needs only the **scalar coordinates** `dayId` + `completedAt` → read `@/shared/db` through the consuming feature's own `api/<name>Repo`. Precedent: `calendarRepo.getCompletedInRange`; then `routine-generation/api/cycleRepo` (change `highlight-next-workout-day`).

Two facts that force this and bite every time:
1. **Dependency direction is fixed `A ← B ← D ← C`.** D already imports B's barrel (`logic/model.ts`, `useWorkoutSession`, `useSessionSummary`), so **B must never import D** — depcruise `no-circular` fails CI *and* the Husky pre-commit hook.
2. **`routine.id` is ALWAYS the string `"active"`** (`routineRepo.toRow` overwrites it with the singleton `ACTIVE_ID`), so every `CompletedSession.routineId` is `"active"` too. `routineId` is **not** a discriminator between routines — use `completedAt >= routine.createdAt` (minted fresh on generation, preserved by `assembleEditedRoutine`).

**Why:** both routes are acyclic, so the choice is about ownership, not tooling — put the rule in the feature whose domain it describes. Neither route needs a `biome.json` / `.dependency-cruiser.cjs` change: `api/ → @/shared/db` is an existing direction. See [[import-firewall]] and [[feature-first-architecture]].

**How to apply:** when a design needs cross-feature data, state which branch applies and why in `design.md` Decisions, and say explicitly that the firewall config is unchanged (verified 2026-08-08 — it is a forbid-list, and no new import direction is introduced).
