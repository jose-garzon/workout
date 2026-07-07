---
name: feature-first-architecture
description: workout-pal uses feature-first / DDD layered architecture (modules/ + shared/), NOT a flat lib/+ui split — decided by the user in bootstrap change v3
metadata:
  type: project
---

The code structure for workout-pal is **feature-first / domain-driven, layered inside each feature**. Decided by the user (project owner Jose) during `bootstrap-architecture` design v3, overriding the earlier flat `lib/` (engineer) vs `ui/` (designer) top-level split from v2.

Shape:
- `src/modules/<feature>/` — one folder per feature, each with internal layers `ui/` (designer), `logic/` (engineer: domain rules + seam hooks + store), `api/` (engineer: repos + AI client), `types.ts`, and a public `index.ts` barrel.
- `src/shared/` — `db/` (single Dexie instance, all tables) and `ui/` (the design system: atoms/primitives, tokens/fonts, layout, AND theme under `shared/ui/theme/` = useTheme + store). Feature-specific composites stay in `modules/<feature>/ui`.
- `src/app/` — thin Next route wrappers that delegate into `modules/<feature>/ui`, plus the single stateless AI proxy route.
- Features: profile-goals (A), routine-generation (B), workout-mode (D), calendar (C). Build order A→B→D→C.

**Why:** the user explicitly wants the FEATURE to be the primary unit of organization (cohesion, easy to move/delete a feature), with layering nested inside each feature.

**How to apply:** the engineer/designer split now maps onto LAYERS within a feature (ui/ = designer; logic/+api/ = engineer), not top-level folders. The logic↔UI seam lives between a feature's `ui/` and `logic/`. Cross-feature imports go through the feature's `index.ts` barrel only. See [[eslint-import-firewall]].
