---
name: integration-test-placement
description: Cross-layer integration tests must live at the feature root, not in ui/logic/api — Biome firewall globs apply to test files too
metadata:
  type: reference
---

Biome's architecture-firewall overrides (`biome.json`) match by path glob and
apply to **every** file under a layer folder — **including `*.test.tsx`**:

- `src/modules/*/ui/**` → rule 1: may NOT import `api/` or `@/shared/db`.
- `src/modules/*/api/**` → rule 2: may NOT import `logic/` or `ui/`.
- `src/modules/*/logic/**` → rule 2: may NOT import `ui/`.

So a cross-layer **integration** test that renders `ui/` AND touches
`api/`/`shared/db` (e.g. seam + routing + no-network flows) cannot live in any of
the three layer folders. Put it at the **feature root**:
`src/modules/<feature>/<name>.integration.test.tsx`. No override glob matches the
root, and dependency-cruiser's `cross-feature-barrel-only` rule exempts
same-feature imports (its `pathNot: ^src/modules/$1/` covers the root file
reaching into its own `ui|logic|api`), so both gates stay green.

Layer-local tests are fine where they sit: pure `logic/model.test.ts` and
`api/*Repo.test.ts` (fake-indexeddb) obey their folder's rule already. Only the
UI-plus-persistence integration test needs the feature-root home. See
[[parallel-slice-boundaries]].
