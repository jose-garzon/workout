# Firewall fixtures

Executable proof that the architecture firewall (design.md §3, ADR-4) actually
**fails** on violations — not just that the config exists.

These files are **not part of the build**. They live outside `src/` (so `tsc`,
`next build`, and a normal `biome check`/`depcruise src` never see them) and are
excluded in `biome.json` (`!test/firewall-fixtures`) and `tsconfig.json`.

`scripts/firewall-proof.sh` (run via `bun run firewall:proof`) materializes each
fixture into the **real** path its firewall rule targets, runs the tool, asserts
the expected exit code + diagnostic, then removes it. The repo is never left red:
the fixtures only exist under `src/` for the milliseconds the proof runs.

| Fixture | Materialized at | Tool | Expected |
|---|---|---|---|
| `biome/route-shared-db.ts` | `src/app/api/__firewall_proof__/route.ts` | biome | FAIL — rule 4 (`@/shared/db`) |
| `biome/route-repo.ts` | `src/app/api/__firewall_proof__/route.ts` | biome | FAIL — rule 4 (`**/*Repo`) |
| `biome/route-ai-client.ts` | `src/app/api/__firewall_proof__/route.ts` | biome | FAIL — rule 4 (`api/ai/client`) |
| `biome/route-allowed.ts` | `src/app/api/__firewall_proof__/route.ts` | biome | PASS — imports only ai/{prompt,schema,errors} |
| `depcruise/deep/*` | `src/modules/__fixture_alpha__` + `__fixture_beta__` | depcruise | FAIL — cross-feature deep import (rule 3) |
| `depcruise/cycle/*` | `src/modules/__fixture_alpha__/logic` | depcruise | FAIL — `no-circular` |
