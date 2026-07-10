# Proposal — bootstrap-architecture (Foundation)

> **This is a foundation change, not a user feature.** It stands up the shared
> scaffold every later feature is built on. The *how* is fully specified in
> [`design.md`](./design.md) (signed off, v4) and the stack is recorded in
> `openspec/config.yaml` `context:`. This proposal frames the *what & why* and
> defines the acceptance gate — it does **not** restate the architecture.

## Problem / why

The repo is greenfield: no app, no build, no structure. The four product
features ship in a locked order — **A** profile-goals → **B** routine-generation
→ **D** workout-mode → **C** calendar — and two builder agents
(software-engineer, frontend-dev-designer) are meant to work **in parallel**,
meeting at a defined seam. They cannot start until a shared foundation exists:
the Next.js 15 app scaffold, the `modules/` + `shared/` structure with the
per-feature layer shape, the design-token/theme substrate, the local-first
persistence base (Dexie), the stateless AI proxy route shell, and — critically —
the **import firewall** that keeps the local-first constraint honest in code
rather than in good intentions.

Without this change: no feature can begin, the two builders can't run in
parallel against a stable seam, and the "no user data ever leaves the device"
constraint has no enforcement — it's one careless import away from breaking
silently. The firewall must be **proven at scaffold time**, not aspirational.

## Target user

The end user is the **intermediate gym-goer** (full-gym access, values
efficiency over hand-holding) — but this change delivers them *no* observable
behavior. The **direct beneficiaries are the two builder agents**: this is
enabling infrastructure. Honest framing — a user opening the app after this
change sees an empty shell, a working theme toggle, and nothing else. Value here
is measured by "can the builders safely start feature A in parallel," not by any
end-user job-to-be-done.

## User stories

- **As the software-engineer,** I can add a feature's `logic/` + `api/` against a
  ready `shared/db` Dexie instance and a stub route, and tooling guarantees my
  persistence code can only touch its own tables and can **never** be imported by
  the server — so I build feature A without hand-checking the local-first rule.
- **As the frontend-dev-designer,** I can build a feature's `ui/` against
  self-hosted fonts, live design tokens, `shared/ui` primitives, and a working
  theme toggle — composing seam-hook stubs whose signatures already match
  `design.md` §4 — without waiting on the engineer.
- **As either builder,** I can commit and the pre-commit hook blocks a
  boundary-violating or server-touches-data import before it ever lands, so the
  firewall holds without code-review vigilance.
- **As the product owner / reviewer,** I can point spec-review at a concrete,
  testable acceptance list and confirm `tasks.md` satisfies every gate.

## Acceptance criteria (Given / When / Then — the gate)

**App scaffold**
1. GIVEN a clean checkout, WHEN the app is installed and started with **Bun**,
   THEN the Next.js 15 App Router app boots (React 19, TypeScript **strict**)
   with no build or type errors.

**Structure & seams**
2. GIVEN the scaffold, WHEN inspecting `src/`, THEN the four
   `modules/<feature>` skeletons (`profile-goals`, `routine-generation`,
   `workout-mode`, `calendar`) and `shared/{db,ui}` exist, each feature carrying
   the `ui/ → logic/ → api/ → types.ts` layer shape plus a public `index.ts`
   barrel.
3. GIVEN the feature skeletons, WHEN reading the seam-hook stubs, THEN their
   signatures **match `design.md` §4 exactly** (`useProfile`,
   `useRoutineGeneration`, `useWorkoutSession`, `useRestTimer`, `useCalendar`,
   `useTheme`), re-exported only through each feature's `index.ts`.

**Firewall — proven, not aspirational**
4. GIVEN a fixture `route.ts` under `app/api/**` that imports `@/shared/db`,
   WHEN `biome check` runs, THEN it **errors** (rule 4, server firewall —
   security-load-bearing).
5. GIVEN a module that deep-imports another feature's internals (a path under
   `modules/<other>/(ui|logic|api|types)`), WHEN `dependency-cruiser` runs, THEN
   it **fails** (rule 3, barrel-only + no cycles).
6. GIVEN a staged commit, WHEN the **Husky pre-commit** hook runs, THEN it
   executes both `biome check` and the `dependency-cruiser` check, and a
   violation of any firewall rule **blocks the commit**.

**Design substrate**
7. GIVEN the app shell, WHEN a screen renders, THEN design tokens resolve via CSS
   custom properties and the self-hosted Anton + Barlow fonts load from
   `public/assets/fonts/` via `@font-face` (no CDN request).
8. GIVEN the default dark theme, WHEN the user toggles to light and reloads, THEN
   the chosen theme persists across reload with **no flash** of the wrong theme
   on first paint.

**Local-first & offline**
9. GIVEN the installed PWA with a service worker, WHEN the device is offline,
   THEN the app shell and every data screen are usable, and **only** routine
   generation is unavailable (surfacing the offline error, not a crash).
10. GIVEN the running app, WHEN inspecting persistence and env, THEN no user data
    is written server-side (all data is browser IndexedDB via Dexie), and
    `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` are server-only env vars — **never**
    `NEXT_PUBLIC_*` and never shipped to the client.
11. GIVEN the stateless AI proxy route shell (`app/api/generate-routine/route.ts`),
    WHEN it is present, THEN it exists as a shell that stores/reads nothing and
    may import only `modules/routine-generation/api/ai/{prompt,schema,errors}`
    (no real generation logic yet — the route is scaffolded, the firewall around
    it is proven).

## Non-goals

- **No feature behavior or UI** beyond empty skeletons + seam-hook stubs.
  Features A–D are each their own later change; this change ships zero
  end-user-observable functionality.
- **No real routine-generation logic** — only the route *shell* plus the proof
  that the firewall constrains it. No prompt engineering, no OpenRouter call
  wired through end-to-end.
- **No auth, accounts, multi-device, or cloud sync** — local-first is permanent,
  not a phase-one shortcut.
- **No backend or database** beyond the single stateless proxy route. No
  server-side persistence, ever.
- **No stack re-litigation** — the stack is decided in `design.md` and recorded
  in `config.yaml`; this proposal does not reopen it.

## Capabilities

The acceptance criteria above are delivered as six capabilities (one `specs/`
file each, 1:1 with the criteria groups):

- **project-scaffold** — app boots (Next 15 App Router + React 19 + TS strict via
  Bun); four `modules/<feature>` skeletons + `shared/{db,ui}` with the
  `ui→logic→api→types.ts` shape + public `index.ts` barrels; seam-hook stubs
  match `design.md` §4 signatures. *(criteria 1–3)*
- **import-firewall** — `route.ts` importing `@/shared/db` makes `biome check`
  error; deep cross-feature import makes `dependency-cruiser` fail; Husky
  pre-commit runs both and blocks a violating commit. *(criteria 4–6)*
- **local-first-persistence** — no server-side persistence; `shared/db` Dexie
  base is browser-only; `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` are server-only,
  never `NEXT_PUBLIC_*`. *(criterion 10)*
- **ai-proxy-route** — stateless shell route importing only
  `modules/routine-generation/api/ai/{prompt,schema,errors}`, no generation logic
  yet. *(criterion 11)*
- **design-token-substrate** — tokens resolve via CSS custom properties;
  self-hosted Anton + Barlow load from `public/assets/fonts/` via `@font-face`;
  dark/light toggle persists across reload with no flash. *(criteria 7–8)*
- **pwa-offline** — offline app shell + all data screens usable; only routine
  generation needs network (surfaces the offline error). *(criterion 9)*

## Priority

**P0, blocking.** Nothing else in the roadmap can start until this lands — it is
the single prerequisite for the entire A→B→D→C build order. Smallest thing that
delivers real value: an empty-but-safe scaffold where both builders can begin
feature A in parallel and the local-first firewall is enforced by tooling on
every commit.
