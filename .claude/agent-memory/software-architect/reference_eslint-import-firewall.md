---
name: eslint-import-firewall
description: The import firewall rules (Biome + dependency-cruiser) that enforce workout-pal's local-first + feature-first boundaries — defined in bootstrap design.md §3
metadata:
  type: reference
---

The architectural boundaries in workout-pal are enforced in code by **Biome `noRestrictedImports`** (rules 1, 2, 4 — per-file forbid-lists via `overrides`) plus **`dependency-cruiser`** (rule 3 barrel-only + `no-circular`, which Biome can't express). Both run on a **Husky pre-commit hook** (`biome check` + `depcruise`) — a violating commit is blocked locally. Lint+format tooling is **Biome, not ESLint/Prettier**; runtime/pkg-mgr is **Bun** (both decided v4/v5). Rules are specified in `openspec/changes/bootstrap-architecture/design.md` §3 (ADR-4). Summary:

1. Feature `ui/` may import only its own feature's `logic/` (seam) + `shared/ui` (atoms + theme). Never `api/`, `shared/db`, or another feature's internals. [Biome]
2. Layer direction inside a feature is `ui → logic → api → types`; no upward imports. [Biome]
3. Cross-feature imports go through `modules/<feature>/index.ts` (barrel) only — never deep paths. [dependency-cruiser — Biome can't express this relational rule]
4. `src/app/api/**/route.ts` (server) may import ONLY `modules/routine-generation/api/ai/{prompt,schema,errors}`. Never `shared/db`, never any `*Repo`, never the client-side AI `client.ts`. [Biome — security-load-bearing, stays tool-enforced]
5. `shared/db/**` and `modules/*/api/*Repo*` are browser-only — no server component/route may import them. [Biome]

**Why:** #4 and #5 are the local-first "§0 firewall" — the server literally cannot reach persistence, so no user data can leak server-side. Biome's per-file `noRestrictedImports` handles the forbid-list rules; only rule 3 (relational/barrel + cycles) needs dependency-cruiser. See [[feature-first-architecture]] and [[local-first-constraint]].

**How to apply:** if asked to add/move a rule, edit design.md §3 (I'm read-only on source; config lands in `biome.json` / `.dependency-cruiser.cjs` during apply). The per-feature blocks are mechanical/generated. Verify at scaffold time that Biome actually errors on a `route.ts` importing `@/shared/db` (rule 4).
