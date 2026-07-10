# Tasks — bootstrap-architecture (FOUNDATION only)

Scope = design.md §7 sequencing step 1: repo + tooling + empty skeletons + stubs
+ the firewall/offline proofs. **No feature behavior** — the A→B→D→C features are
separate later changes. Every task states a checkable outcome and traces to a
spec scenario `(spec: scenario)`; the coverage matrix at the end shows every
scenario has covering task(s). All script/install/test invocations use **Bun**
(`bun`, `bunx`).

## 1. Repository, Bun, and Next.js 15 boot

- [x] 1.1 Init git repo + Bun project (`bun init`); `package.json` declares Bun scripts (`dev`, `build`, `start`, `check`, `depcruise`, `test`, `e2e`); `bun install` succeeds and produces `bun.lockb`
- [x] 1.2 Add Next.js 15 + React 19 + TypeScript; `tsconfig.json` has `"strict": true` and a `@/*` -> `src/*` path alias; `bunx tsc --noEmit` passes on the empty tree
- [x] 1.3 Create `src/app/layout.tsx` (root server shell) + `src/app/page.tsx`; `bun run build` succeeds and `bun run dev` serves `/` with no build errors and no type errors (project-scaffold: Clean checkout builds and starts)
- [x] 1.4 Add Tailwind v4 wired through `src/app/globals.css` (imports `shared/ui/tokens/*`); build compiles Tailwind with zero errors (project-scaffold: Clean checkout builds and starts)

## 2. Firewall tooling: Biome, dependency-cruiser, Husky

- [x] 2.1 Add Biome with `biome.json` (formatter + linter base); `bun run biome check` (aliased `bun run check`) runs clean on the scaffold
- [x] 2.2 Encode firewall rules 1, 2, 4 as Biome `overrides` + `noRestrictedImports` per design §3 ADR-4: rule 1 (`modules/*/ui` may import only own `logic/` + `shared/ui`), rule 2 (no upward `ui->logic->api`), rule 4 (`app/api/**/route.ts` bans `@/shared/db`, `**/*Repo`, `**/api/ai/client`); `biome check` stays clean on the compliant tree
- [x] 2.3 Add dependency-cruiser (`.dependency-cruiser.cjs`) encoding rule 3 (cross-feature barrel-only: deep `modules/<X>/(ui|logic|api|types)` forbidden to importers outside X) + `no-circular`; `bunx depcruise src` runs clean on the compliant tree
- [x] 2.4 Add a Husky pre-commit hook (`.husky/pre-commit`) that runs `bun run biome check` then `bunx depcruise src`; a clean commit passes the hook (import-firewall: Violating commit is blocked — wiring; block proven in 3.5)

## 3. Firewall proofs (acceptance-gating)

- [x] 3.1 Add a throwaway fixture `route.ts` under `src/app/api/**` that imports `@/shared/db`; confirm `bun run biome check` reports an error and exits non-zero; remove the fixture after capturing the proof (import-firewall: Route importing shared/db fails biome check) (local-first-persistence: shared/db is not server-importable)
- [x] 3.2 With a fixture route importing a `*Repo` and one importing `api/ai/client`, confirm each makes `bun run biome check` exit non-zero, and a route importing only `api/ai/{prompt,schema,errors}` passes (ai-proxy-route: Route restricted to server-safe AI modules)
- [x] 3.3 Add a fixture module that deep-imports another feature's internal path (e.g. `@/modules/routine-generation/logic/...`); confirm `bunx depcruise src` reports a violation and exits non-zero (import-firewall: Deep cross-feature import fails dependency-cruiser)
- [x] 3.4 Add a fixture import cycle between two modules; confirm `bunx depcruise src` fails the `no-circular` rule and exits non-zero; remove the fixture (import-firewall: Deep cross-feature import fails dependency-cruiser — cycles clause)
- [x] 3.5 Stage a firewall-violating change and run the Husky pre-commit hook; confirm it runs both `biome check` and `depcruise` and rejects the commit (import-firewall: Violating commit is blocked)

## 4. Local-first base (`shared/db`) and design substrate (`shared/ui`)

- [x] 4.1 Add `shared/db/schema.ts` (Dexie subclass, versioned v1 store definitions per design §3) + `shared/db/index.ts` (single browser-only `db` instance, no side effects on server import); `bunx tsc --noEmit` passes and `db` is typed (local-first-persistence: All user data lives in the browser)
- [x] 4.2 Audit that `shared/db` is the only persistence surface and no server component/route/process reads or writes user data (only the stateless route exists server-side); Biome rule 4 (proven in 3.1) makes a server import of `@/shared/db` fail (local-first-persistence: All user data lives in the browser)
- [x] 4.3 Add `shared/ui/tokens/tokens.css`: `:root` dark defaults + `[data-theme="light"]` color overrides, plus spacing / radius(0) / control-height (48/56/64) / motion vars per design §5 and design-system.md; a rendered element in dark resolves color, spacing, radius, and control-height from these CSS variables (design-token-substrate: Tokens resolve from CSS variables)
- [x] 4.4 Add `shared/ui/tokens/fonts.css` with `@font-face` for Anton + Barlow using `url('/assets/fonts/*.woff2')`; place the `.woff2` files in `public/assets/fonts/`; preload the hot faces in the root layout; Anton and Barlow load from `public/assets/fonts/` with no third-party CDN request (design-token-substrate: Fonts served from origin only)
- [x] 4.5 Add `shared/ui/theme/useTheme.ts` + theme store (matching design §4 `useTheme` signature) and the no-flash inline `<script>` in `app/layout.tsx` that resolves `wp.theme` from `localStorage` before first paint; toggling to light and reloading renders light on first paint with no flash of dark (design-token-substrate: Toggled theme survives reload without flashing)

## 5. Feature module skeletons + barrels + seam-hook stubs

- [x] 5.1 Create the four `modules/<feature>` folders (`profile-goals`, `routine-generation`, `workout-mode`, `calendar`), each containing `ui/`, `logic/`, `api/`, `types.ts`, and `index.ts`; tree inspection shows all four with those five members and `shared/db` + `shared/ui` present (project-scaffold: Four feature skeletons and shared modules present)
- [x] 5.2 Populate each feature's `types.ts` with its owned domain types per design §3 (Profile/Goals; Routine/Exercise/SetPlan; WorkoutSession/SetLog/CompletedSession; CalendarWeek/ConsistencySummary); `bunx tsc --noEmit` passes (project-scaffold: Four feature skeletons and shared modules present)
- [x] 5.3 Add seam-hook stubs in each feature's `logic/` — `useProfile`; `useActiveRoutine` + `useRoutineGeneration`; `useWorkoutSession` + `useRestTimer`; `useCalendar` — with signatures matching design §4 exactly (no logic); they type-check against the §4 shapes (project-scaffold: Seam-hook signatures match design §4)
- [x] 5.4 Make each `index.ts` barrel re-export only the feature's seam hooks + public types, with the `ui/`/`logic/`/`api/`/`types.ts` members not otherwise exported for outside use; depcruise rule 3 (proven 3.3) blocks any deep import (project-scaffold: Feature internals are exposed only through the barrel)
- [x] 5.5 Add server-safe stubs for `routine-generation/api/ai/{schema,prompt,errors}` (Zod schema isomorphic; prompt builder; `AiError` union including `{ kind: 'offline' }`) and the browser `api/ai/client.ts` stub (fetch to `/api/generate-routine`, no generation logic); the `ai/` subset imports no Dexie and `tsc` passes (ai-proxy-route: Route restricted to server-safe AI modules)

## 6. Stateless AI proxy route shell + server-only secrets

- [x] 6.1 Add `src/app/api/generate-routine/route.ts` as a stateless shell that exports `POST`, imports only `modules/routine-generation/api/ai/{prompt,schema,errors}`, holds no state across requests, performs no persistence, and contains no routine-generation logic; `biome check` and `tsc` pass (ai-proxy-route: Route shell is present and stateless)
- [x] 6.2 Establish env handling: the route reads `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` from server env only (never `NEXT_PUBLIC_*`); add `.env.example` documenting them; a production build's client bundle contains neither value and no client module references them (local-first-persistence: Secrets never reach the client bundle)
- [x] 6.3 Confirm the real route passes `biome check` while the 3.1/3.2 fixtures prove that importing `@/shared/db`, a `*Repo`, or `api/ai/client` from a route fails (ai-proxy-route: Route restricted to server-safe AI modules)

## 7. Serwist PWA + offline baseline

- [x] 7.1 Add Serwist (`@serwist/next`) with `src/sw.ts` precaching the app shell, static assets, and the self-hosted fonts, plus `app/manifest.ts`; a production build emits a service worker whose precache includes the shell + fonts and the app is installable (pwa-offline: Data screens usable with no network)
- [x] 7.2 Verify offline shell: with the service worker registered, opening the app offline loads the shell and every data screen renders without a network connection (pwa-offline: Data screens usable with no network)
- [x] 7.3 Wire the offline-error path in the generation seam: offline detection in `useRoutineGeneration`/`api/ai/client` surfaces `{ kind: 'offline' }` (no crash) so an offline generation attempt shows the offline error while all non-generation screens stay usable (pwa-offline: Generation surfaces the offline error)

## 8. Test harness wiring (for this change's proofs and later features)

- [x] 8.1 Configure Vitest + React Testing Library + fake-indexeddb with `src/test/setup.ts`; a smoke unit test passes via `bun run test` (enables verification across the change)
- [x] 8.2 Add MSW (server + handler scaffold) able to mock OpenRouter and the app's own `/api/generate-routine`; an MSW-mocked fetch test passes, giving 7.3 its offline/error harness (pwa-offline: Generation surfaces the offline error)
- [x] 8.3 Add Playwright config + a smoke E2E (`/` loads) via `bunx playwright test`, with an offline project/context that drives the 7.2 and 7.3 offline checks (pwa-offline: Data screens usable with no network)
- [x] 8.4 Confirm the full gate passes on the compliant scaffold: `bun run biome check`, `bunx depcruise src`, and `bun run test` all exit zero (project-scaffold: Clean checkout builds and starts)

## Spec coverage (traceability)

Every scenario (17 across 6 specs) has covering task(s); every task above traces
back to a scenario.

| Spec | Scenario | Covered by |
|---|---|---|
| project-scaffold | Clean checkout builds and starts | 1.3 (1.1, 1.2, 1.4, 8.4) |
| project-scaffold | Four feature skeletons and shared modules present | 5.1 (5.2) |
| project-scaffold | Feature internals exposed only through the barrel | 5.4 (proof 3.3) |
| project-scaffold | Seam-hook signatures match design §4 | 5.3 |
| import-firewall | Route importing shared/db fails biome check | 3.1 (rules 2.2) |
| import-firewall | Deep cross-feature import fails dependency-cruiser | 3.3, 3.4 (rules 2.3) |
| import-firewall | Violating commit is blocked | 3.5 (wiring 2.4) |
| local-first-persistence | All user data lives in the browser | 4.1, 4.2 |
| local-first-persistence | shared/db is not server-importable | 3.1 (rule 2.2) |
| local-first-persistence | Secrets never reach the client bundle | 6.2 |
| ai-proxy-route | Route shell is present and stateless | 6.1 |
| ai-proxy-route | Route restricted to the server-safe AI modules | 3.2, 6.3 (stubs 5.5) |
| design-token-substrate | Tokens resolve from CSS variables | 4.3 |
| design-token-substrate | Fonts served from origin only | 4.4 |
| design-token-substrate | Toggled theme survives reload without flashing | 4.5 |
| pwa-offline | Data screens usable with no network | 7.1, 7.2 (harness 8.3) |
| pwa-offline | Generation surfaces the offline error | 7.3 (harness 8.2, 8.3) |
