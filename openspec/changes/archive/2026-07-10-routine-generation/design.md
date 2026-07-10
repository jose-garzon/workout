# Design — routine-generation (Feature B)

## Context

Feature A shipped onboarding, persistence, first-run routing, and a **name-only
home stub** (`modules/profile-goals/ui/HomeScreen`, rendered by `FirstRunGate`).
`bootstrap-architecture` pre-froze this feature's contract as compiling stubs:
the domain model (`Routine` / `RoutineDay` / `Exercise` / `SetPlan`), the AI
response schema + JSON-schema export (`api/ai/schema.ts`), the error taxonomy
(`api/ai/errors.ts`), the browser AI client (`api/ai/client.ts`), the prompt
builder (`api/ai/prompt.ts`), the two seam hooks (`useRoutineGeneration`,
`useActiveRoutine`), and a **stateless proxy shell** that currently 501s. This
change fills those in without changing their signatures.

Hard constraints that shape everything below:

- **Local-first.** The routine lives only in IndexedDB. The single permitted
  network call is the AI proxy, which persists nothing.
- **Server firewall (rule 4, security-load-bearing).** `app/api/**/route.ts` may
  import only `modules/routine-generation/api/ai/{prompt,schema,errors}` — never
  `shared/db`, any `*Repo`, or `api/ai/client`. Consequence for this change:
  **the server cannot read the user's profile.** Any profile/goals the AI needs
  must be sent by the client in the request body.
- **Feature UI isolation (rule 1).** `modules/*/ui` imports only its own `logic/`
  + `shared/ui`. Consequence: routine-generation UI **cannot** import
  `profile-goals` for the name/goal; that data must arrive as **props** from the
  app composition layer.

## Goals / Non-Goals

**Goals**

- Implement the frozen seams (`useRoutineGeneration`, `useActiveRoutine`) and the
  real streaming proxy behind their existing signatures.
- Turn home into a routine dashboard + composer, composed across two features
  without violating the import firewall.
- Persist a single active routine with a trivially-correct one-at-a-time
  invariant and a guarded replace path.
- Make the wait legible: animated building indicator + live streamed thinking.

**Non-Goals**

- No routine editing, no library/switching, no multi-turn chat, no workout-mode
  behavior (only navigation to its empty screen), no calendar. (See proposal
  non-goals.)
- No change to `profile-goals` internals — it is consumed read-only via its
  barrel.

## Decisions

### D1 — Home is owned by routine-generation; identity flows in as props

The name-only `HomeScreen` in `profile-goals/ui` is **superseded**. Home's
dominant content is now the routine dashboard + composer, so
**routine-generation owns the home screen** (`ui/RoutineHomeScreen`). Because
rule 1 forbids it from importing `profile-goals`, the identity data
(`displayName`, `goal`) is passed in as props.

Composition happens at the **app layer** (the route-wrapper exception — `app/`
may deep-import a feature screen and may call feature barrels; the existing
`page.tsx` already deep-imports `FirstRunGate`). `FirstRunGate` is refactored
from hard-coding `HomeScreen` to accepting a **`home` render slot** that receives
the loaded `profile`/`goals`:

```
FirstRunGate({ home }: { home: (p: Profile, g: Goals) => ReactNode })
  status==='loading'        -> <Splash/>
  !hasProfile               -> <WelcomeFlow/>
  hasProfile                -> home(profile, goals)
```

`app/page.tsx` supplies the slot:
`home={(p, g) => <RoutineHomeScreen displayName={p.displayName} goal={g.focus} />}`.
This keeps each feature's `ui/` importing only its own `logic/` + `shared/ui`;
the one place both features meet is `app/`, which is allowed to.

- **Alternative — home in `shared/ui`:** rejected; home is feature content, not a
  design-system composite, and it needs `useRoutineGeneration`.
- **Alternative — keep home in `profile-goals` and inject routine UI:** impossible
  under rule 1 (would require a cross-feature UI import either direction).

### D2 — Client sends profile/goals; server folds them into the prompt

Since the firewall bars the server from `shared/db`, the browser client
(`api/ai/client.ts`) sends `{ prompt, profile, goals }` in the POST body. The
route validates the body shape and calls `buildRoutinePrompt(prompt, { profile,
goals })`, which extends the frozen signature to fold goal / days-per-week /
bodyweight / units into the system+user messages. The user never re-types onboarding
data (spec `routine-generation`), and the server stays stateless and
db-free.

The route itself is a **one-line delegate**: `POST` just returns
`handleGenerateRoutine(request)`. The env read, body validation, OpenRouter call,
and SSE pass-through all live in a server-side service,
`api/ai/openrouter.ts` — the proxy→OpenRouter counterpart to the browser
`api/ai/client.ts` (client→proxy). The `app/` layer only wires; the work lives
in the module. `openrouter.ts` is server-safe (imports only its `api/ai/`
siblings — prompt/schema/errors — never `shared/db`, any `*Repo`, or `client`),
so firewall rule 4 still holds. `OPENROUTER_BASE_URL` is honored as an optional
override (default `https://openrouter.ai/api/v1`).

- **Alternative — server reads the profile:** violates rule 4 outright.
- **Alternative — keep the fetch inline in `route.ts`:** rejected; app-layer
  route files should delegate into the module, not carry service logic.

### D3 — Streaming protocol: reasoning → thinking summary, content → routine JSON

The proxy calls OpenRouter with `stream: true` and structured output
(`response_format` built from `routineJsonSchema`, already exported). It pipes the
upstream SSE straight back to the client (still stateless — a pass-through, not a
store). The browser client parses the SSE deltas:

- `delta.reasoning` chunks accumulate into the **thinking summary**
  (`progressMessage`) shown above the composer, updating live.
- `delta.content` chunks accumulate into the routine **JSON string**, parsed once
  at stream end and validated with `routineSchema` (Zod) before it is trusted —
  never trust the model's shape at the boundary.

`useRoutineGeneration.generate()` drives the store from these events. This is why
the frozen client returns a `Response` (the stream) rather than parsed JSON: the
foundation deliberately left stream consumption to this change.

- **Risk — reasoning verbosity:** raw reasoning can be long/rambly. Mitigation:
  the UI renders the accumulated reasoning in a bounded, auto-scrolled region
  (latest visible); we show it as-is rather than post-summarizing (a second model
  call would add latency and cost). If it reads poorly we can later ask the model
  for a terse status line — deferred, not blocking.
- **Risk — model without reasoning tokens:** some models emit no `reasoning`.
  Mitigation: spec allows success with no thinking summary; the animated
  indicator still communicates progress.
- **Risk — malformed/truncated JSON:** Zod validation failure maps to
  `AiError{kind:'parse'}` → "regenerate" message; no partial routine is adopted.

### D4 — In-flight state lives in a Zustand store (logic layer)

Generation state — `status: GenStatus`, `progressMessage`, `result: Routine |
null`, `error: AiError | null` — lives in a Zustand store under
`logic/`, wrapped by `useRoutineGeneration`. Three separate UI regions read it
(the building indicator between header and composer, the thinking summary above
the composer, the held-result → summary), spread across the dashboard subtree;
a store avoids prop-drilling shared transient state and matches the architecture
(`logic/` owns the store). `status` extends its frozen union as:
`idle → generating → (ready | error)`, where **`ready`** means "validated routine
held, pending adoption."

### D5 — Adoption vs. replacement, mapped onto the frozen `confirmSave()`

The frozen seam declares `confirmSave()` as "the ONLY path that persists." We
honor that literally and layer the product rule (proposal Key Decision 1) on top
in the UI, not by adding new persist paths:

- **No routine exists + `status==='ready'`:** the dashboard calls `confirmSave()`
  automatically — frictionless first adoption. (Still the single persist path,
  just not gated by a dialog.)
- **A routine exists + `status==='ready'`:** the dashboard shows a
  **replace-confirmation**; `confirmSave()` runs only on explicit confirm.
  Declining drops the held `result` (store reset to `idle`) and leaves the active
  routine untouched.

`confirmSave()` writes via `routineRepo` and clears the held result.

### D6 — routineRepo: singleton row makes "exactly one" trivial

The active routine is stored as a **singleton row** at a fixed id (`"active"`,
mirroring the profile's `"me"`), in a new `routines` object store (schema version
bump + migration in `shared/db`). `saveActive(routine)` is a `put` that
overwrites; `getActive()` reads the row or `null`. This makes the
one-active-routine invariant structural — there is nowhere for a second to live —
rather than something enforced by query logic.

- **Alternative — a table of routines with an `active` flag:** rejected for MVP;
  it invites multi-row bugs and the proposal's non-goal is explicit (no library).
  The domain `Routine.active` field stays (frozen type) but is always `true` for
  the stored singleton.

`useActiveRoutine` becomes a `useLiveQuery` over `getActive()` (same reactive
pattern as `useProfile`), so home re-renders the instant `confirmSave()` writes —
no manual refresh.

### D7 — Motivational blurb is part of the routine payload

`routineSchema` and `Routine` gain an optional `subtitle` string; the system
prompt instructs the model to author a short motivational line for the split. It
persists on the routine and renders in the identity header. When absent (or no
routine), the header shows a neutral invitation. No separate model call.

### D8 — Workout-mode navigation

A day in the summary links to a new thin route `app/workout/[dayId]/page.tsx`
that renders the existing `WorkoutModeScreen` (empty/ComingSoon). Navigation is
by URL (`next/link` / router push) using the day's id — no cross-feature import,
so no firewall concern. Feature D will consume `[dayId]` later.

### D9 — Best-effort in-memory IP rate limit on the proxy

The proxy is unauthenticated (local-first — no accounts) and spends the server's
OpenRouter key, so an open endpoint could burn credits. `api/ai/rateLimit.ts`
caps requests per client IP (`x-forwarded-for` first hop, else `x-real-ip`) in a
fixed window (default 10 / 60s, tunable via `RATE_LIMIT_MAX` /
`RATE_LIMIT_WINDOW_MS`). Over the limit → `429 { kind: "rate-limit" }`, which the
browser client already maps back to the existing `rate-limit` `AiError`, so the
UI surface is unchanged. It runs first in `handleGenerateRoutine`, before env/body
work, to shed abuse early.

It holds only **ephemeral counters, never user data**, in a module-level `Map`
that vanishes on restart (with an opportunistic sweep so it can't grow
unbounded) — so "the stateless proxy stores nothing *durable*" still holds. This
is the important nuance: it is **per-instance and best-effort**, not a hard
guarantee. On a multi-instance/serverless deploy each instance limits
independently, so real protection still wants a platform/edge limit + an
OpenRouter key spend cap layered on top.

- **Alternative — durable KV/Redis token bucket:** serverless-correct but adds a
  backend service, which the local-first "no backend" constraint forbids without
  an explicit exception. Rejected for now; the edge-limit + key-cap combo covers
  the same ground without app-owned state.

## Risks / Trade-offs

- **Streaming pass-through correctness** → the proxy must forward SSE without
  buffering the whole response (defeats the live thinking). Mitigation: return the
  upstream `ReadableStream` directly; test with an MSW streaming handler.
- **Firewall regressions from home composition** → easy to accidentally import
  `profile-goals` from routine-generation UI. Mitigation: identity strictly via
  props (D1); the Biome/depcruise pre-commit hook fails the commit if violated.
- **Reasoning stream cost/latency** → reasoning models are slower/pricier.
  Mitigation: model id is server-env (`OPENROUTER_MODEL`), swappable without a
  client change; verbosity handling per D3.
- **Held-but-unsaved result on navigation** → if the user navigates away while a
  routine is `ready`-but-declined, the held result is transient (store, not
  persisted) and is correctly lost. Acceptable: nothing was adopted.

## Migration Plan

Additive; no user-facing data migration beyond a `shared/db` schema-version bump
adding the `routines` store (empty for existing users — they simply have no
routine yet, which is a valid state). Rollback = revert the change; the
`routines` store lying unused is harmless. `profile-goals` `HomeScreen` is removed
in favor of the app-layer composition (D1) — a code change, not a data one.

## Open Questions

- **Exact OpenRouter reasoning field shape** across candidate models
  (`delta.reasoning` vs provider variants) — pin during implementation against the
  chosen `OPENROUTER_MODEL`; the client's SSE parser is the only place affected.
- **Thinking-summary presentation** — raw streamed reasoning vs. a terse
  distilled status. Shipping raw (D3); revisit only if it reads poorly.
