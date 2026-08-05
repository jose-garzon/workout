---
name: import-firewall
description: The import firewall rules (Biome + dependency-cruiser) enforcing workout-pal's local-first + feature-first boundaries, and the fact that they are forbid-lists — a new shared/ slice needs no config change
metadata:
  type: reference
---

The architectural boundaries in workout-pal are enforced in code by **Biome `noRestrictedImports`** (rules 1, 2, 4 — per-file forbid-lists via `overrides`) plus **`dependency-cruiser`** (rule 3 barrel-only + `no-circular`, which Biome can't express). Both run on a **Husky pre-commit hook** (`bun run check` + `bunx depcruise src`) — a violating commit is blocked locally. Lint+format tooling is **Biome, not ESLint/Prettier**; runtime/pkg-mgr is **Bun**. Rules are specified in `openspec/changes/archive/*bootstrap-architecture*/design.md` §3 (ADR-4). Summary:

1. Feature `ui/` may import only its own feature's `logic/` (seam) + `shared/ui` (atoms + theme) + `shared/i18n`. Never `api/`, `shared/db`, or another feature's internals. [Biome]
2. Layer direction inside a feature is `ui → logic → api → types`; no upward imports. [Biome]
3. Cross-feature imports go through `modules/<feature>/index.ts` (barrel) only — never deep paths. [dependency-cruiser — Biome can't express this relational rule]
4. `src/app/api/**/route.ts` (server) may import ONLY `modules/routine-generation/api/ai/*`. Never `shared/db`, never any `*Repo`, never the client-side AI `client.ts`. [Biome — security-load-bearing]
5. `shared/db/**` and `modules/*/api/*Repo*` are browser-only — no server component/route may import them. [Biome]

**The non-obvious bit (verified 2026-08-04, i18n change):** the Biome overrides are **forbid-lists, not allow-lists** — they enumerate what's banned (`@/shared/db`, `**/api/**`, `**/*Repo`, `**/ui/**`), never what's permitted. And `.dependency-cruiser.cjs` only scopes `^src/modules/`. **Consequence: adding a new `src/shared/<slice>/` importable from every layer costs ZERO config change** — only the *prose* in `CLAUDE.md` / `openspec/config.yaml` (which reads like an allow-list) needs updating. Don't budget firewall work for a new shared slice; do budget the doc edit.

**Why:** #4 and #5 are the local-first "§0 firewall" — the server literally cannot reach persistence, so no user data can leak server-side. See [[feature-first-architecture]] and [[local-first-constraint]].

**How to apply:** if asked to add/move a rule, edit the change's design.md (I'm read-only on source; config lands in `biome.json` / `.dependency-cruiser.cjs` during apply). Verify at scaffold time that Biome actually errors on a `route.ts` importing `@/shared/db` (rule 4) — there's a fixture for it (`scripts/firewall-proof.sh`).
