# import-firewall

The boundary firewall proven at scaffold time — not aspirational. *How* (Biome
`noRestrictedImports`, dependency-cruiser config, Husky) is specified in
[`design.md`](../../design.md) §3 (ADR-4). This spec states only *what* must hold.

## ADDED Requirements

### Requirement: Server firewall blocks persistence imports in API routes

An API route (`app/api/**/route.ts`) that imports the persistence layer SHALL
cause `biome check` to fail. This is the security-load-bearing rule (rule 4)
that makes the local-first constraint enforceable in code: the server literally
cannot reach the browser-only data layer.

#### Scenario: Route importing shared/db fails biome check

- **WHEN** `biome check` runs against a fixture `route.ts` under `app/api/**`
  that imports `@/shared/db`
- **THEN** `biome check` reports an error and exits non-zero

### Requirement: Cross-feature deep imports fail the dependency check

The dependency check SHALL fail when a module imports another feature's
internals, meaning any deep path into another feature's `ui`, `logic`, `api`, or
`types` rather than that feature's `index.ts` barrel. Import cycles SHALL also
fail the check.

#### Scenario: Deep cross-feature import fails dependency-cruiser

- **WHEN** `dependency-cruiser` runs against a module that deep-imports another
  feature's internal layer path
- **THEN** `dependency-cruiser` reports a violation and exits non-zero

### Requirement: Pre-commit hook enforces the firewall

A Husky pre-commit hook SHALL run both `biome check` and the
`dependency-cruiser` check, and SHALL block the commit when either reports a
firewall violation.

#### Scenario: Violating commit is blocked

- **WHEN** a commit is staged that violates any firewall rule and the Husky
  pre-commit hook runs
- **THEN** the hook runs both `biome check` and `dependency-cruiser`, and the
  commit is rejected
