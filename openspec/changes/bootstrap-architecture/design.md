# Architecture — workout-pal foundation (Change 1 / bootstrap) — v4

**Status: DRAFT.** Proposes the stack + code structure the whole project
follows. Nothing built yet. When you sign off, the coordinator writes the
chosen stack **and the refined local-first constraint** into
`openspec/config.yaml` `context:` — I have **not** touched that file.

**What changed in v4 (tooling + `shared/ui` shape — everything else stands):**
- **Lint + format → Biome**, replacing ESLint + Prettier (one fast tool, one
  config). **This weakens the import firewall's tooling** — Biome has no
  zone-based `import/no-restricted-paths` equivalent — so §3 now documents,
  ADR-style, exactly which firewall rules are **tool-enforced** (Biome
  `noRestrictedImports` via `overrides`) vs **CI-script-enforced**
  (`dependency-cruiser`). The security-load-bearing server firewall stays
  tool-enforced. *(see ADR-4 in §3)*
- **`shared/ui` is the design-system home.** It holds the reusable **atoms /
  primitives** (Button, Input, Stepper…) the designer builds once and every
  feature reuses; feature-specific composite components stay in
  `modules/<feature>/ui`.
- **Theme folds into `shared/ui/theme/`** (was a separate `shared/theme/`):
  `useTheme` + theme store + token/font CSS now live under `shared/ui`. Firewall
  rule 1 already grants `modules/*/ui` access to `shared/ui`, so the toggle keeps
  working with no extra allowance.

**What changed in v3 (structure only — stack decisions from v2 all stand):**
- **Code structure → feature-first / domain-driven, layered inside each
  feature.** Two top-level source folders: **`modules/`** (one folder per
  feature, each with internal `ui/` + `logic/` + `api/` + `types` layers) and
  **`shared/`** (cross-feature modules). This replaces v2's flat top-level
  `lib/` (engineer) vs `ui/` (designer) split. *(see §3 — ADR + tradeoffs)*
- **The engineer/designer wall now runs through layers, not top folders:**
  designer owns each feature's `ui/` + `shared/ui` (incl. the theme); engineer
  owns each feature's `logic/` + `api/` + `shared/db` + the AI route. **The
  logic↔UI seam is now the boundary between a feature's `ui/` and `logic/`.**
- **The seam hook signatures (§4) are unchanged** — only their file paths moved
  into feature folders. The contract survived the restructure intact.
- **The import firewall is re-expressed** for the new shape: per-feature UI
  isolation, in-feature layer direction (`ui → logic → api`), cross-feature
  barrel-only imports, and the §0 server-can't-touch-data rule (§3).

**What changed in v2 (user reacted to the v1 forks):**
- **Framework → Next.js (App Router) + React 19**, replacing React + Vite.
  Routing is now the App Router (React Router dropped). *(fork F1 resolved)*
- **Styling → Tailwind v4 + CSS custom properties — confirmed.** *(F2)*
- **AI → OpenRouter behind a thin, stateless Next.js Route Handler**, replacing
  the BYOK/direct-browser-call model. **This refines the hard constraint** —
  see §2. *(F4 resolved)*
- Confirmed picks unchanged: **Zustand + Dexie** client state/persistence;
  **Vitest + RTL + fake-indexeddb + MSW + Playwright** (now also covers the
  route handler). The **`lib/` (engineer) vs `ui/` (designer) wall** and the
  ESLint import boundary hold, reconciled with Next's `app/` directory.

There is no `proposal.md`: the *what/why* lives in `config.yaml` +
`design-system.md`. This doc is the *how*. Jump to **§7** for the decision
summary.

---

## 0. The refined hard constraint (read this first)

> **Local-first for all data. The only server code is a stateless AI proxy
> route — no persistence server-side, ever.**

All user data — profile, goals, the active routine, sessions, set logs —
lives **exclusively in the browser** via IndexedDB (Dexie). The server side of
this app is a **single stateless Route Handler** that proxies one AI call to
OpenRouter and holds the OpenRouter key in an env var. That route **stores
nothing, reads nothing, remembers nothing** between requests. It is a pass-through
for the AI call and nothing else.

This is a deliberate, narrow relaxation of v1's "no servers at all": we trade
*pure-static hosting* for *a hidden API key + no data ever leaving the device
except the one prompt the user chose to send*. Everything the user builds still
works fully offline; only routine generation touches the network.

---

## 1. Recommended stack

Sized for a **solo builder shipping a local-first, installable web app** —
fewest moving parts that hold under the refined constraint (§0).

| Layer | Decision | One-line reason |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19** | App shell + the one AI proxy route in one framework; still a client-heavy SPA in practice |
| Language | **TypeScript (strict)** | The logic↔UI seam is a typed contract between two builders |
| PWA | **Serwist (`@serwist/next`) + `app/manifest.ts`** | Maintained, Workbox-based, App-Router-native; offline shell + local data |
| Styling | **Tailwind v4 + CSS custom properties** | Runtime theming needs CSS vars; Tailwind maps to the same vars |
| Client state | **Zustand + `dexie-react-hooks`** | Selector subscriptions (no per-tick full re-render); live IndexedDB reads |
| Persistence | **Dexie.js (IndexedDB)** + `localStorage` for theme | Typed schema, versioned migrations, range queries the calendar needs |
| AI | **OpenRouter (OpenAI-compatible) via a stateless Next Route Handler** | Key stays server-side; server holds no data (§0, §2) |
| Lint + format | **Biome** (+ **`dependency-cruiser`** in CI) | One fast Rust tool for lint+format; dep-cruiser covers the import rules Biome can't (§3 ADR-4) |
| Testing | **Vitest + RTL + fake-indexeddb + MSW + Playwright** | Vite-native runner; data layer + route handler tested against real behavior |

### Framework — Next.js 15 (App Router) + React 19
- **Rationale.** We now need exactly one piece of server code — the AI proxy
  route (§2). Next.js gives us that (a Route Handler) **and** the static app
  shell in one toolchain, one deploy, one TypeScript project — instead of a
  separate SPA + a separate function. React 19 + the App Router are the current
  baseline.
- **This is still a client-heavy, local-first app — say it loudly so nobody
  reaches for Server Components/SSR for browser data:**
  - **Nearly every interactive/data screen is a client component (`'use
    client'`).** They touch **IndexedDB (browser-only)** and live UI state
    (workout session, ticking timer) — none of which a server can render or
    fetch. There is *no server data source* to `await` in an RSC.
  - The **server side is minimal**: the static app shell (root layout + route
    segments that mount client screens) and **one** API route (§2). That's it.
  - **Do not** fetch profile/routine/session data in a Server Component or via
    SSR/`getServerSideProps`-style patterns — that data does not exist on the
    server. Server Components render the *shell*; client components own the
    *data and interactivity*.
- **Rejected — Next.js in "full-stack" mode** (server actions, RSC data
  fetching, a database): there is no database and no server-held data by
  design (§0). We use precisely one server feature (a Route Handler) and treat
  the rest as a static SPA.
- **Rejected — React + Vite (v1 pick):** it can't host the AI proxy route
  without bolting on a separate serverless function and a second toolchain;
  Next folds the one server bit into the same project. **What we give up vs
  Vite:** a heavier framework and the discipline of keeping data out of the
  server layer (mitigated by the `'use client'` rule above + the import
  boundary in §3).

### PWA — Serwist (`@serwist/next`) + Next manifest
- **Rationale.** `@serwist/next` is the actively maintained, Workbox-based PWA
  integration for the App Router (the effective successor to the abandoned
  `next-pwa`). The **web manifest** comes from Next's metadata API
  (`app/manifest.ts` → typed, no separate JSON).
- **What offline must cover, and why it's cheap here:** because *all data flows
  are already client + IndexedDB*, offline data access **just works** once the
  service worker caches the **app shell + static assets (JS/CSS/self-hosted
  fonts)**. The SW precaches the shell and runtime-caches fonts; navigations are
  served from cache. **Only routine generation needs the network** — offline,
  the generation hook surfaces a human "you're offline" error (§4); every other
  screen is fully usable.
- **Hosting consequence (the §0 tradeoff, concretely):** deploy is a **static
  shell + one serverless function** (the AI route), **no database**. On Vercel
  the route segments prerender to static and `app/api/generate-routine/route.ts`
  runs as a serverless function; any host that runs Next serverless works.
  Pure-static hosts (GitHub Pages) no longer fit *because of that one route* —
  that is the entire cost of hiding the key.
- **Rejected — hand-rolled service worker** (reinvents Workbox precache/runtime
  caching) and **`next-pwa`** (unmaintained for App Router).

### Styling — Tailwind v4 + CSS custom properties  *(confirmed)*
- **The token substrate stays mandatory.** The manual dark/light toggle reskins
  the app at **runtime** by flipping one attribute (`<html data-theme=…>`) so
  the CSS-variable set swaps via the cascade (§5). Every color references
  `var(--…)`.
- **Tailwind v4 maps onto those vars.** Its `@theme` layer *is* CSS custom
  properties, so tokens and utilities share one source of truth: radius scale
  `0` (sharp default), the 4px spacing scale, the 48/56/64px control heights as
  sizing tokens. Bespoke pieces (two-layer focus rings, elevation shadows,
  motion presets, `tabular-nums`) live in the token/global CSS regardless.

### Client state — Zustand + `dexie-react-hooks`  *(confirmed)*
- **Persistent** state (profile, goals, active routine, completed sessions) →
  source of truth is IndexedDB; UI reads it reactively via `useLiveQuery`, which
  re-renders on underlying data change — no manual cache invalidation.
- **Hot** state (in-progress session, the rest timer ticking every second) →
  **Zustand**; selector subscriptions mean only the timer digits re-render each
  tick (design-system Principle 3: the number updates the instant it changes).
- **Rejected — Context for hot state** (re-renders every consumer per tick;
  Context is still right for the rarely-changing theme provider).
  **Rejected — Redux** (ceremony) and **TanStack Query** (a server-cache lib;
  the one AI call is a one-shot mutation modeled by a hook, not a cache).

### Persistence — Dexie.js (IndexedDB), `localStorage` for the theme  *(confirmed)*
- Data grows across the build order A→B→D→C; Dexie gives **typed tables,
  versioned migrations, and indexed range queries** (the calendar queries
  completed sessions by date range). `localStorage` holds only the theme string
  (synchronous, read before first paint — §5). **Rejected — `idb`** (hand-rolled
  migrations/indexes), **localForage** (no range queries), **RxDB/PouchDB**
  (built for sync we don't want).

### Testing — Vitest · RTL · fake-indexeddb · MSW · Playwright
- Vitest (Vite-native, ESM), RTL for client components, **fake-indexeddb**
  runs real Dexie against an in-memory IDB, **MSW** mocks OpenRouter *and* the
  app's own `/api` route, Playwright for a few critical E2E flows. The **route
  handler** is unit-tested directly (§6).

---

## 2. AI integration — OpenRouter behind a stateless Next Route Handler

Replaces v1's BYOK / `dangerouslyAllowBrowser` / browser-CORS discussion
(now moot). The user generates routines through **OpenRouter**, proxied by the
app's own single server route.

### Shape
```
[ client: useRoutineGeneration ]
        │  POST /api/generate-routine   { prompt }
        ▼
[ Next Route Handler: app/api/generate-routine/route.ts ]   ← the ONLY server code
        │  reads OPENROUTER_API_KEY (env, server-only)
        │  builds the prompt + schema from
        │    modules/routine-generation/api/ai/{prompt,schema}.ts
        │  POST https://openrouter.ai/api/v1/chat/completions  (OpenAI-compatible)
        ▼
[ OpenRouter ] → selected model → response
        │  (route streams the response back to the client)
        ▼
[ client: assembles payload → Zod-validate → Routine held pending confirmSave() ]
```

- **OpenAI-compatible endpoint.** OpenRouter exposes the OpenAI chat-completions
  shape at `https://openrouter.ai/api/v1/chat/completions`. Integrate with the
  official **`openai` SDK (v4+/v5)** pointed at that base URL, or plain `fetch`
  — recommend the `openai` SDK (typed, streaming + `response_format` built in).
  Optional `HTTP-Referer` / `X-Title` headers for OpenRouter attribution.
- **Where the model id is configured.** **Server-side only**, via env var
  `OPENROUTER_MODEL` (an OpenRouter model id, e.g. `anthropic/claude-*`,
  `openai/*`, `google/*` — selectable without touching client code). The client
  **never** picks the model. Env: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
  (optionally `OPENROUTER_BASE_URL`). None are `NEXT_PUBLIC_*` — they stay
  server-side and are never shipped to the browser.
- **Structured output + validation.** Request JSON via
  `response_format: { type: 'json_schema', json_schema: {…strict…} }` for models
  that support it (fall back to `json_object` otherwise). **Always Zod-validate**
  the assembled payload at the client boundary before it becomes a domain
  `Routine` — never trust the model's shape. The Zod schema
  (`modules/routine-generation/api/ai/schema.ts`) is **isomorphic**: imported by
  the route (server) *and* the feature's client hook (browser). It is the one
  module in a feature's `api/` layer that is deliberately server-safe (pure, no
  Dexie) — which is why it, `prompt`, and `errors` sit in an `api/ai/`
  sub-folder, physically separated from the browser-only `routineRepo`.
- **Streaming for the progressing message.** The route sets `stream: true` and
  **pipes OpenRouter's SSE through** to the client as a streamed `Response`. The
  hook consumes the stream to drive the design-system's "specific, progressing
  message" (never an anonymous spinner), then assembles + Zod-validates the
  final JSON. If the selected model/route can't stream, the hook falls back to a
  scripted progressing status while awaiting the single response.
- **No silent save (product rule).** The validated routine is returned as
  `result` and persisted **only** on an explicit `confirmSave()`. Regeneration
  requires confirmation; nothing writes to IndexedDB implicitly.

### Why this is constraint-compatible (§0)
- The **key is server-side** (env var), never in the browser — strictly *better*
  than v1's BYOK on secret exposure.
- The route is **stateless**: it reads no store, writes no store, keeps nothing
  between requests. It receives a prompt, calls OpenRouter, streams the answer
  back. **All user data stays in the browser (IndexedDB/Dexie).** The refined
  constraint — *local-first for all data; the only server code is a stateless AI
  proxy route; no persistence server-side* — holds exactly.
- **Enforced boundary:** the route handler may import
  `modules/routine-generation/api/ai/{prompt,schema,errors}` **only**. It must
  **never** import `shared/db` or any `*Repo` (the persistence layer) — those are
  browser-only and represent the data the server is forbidden to touch. It must
  also not import the client-side `api/ai/client.ts` (that's the browser's fetch
  wrapper). Tool-enforced by Biome `noRestrictedImports` (§3, ADR-4 rule 4).

---

## 3. Project / folder structure — feature-first, layered inside each feature

### ADR-3: Feature-first (DDD) layout over a flat `lib/` + `ui/` split

**Decision.** Organize `src/` into **two top-level source folders**:

- **`modules/`** — one folder per **feature**; the feature is the primary unit.
  Each feature is **internally layered**: `ui/` (designer), `logic/` (engineer:
  domain rules + seam hooks + store), `api/` (engineer: persistence repos + the
  AI client), a feature-local `types.ts`, and a public `index.ts` **barrel**.
- **`shared/`** — modules used across features: `db/` (the single Dexie
  instance) and `ui/` — the design system: reusable **atoms/primitives**
  (Button, Input, Stepper…), feature-agnostic composites, layout, the token/font
  CSS, **and the theme** (`ui/theme/`: `useTheme` + store). Feature-specific
  composite components stay in `modules/<feature>/ui`, not here.

`src/app/` stays the Next App Router tree: **thin** route wrappers that delegate
into `modules/<feature>/ui`, plus the one stateless AI proxy route.

The four features map onto the build order **A→B→D→C**: `profile-goals` (A),
`routine-generation` (B), `workout-mode` (D), `calendar` (C).

**Rationale.** The feature is where cohesion lives: everything the calendar
needs — its screen, its aggregation logic, its range-query repo, its types — sits
in one folder you can reason about, move, or delete as a unit. Layering *inside*
the feature keeps the two-builder seam and the local-first firewall while scaling
better than one ever-growing `lib/` as features accrue.

**Alternative rejected — the v2 flat `lib/` (engineer) + `ui/` (designer)
split.** Simpler firewall (two zones), one obvious home for "all logic" / "all
UI". But it fractures every feature across four sibling folders (`lib/domain`,
`lib/data`, `lib/hooks`, `ui/screens`), so a change to one feature touches four
places and unrelated features pile into the same directories. The user chose
feature cohesion over that flatness. See **Tradeoffs** below for what we gave up.

**The two builders now meet at a layer, not a top-level folder:** designer owns
every feature's `ui/` + all of `shared/ui` (including the theme under
`shared/ui/theme`); engineer owns every feature's `logic/` + `api/` +
`shared/db` + the AI route. **The logic↔UI seam is the boundary between a
feature's `ui/` and its `logic/` (the hooks the feature's `index.ts`
re-exports).**

```
src/
  app/                                # Next App Router — thin composition root (architect-owned)
    layout.tsx                        # ROOT layout (server): shell, font preloads,
                                      #   no-flash theme <script>, client Providers mount
    manifest.ts                       # PWA web manifest (Next metadata API)
    globals.css                       # @import shared/ui/tokens/* ; Tailwind v4 entry
    page.tsx                          # '/'  → mounts profile-goals entry / redirect
    onboarding/page.tsx               # thin: renders modules/profile-goals/ui screen
    routine/page.tsx                  # thin: renders modules/routine-generation/ui screen
    workout/page.tsx                  # thin: renders modules/workout-mode/ui screen
    calendar/page.tsx                 # thin: renders modules/calendar/ui screen
    api/
      generate-routine/
        route.ts                      # ◀ server-only. Stateless OpenRouter proxy; holds
                                      #   OPENROUTER_API_KEY. Imports ONLY
                                      #   modules/routine-generation/api/ai/{prompt,schema,errors}.
                                      #   NEVER shared/db, NEVER a *Repo, NEVER api/ai/client.
  sw.ts                               # Serwist service worker source (precache shell + fonts)

  ┌── modules/ — FEATURE-FIRST. One folder per feature; LAYERED INSIDE. ─────────┐
  │  Uniform per-feature shape:  ui/ → logic/ → api/ → types.ts  (+ index.ts)    │
  modules/
    profile-goals/                    # ── Feature A ──
      ui/                             # DESIGNER. '"use client"' components + screen
        OnboardingScreen.tsx  GoalsForm.tsx  …
      logic/                          # ENGINEER. pure rules + seam hook + (store if needed)
        model.ts                      #   Profile/Goals invariants, pure derivations
        useProfile.ts                 #   ◀ SEAM hook — public (re-exported by index.ts)
      api/                            # ENGINEER. persistence; talks to shared/db (browser-only)
        profileRepo.ts
      types.ts                        # Profile, Goals  (feature-owned)
      index.ts                        # PUBLIC BARREL: useProfile + public types ONLY

    routine-generation/               # ── Feature B ──
      ui/
        GenerateScreen.tsx  RoutineView.tsx  ProgressStatus.tsx  …
      logic/
        model.ts                      #   invariant: ONE active routine; weekly-target derive
        useActiveRoutine.ts           #   ◀ SEAM
        useRoutineGeneration.ts       #   ◀ SEAM (generate/confirmSave; no silent save)
      api/
        ai/                           #   SERVER-SAFE subset (pure, no Dexie):
          schema.ts                   #     Zod — ISOMORPHIC (route + hook both import)
          prompt.ts                   #     prompt builder — used server-side by the route
          errors.ts                   #     AiError union
          client.ts                   #     BROWSER: fetch('/api/generate-routine') + stream read
        routineRepo.ts                #   BROWSER-ONLY persistence; talks to shared/db
      types.ts                        # Routine, Exercise, SetPlan
      index.ts                        # PUBLIC BARREL: hooks + Routine/Exercise/SetPlan types

    workout-mode/                     # ── Feature D ──
      ui/
        WorkoutScreen.tsx  SetLogger.tsx  RestTimerView.tsx  …
      logic/
        session.ts                    #   resume-at-exact-set; set-logging rules (pure)
        restTimer.ts                  #   exact timer engine (no smoothing, no drift)
        useWorkoutSession.ts          #   ◀ SEAM
        useRestTimer.ts               #   ◀ SEAM (the heartbeat)
        workoutStore.ts               #   Zustand hot state — feature-internal, NOT public
      api/
        sessionRepo.ts                #   BROWSER-ONLY persistence; talks to shared/db
      types.ts                        # WorkoutSession, SetLog, CompletedSession
      index.ts                        # PUBLIC BARREL: hooks + CompletedSession type

    calendar/                         # ── Feature C ──
      ui/
        CalendarScreen.tsx  ConsistencyMeter.tsx  …
      logic/
        aggregate.ts                  #   completed-session aggregation ("3 of 4 this week")
        useCalendar.ts                #   ◀ SEAM
      api/
        calendarRepo.ts               #   BROWSER-ONLY; range queries over completed sessions
      types.ts                        # CalendarWeek, ConsistencySummary
      index.ts                        # PUBLIC BARREL: useCalendar + summary types
  └──────────────────────────────────────────────────────────────────────────────┘

  ┌── shared/ — cross-feature modules ────────────────────────────────────────────┐
  shared/
    db/                               # ENGINEER. The ONE Dexie database (see note below)
      schema.ts                       #   Dexie subclass: ALL features' versioned stores + migrations
      index.ts                        #   single db instance (BROWSER-ONLY — never server-imported)
    ui/                               # DESIGNER. The design system (all '"use client"')
      tokens/
        tokens.css                    #   :root (dark default) + [data-theme="light"] vars
        fonts.css                     #   @font-face: Anton + Barlow (.woff2, self-hosted)
        globals.css                   #   base elements, two-layer focus rings, motion presets
      primitives/                     #   ◀ ATOMS: Button, Input, Stepper, Tag, Sheet, Toast, TimerRing…
                                      #     built once, reused by EVERY feature's ui/
      components/                     #   composed, feature-agnostic UI (still cross-feature)
      layout/                         #   AppShell, bottom-anchored CTA slot, safe-area
      theme/                          #   theme LOGIC (app-wide): useTheme + store
        useTheme.ts  themeStore.ts    #     resolve/persist/flip data-theme; drives the toggle
    types.ts                          # truly cross-cutting primitives only (ids, branded types) — keep minimal

  assets/fonts/                       # Anton-Regular.woff2, Barlow-{400,600,700,800}.woff2
  test/setup.ts                       # fake-indexeddb + RTL + MSW server
```

### The layer convention (defined once, applied to every feature)

| Layer | Owner | May contain | May import |
|---|---|---|---|
| `ui/` | designer | `'use client'` composites + the feature's screen(s); presentational, no data access; composes `shared/ui` atoms | own `logic/` (the seam) · `shared/ui` (atoms + theme) |
| `logic/` | engineer | pure domain rules (`model.ts`), the **seam hooks** (public), feature-internal Zustand store | own `api/` · own `types` · `shared/*` (domain-level) · another feature via its **barrel** |
| `api/` | engineer | repositories (sole Dexie callers) + — routine-gen only — the AI `client`/`prompt`/`schema`/`errors` | `shared/db` · own `types` · (nothing upward: not `logic/`, not `ui/`) |
| `types.ts` | engineer | feature-owned domain types | nothing (leaf) |
| `index.ts` | engineer | **barrel**: re-exports the feature's public surface — its seam hooks + public types, nothing else | own `logic/` + own `types` |

**Direction is strictly downward:** `ui → logic → api → types`. No layer imports
a layer above it. Everything a feature exposes to the rest of the app goes
through its `index.ts`; the `ui/`, `logic/`, `api/`, and `types` folders are
**private** to the feature.

**Where the Dexie DB lives, and how features talk to it.** One Dexie subclass in
`shared/db` declares **all** stores and owns the versioned migration chain; it
exports a **single `db` instance**. Each feature's `api/*Repo` imports that
instance and touches **only its own tables**, taking/returning the feature's
domain `types` (never raw Dexie rows). *Why one DB, not one-per-feature:*
IndexedDB versioning and migrations are **per-database**, and the calendar needs
range queries over sessions written by workout-mode — splitting into four DBs
would fragment migrations and block cross-feature queries. The cost is that
`shared/db/schema.ts` is a **shared coupling point** every feature's schema flows
through; we accept it as the price IndexedDB charges. Repos stay the firewall:
they are the *only* code touching Dexie, so the coupling is one file, not N.

**Cross-feature data flow (barrel-only).** Features are not islands — they form a
dependency chain that matches the build order:

```
profile-goals ──Goals──▶ routine-generation ──Routine──▶ workout-mode ──CompletedSession──▶ calendar
      (A)                        (B)                          (D)                             (C)
```

Downstream features import upstream ones **through the public barrel only**
(`import { … } from '@/modules/routine-generation'`), never a deep path. E.g.
`workout-mode` reads a `Routine` via routine-generation's `index.ts`;
`calendar`'s repo reads `CompletedSession` rows via workout-mode's public type.
This keeps the graph acyclic (A←B←D←C) and visible; a barrel cycle is a design
smell the CI dep-graph check surfaces (see the firewall below — cycle detection
is one of the rules Biome can't do, so `dependency-cruiser` owns it).

### The boundary firewall — four rules

Re-expressed for the feature-first shape (unchanged in intent from v3; what
changed in v4 is *how each is enforced* — see ADR-4):

1. **Feature UI isolation.** `modules/*/ui/**` may import only its **own**
   feature's `logic/**`, plus `shared/ui/**` (atoms + theme). Never its own
   `api/**` or `shared/db`, never another feature's internals. (UI reads state
   and calls callbacks; it never reaches storage, the AI client, or logic
   internals.)
2. **In-feature layer direction** (`ui → logic → api → types`, no upward
   imports). `logic/**` may not import `ui/**`; `api/**` may not import `logic/**`
   or `ui/**`. Enforced per feature.
3. **Cross-feature barrel-only.** From outside a feature, only
   `modules/<feature>/index.ts` is importable — never
   `modules/<feature>/(ui|logic|api|types)/**`. Applied per feature.
4. **The §0 server firewall (security-load-bearing).** `app/api/**/route.ts` may
   import **only** `modules/routine-generation/api/ai/{prompt,schema,errors}`. It
   must **never** import `shared/db`, any `**/*Repo`, or `api/ai/client` (browser
   fetch). And `shared/db/**` + every `**/*Repo` are **browser-only** — no server
   component or route may import them. This is the local-first constraint in code:
   the server literally cannot reach the persistence layer.

### ADR-4: Enforce the firewall with Biome `noRestrictedImports` + a `dependency-cruiser` CI check

**Decision.** Lint + format is **Biome** (one Rust tool, one `biome.json`,
replacing ESLint + Prettier). Biome's import guard is
`noRestrictedImports` — a **per-file, forbid-these-specifiers** rule (scoped to
file globs via `overrides`). It has **no** ESLint `import/no-restricted-paths`
"zone → allowed-targets" model and **no** import-cycle detection. So we split
enforcement:

- **Biome (`noRestrictedImports` in `overrides`) owns rules 1, 2, 4** — all three
  are "*this set of files must not import these path patterns*", which maps
  cleanly onto `overrides[].linter.rules...noRestrictedImports`. **Rule 4 stays
  fully tool-enforced** (the security-critical one).
- **`dependency-cruiser` (a CI step, `depcruise` config) owns rule 3 and cycle
  detection** — the "*barrel-only / no deep cross-feature import*" rule is
  relational ("a path under feature X is off-limits to importers **outside** X"),
  which Biome's per-file forbid-list can only approximate feature-by-feature and
  can't express as one rule. dependency-cruiser does relational path rules and
  `no-circular` natively. It runs in CI (`npm run depcruise`), same gate as lint.

**Why not force everything into Biome?** We could hand-write, per feature, an
`overrides` block forbidding every *other* feature's deep paths — but that's
O(features²) globs, drifts the moment a feature is added, and still can't catch
cycles. Honest split: Biome for the per-file bans (fast, on-save, in-editor),
dependency-cruiser for the graph-shaped rules.

**Alternative rejected — stay on ESLint** (`import/no-restricted-paths` +
`import/no-cycle` cover all four rules in one tool). Rejected because the user
chose Biome for speed and single-config simplicity. **What we give up:** rule 3 +
cycle detection leave the linter and become a **separate CI step** — not enforced
in-editor, only at CI. Mitigated by keeping dependency-cruiser in the same
pre-push/CI gate as Biome. **Alternative rejected — convention-only for rule 3**
(a code-review norm, no tool). Rejected: cross-feature coupling is exactly the
rot that silently accretes; the security rule (4) is tool-enforced regardless, so
only 3 was ever a candidate, and dependency-cruiser is cheap.

**Enforcement matrix:**

| Rule | Enforced by | How |
|---|---|---|
| 1 UI isolation | **Biome** (tool) | `overrides` glob `modules/*/ui/**` → `noRestrictedImports` bans `**/api/**`, `@/shared/db`, other features |
| 2 layer direction | **Biome** (tool) | `overrides` on `**/api/**` and `**/logic/**` ban importing upward layers |
| 3 barrel-only + no cycles | **dependency-cruiser** (CI script) | relational path rule (deep feature paths forbidden to outside importers) + `no-circular` |
| 4 server firewall | **Biome** (tool) | `overrides` glob `app/api/**/route.ts` → `noRestrictedImports` bans `@/shared/db`, `**/*Repo`, `**/api/ai/client` |

Representative config sketches (illustrative — generated/expanded per feature):

```jsonc
// biome.json — rules 1, 2, 4 (per-file forbid-lists via overrides)
{ "overrides": [
    { "include": ["src/app/api/**/route.ts"],                         // RULE 4
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "paths": {
          "@/shared/db": "server firewall: no persistence in the AI route",
          // plus patterns for **/*Repo and **/api/ai/client
        } } } } } } },
    { "include": ["src/modules/*/ui/**"],                             // RULE 1
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "paths": { "@/shared/db": "ui may not touch persistence" } } } } } } },
    { "include": ["src/modules/*/api/**"],                            // RULE 2 (no upward)
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "patterns": ["**/logic/**", "**/ui/**"] } } } } } }
] }
```
```js
// .dependency-cruiser.cjs — rule 3 (barrel-only) + cycles
module.exports = { forbidden: [
  { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  { name: 'cross-feature-barrel-only', severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to:   { path: '^src/modules/([^/]+)/(ui|logic|api|types)',
            pathNot: '^src/modules/$1/' } },   // importing another feature's internals → fail
] };
```

> **Note on `noRestrictedImports` path matching.** Biome bans by import
> *specifier* (what you write in `from '…'`), so the bans are expressed against
> the `@/…` path alias, and the `**/*Repo` / deep-path cases lean on its
> `patterns` glob support. Where a ban can't be phrased as a specifier pattern
> Biome accepts, that case falls to the dependency-cruiser step too. The one rule
> we will not let slip to convention is **rule 4** — verify at scaffold time that
> Biome actually errors on a `route.ts` importing `@/shared/db` (there's a unit
> test for it in §6).

**Where tokens / fonts / theme live:** all of it is now a **shared UI** concern
under `shared/ui`. The CSS (tokens, `@font-face`, `[data-theme]` sets) →
`shared/ui/tokens/`. The theme *logic* (resolve initial theme, persist override,
flip `data-theme`) is app-wide (not any one feature) → `shared/ui/theme/`
(`useTheme` + store). It's engineer-authored logic that physically lives in the
designer's shared folder — an accepted wrinkle, so the toggle and tokens ship as
one design-system unit and feature UI needs no extra import allowance. The
no-flash script goes in the Next **root layout** (§5).

### Tradeoffs — what we gave up vs the flat `lib/` + `ui/` split

- **A single home for "all logic" / "all UI" is gone.** Engineer and designer now
  work across N feature folders; a designer touching two features hops between
  `modules/*/ui`. Grokking the codebase means learning the feature map first.
- **More firewall surface, split across two tools.** v2 was ~two ESLint zones.
  Feature-first needs per-feature UI-isolation + layer-direction + barrel rules
  (1–3), and under **Biome** (ADR-4) rule 3 + cycle detection can't live in the
  linter at all — they move to a **`dependency-cruiser` CI step**. So the config
  is more surface *and* two tools; best **generated** from the feature list so it
  can't drift as features are added. The security rule (4) stays tool-enforced.
- **The "server can't touch data" rule spans a pattern, not a folder.** v2 could
  say "server never imports `lib/db|lib/data`" — one place. Now browser-only code
  is scattered across `modules/*/api/*Repo`, so rule 4 matches a **glob**
  (`**/*Repo`, `shared/db`). Naming discipline (`*Repo` suffix) is load-bearing;
  a repo that ignores the convention could slip the net.
- **Cross-feature types now travel through barrels,** introducing an explicit
  A←B←D←C dependency graph and the risk of barrel import cycles (mitigated: the
  graph is acyclic by design and lint-visible).
- **`shared/db/schema.ts` is a shared coupling point** — every feature's schema
  flows through one file (the IndexedDB tax, above).

**What we gained:** feature cohesion (one folder per feature), a codebase that
mirrors the build order, features that move/delete as units, and clearer
per-feature ownership as the app grows — the reasons the user chose this shape.

---

## 4. Patterns & conventions

### Component model
Function components + hooks; no classes. **`shared/ui` primitives** are
presentational (props in, markup out, zero data access). A **feature's `ui/`
screen** composes shared primitives + its own feature's seam hooks. Everything in
any `ui/` (shared or feature) is a **client component** (`'use client'`) — they
touch live state. Server components are limited to the shell in `app/layout.tsx`
and the thin route-segment wrappers.

### State flow
```
IndexedDB (source of truth, browser-only) — one Dexie instance in shared/db
   │  repositories (modules/*/api/*Repo) — only code touching Dexie
   ▼
seam hooks (modules/*/logic/use*) ──useLiveQuery──▶ reactive reads
   │        └── Zustand store (modules/workout-mode/logic/workoutStore) for hot state
   ▼
feature UI (modules/*/ui/**) — reads state + calls action callbacks;
                               never storage/api/logic-internals/routes
```
The AI call is the one exception that leaves the device: `useRoutineGeneration`
→ `modules/routine-generation/api/ai/client.ts` → `fetch('/api/generate-routine')`
→ the route → OpenRouter.

### Data-access layer
Repositories in `modules/*/api/*Repo` are the **sole** Dexie callers; each touches
only its own feature's tables and takes/returns that feature's domain types, not
Dexie rows. Invariants live in the feature's `logic/model` (or the repo), never in
UI (one active routine; calendar = completed sessions only; resume at exact set,
persisted per set so reload resumes precisely).

### Error handling
Repositories throw typed errors; hooks expose `{ data, loading, error }`. AI
failures are a union so the UI shows *specific, human* messages (never a raw
technical string) — and now includes the offline/route cases:
```ts
type AiError =
  | { kind: 'offline' }     // → "You're offline — generation needs a connection"
  | { kind: 'network' }     // → "Couldn't reach the generator. Retry."
  | { kind: 'rate-limit' }  // → "Too many requests. Wait a moment."
  | { kind: 'parse' }       // → "The AI returned something unexpected. Regenerate."
  | { kind: 'provider' };   // → "The generator had a problem. Try again."
```

### The logic↔UI interface convention  *(load-bearing)*
Capabilities are **custom hooks returning `{ state + action callbacks }`**,
exposed from a feature's `logic/` and re-exported by its `index.ts`. A feature's
`ui/` consumes its own hooks and nothing else from `logic/`/`api/`; it never
calls `/api` directly (the hook does). Async work exposes a status enum, not a
bare boolean, so the UI can render the four states precisely. No silent side
effects. **The signatures below are unchanged from v2 — only their file paths
moved into feature folders; the contract is stable.**

```ts
// shared/ui/theme/useTheme.ts  (app-wide, not a feature)
type Theme = 'light' | 'dark';
function useTheme(): { theme: Theme; setTheme: (t: Theme) => void };

// modules/workout-mode/logic/useRestTimer.ts  — the heartbeat; exact, never smoothed
interface RestTimer {
  secondsLeft: number;     // exact integer; updates the instant it changes
  totalSeconds: number;    // for the ring's fill fraction
  running: boolean;
  skip: () => void; restart: () => void; exit: () => void;
}
function useRestTimer(): RestTimer;

// modules/workout-mode/logic/useWorkoutSession.ts — resumes at the exact set after interruption
type WorkoutStatus = 'idle' | 'active' | 'resting' | 'complete';
interface WorkoutSessionApi {
  status: WorkoutStatus;
  currentExercise: Exercise;
  currentSet: SetPlan;
  logSet: (actual: { weight: number; reps: number }) => Promise<void>;
  startRest: () => void;
}
function useWorkoutSession(routineId: string): WorkoutSessionApi;

// modules/routine-generation/logic/useRoutineGeneration.ts — calls the app's /api route; no silent save
type GenStatus = 'idle' | 'generating' | 'error' | 'ready';
interface RoutineGeneration {
  status: GenStatus;
  progressMessage: string;          // driven by the streamed response
  result: Routine | null;           // held pending explicit confirmation
  error: AiError | null;
  generate: (prompt: string) => Promise<void>;  // POST /api/generate-routine
  confirmSave: () => Promise<void>;             // the ONLY path that persists
}
function useRoutineGeneration(): RoutineGeneration;
```
With these fixed, the engineer builds each feature's `logic/` + `api/` (+ the
route + `shared/db`), and the designer builds each feature's `ui/` (+ all of
`shared/ui`, including the theme), **in parallel** against the same shapes —
meeting at the seam inside every feature.

---

## 5. Design-token + font implementation plan

### Tokens → CSS custom properties (runtime themeable)
`shared/ui/tokens/tokens.css`. Theme-independent tokens + the **dark (default)**
color set live in `:root`; `[data-theme="light"]` overrides only the colors.
Semantic names mirror `design-system.md` §3.

```css
:root {
  --space-1:.25rem; /* … */ --space-11:5rem;
  --control-height-sm:48px; --control-height-md:56px; --control-height-lg:64px;
  --radius:0;
  --dur-instant:80ms; --dur-fast:150ms; --dur-base:200ms; --dur-slow:320ms;
  --ease-standard:cubic-bezier(.2,0,0,1);
  /* colors — DARK (default) */
  --color-background:#0D0D0D; --color-surface:#1A1A19;
  --color-text:#FFFFFF; --color-text-muted:#C3C2B7;
  --color-accent:#E8FF3D; --color-on-accent:#0B0B0B; --color-accent-text:#E8FF3D;
}
[data-theme='light'] {
  --color-background:#F9F9F7; --color-surface:#FCFCFB;
  --color-text:#0B0B0B; --color-text-muted:#52514E;
  --color-accent:#E8FF3D; --color-on-accent:#0B0B0B; --color-accent-text:#667200;
}
```
Tailwind v4 maps these into `@theme` (`--color-*`, `--spacing-*`, radius scale
`0`, control-height sizing) so utilities resolve to the **same** variables —
one source of truth. `globals.css` in `app/` imports `shared/ui/tokens/*` and
Tailwind.

### Self-hosted fonts (`.woff2`, no CDN — local-first)
`shared/ui/tokens/fonts.css`, files in `src/assets/fonts/`, served from origin only:
```css
@font-face{font-family:'Anton';font-weight:400;font-display:swap;
  src:url('/assets/fonts/Anton-Regular.woff2') format('woff2');}
@font-face{font-family:'Barlow';font-weight:400;font-display:swap;
  src:url('/assets/fonts/Barlow-Regular.woff2') format('woff2');}
/* + Barlow 600/700/800 */
```
- **Preload** the two hot faces (Barlow 400, Anton 400) with `<link
  rel="preload" as="font" type="font/woff2" crossorigin>` in `app/layout.tsx`;
  `font-display:swap` + the design-system fallback stacks prevent invisible
  text. Subset to latin. A `.num-tabular` utility applies
  `font-variant-numeric:tabular-nums` to live numbers (timer, in-set entry).
  Note: prefer this explicit `@font-face` over `next/font` so the exact
  self-hosted `.woff2` + preload story stays under our control.

### `{ theme, setTheme }` persistence + no-flash resolution
Owned by `shared/ui/theme/useTheme.ts`; UI just calls the hook.
- **Persistence:** the choice is one `localStorage` string (`wp.theme`) —
  synchronous, readable before first paint (IndexedDB is async → would flash).
- **Initial resolution** (design-system algorithm): persisted choice wins; else
  `prefers-color-scheme` — explicit `light` → light; dark / no-preference /
  unavailable → **dark** (tie-break).
- **No flash under SSR/hydration:** an **inline `<script>` in `app/layout.tsx`
  `<head>`** sets `document.documentElement.dataset.theme` from that resolution
  *before* React hydrates. `useTheme` hydrates from the same value; `setTheme`
  writes `localStorage` + flips `data-theme` + updates the store so consumers
  re-render. Flipping the attribute reskins the whole app instantly via the
  cascade — no rebuild. (This is the standard Next no-flash pattern; the script
  must run before paint, so it's inline in the root layout, not a component.)

---

## 6. Testing strategy

Weighted toward **logic, persistence, and the one route**; lighter on UI.

| Level | Tool | Covers |
|---|---|---|
| Domain rules (pure) | Vitest | Weekly-target derivation, resume-at-exact-set, one-active-routine invariant, calendar aggregation — no mocks |
| Data layer | Vitest + **fake-indexeddb** | Repositories run against a **real in-memory IndexedDB** — migrations, indexes, range queries exercised, not stubbed |
| **AI route handler** | Vitest + **MSW** | Invoke the exported `POST` with a mock `Request`; MSW mocks OpenRouter. Assert it **proxies correctly, maps errors, streams, and NEVER persists** (imports only `modules/routine-generation/api/ai/{prompt,schema,errors}`, no `*Repo`/`shared/db` — also tool-enforced by Biome, §3 ADR-4 rule 4) |
| **Firewall guard** | Biome + dependency-cruiser (CI) | `biome check` + `depcruise` run in CI as a gate. A scaffold-time fixture proves Biome **errors** when a `route.ts` imports `@/shared/db` (rule 4 is security-load-bearing) and that dep-cruiser fails a deep cross-feature import (rule 3) |
| AI client hook | Vitest + MSW | `useRoutineGeneration` against a mocked `/api/generate-routine`: streaming → `progressMessage`, Zod parse, `confirmSave` persists, malformed → `parse` error |
| Timer engine | Vitest + fake timers | Exact decrement, no drift, skip/restart/exit |
| UI (light) | RTL | Client-component primitives: renders, accessible name, focus ring present, disabled; a few screen-interaction tests |
| E2E (few, critical) | **Playwright** | (1) onboard → generate (route/OpenRouter mocked) → confirm-save; (2) workout: log sets, rest skip/restart, **interrupt + resume at exact set**; (3) complete session → shows on calendar; (4) theme toggle persists across reload; (5) offline: shell + all data screens work, generation shows the offline error |

**Local-first data layer:** we do **not** mock IndexedDB — `fake-indexeddb` runs
real Dexie, so a broken migration or missing index fails a test instead of
shipping. **The route handler is unit-tested for the §0 firewall specifically:**
that it holds no state and touches no persistence.

---

## 7. Decisions & remaining forks

| # | Fork | Status | Decision / alternative |
|---|---|---|---|
| **F1** | Framework | **RESOLVED** | **Next.js 15 (App Router) + React 19 + TS strict + PWA.** Client-heavy/local-first; server = shell + one AI route. (Was React+Vite.) |
| **F2** | Styling | **RESOLVED** | **Tailwind v4 + CSS custom properties.** Tokens are the substrate; Tailwind maps to them. |
| **F4** | AI approach | **RESOLVED** | **OpenRouter (OpenAI-compatible) via a stateless Next Route Handler**, key server-side, no data server-side (§0, §2). (Was BYOK direct-browser.) |
| **F6** | Routing | **RESOLVED** | **Next App Router** (React Router dropped). |
| **F3** | Persistence | **Confirmed** | **Dexie.js (IndexedDB)** + `localStorage` for theme. |
| **F5** | Client state | **Confirmed** | **Zustand + `dexie-react-hooks`.** |
| **F7** | Lint + format | **RESOLVED** | **Biome** (replaces ESLint + Prettier) + **`dependency-cruiser`** CI step for the graph-shaped import rules Biome can't express (§3 ADR-4). |
| — | PWA lib | Proposed | **Serwist (`@serwist/next`)** — flag if you'd rather hand-roll the SW. |
| — | AI SDK | Proposed | **`openai` SDK** pointed at OpenRouter's base URL (vs plain `fetch`). |

**Sequencing (follows the locked build order A→B→D→C):**
1. **Foundation** (this change): scaffold Next 15 App Router + TS + Tailwind v4;
   Serwist SW + `app/manifest.ts`; **Biome** (`biome.json`) + **dependency-cruiser**
   (`.dependency-cruiser.cjs`) wired into the CI gate; `shared/ui/tokens` CSS +
   `@font-face`; `shared/ui/theme/useTheme` + no-flash script in root layout; the
   `modules/` + `shared/` skeleton with the per-feature layer convention + the
   import firewall (all four §3 rules — rules 1/2/4 in Biome, rule 3 + cycles in
   dep-cruiser; generate the per-feature blocks). **Verify the rule-4 fixture
   errors** before moving on. `shared/db` Dexie schema v1; empty feature folders
   with seam-hook stubs matching the §4 signatures + each feature's `index.ts`
   barrel; an empty `app/api/generate-routine/route.ts`.
2. **A — data/goals:** `modules/profile-goals` — types, `api/profileRepo`,
   `logic/useProfile`, `ui/` onboarding.
3. **B — AI routine:** the OpenRouter route + `modules/routine-generation/api/ai`
   + `logic/useRoutineGeneration`; generate → stream progress → confirm-save.
   Exercises the whole seam **and** the §0/§2 proxy end-to-end.
4. **D — workout mode:** `modules/workout-mode` — `logic/workoutStore`, timer
   engine, `useWorkoutSession` + `useRestTimer`, resume-at-set (highest-risk
   logic — after the seam is proven).
5. **C — calendar:** `modules/calendar` — `logic/aggregate`, `useCalendar`,
   reading `CompletedSession` via workout-mode's barrel.

---

### On sign-off
The coordinator writes the chosen stack **and the refined constraint (§0)** into
`openspec/config.yaml` `context:` (replacing `Stack: NOT YET DECIDED`). Then I
run `spec-review` over this change and hand off to the frontend-dev-designer for
`/opsx:apply`. *(I have not modified `config.yaml`.)*
