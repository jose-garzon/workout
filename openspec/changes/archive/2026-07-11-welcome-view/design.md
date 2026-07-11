# Design — welcome-view (Feature A: profile & goals) — the *how*

**Status: DRAFT.** Turns the approved `proposal.md` + 4 spec deltas into a
technical design the software-engineer and frontend-dev-designer build against in
parallel. Foundation conventions (archived `bootstrap-architecture/design.md` §3
tree, §4 seam convention, §5 tokens/theme) are inherited verbatim; this doc only
adds what Feature A needs. No source is written here.

Jump to **§7** for the decisions + the forks that need your call.

---

## 1. Scope

First real feature. Delivers, all client-side and local-first:

- a **welcome** intro screen (app name, one-line description, single **Start**);
- a **3-step setup form** (≤2 inputs/step, step tracker, Back, forward
  validation) collecting the locked field set;
- **atomic persistence** of `Profile` + `Goals` to IndexedDB (no network);
- a **first-run gate** that opens welcome when no profile exists and home when one
  does, with **no onboarding flash**;
- a **name-only home stub**.

Out (proposal non-goals, honored here): no routine generation (B), no
edit/settings screen, no auth, home shows only the name.

The only network call in the whole app remains Feature B's AI proxy — **this
change makes zero network calls**. Enforced in tests (§6).

---

## 2. Data model

### 2.1 No migration — the foundation schema already fits

`shared/db/schema.ts` (v1) already declares both stores and their row shapes, and
`modules/profile-goals/types.ts` already declares the domain types. The locked
field set maps 1:1 onto existing fields — **nothing to add, no `version(2)`.**

| Locked field | Domain type field | Row field | Notes |
|---|---|---|---|
| Display name (req) | `Profile.displayName?` | `ProfileRow.displayName?` | optional in the *type*, required by *form validation* |
| Units (req, default metric) | `Profile.unit` | `ProfileRow.unit` | display/entry preference only (§2.3) |
| Bodyweight (req) | `Profile.bodyweightKg?` | `ProfileRow.bodyweightKg?` | stored canonical **kg** always |
| Height (optional) | `Profile.heightCm?` | `ProfileRow.heightCm?` | stored canonical **cm**; omitted if blank |
| Primary goal (req) | `Goals.focus` | `GoalsRow.focus` | `TrainingFocus` union |
| Training days/week (req) | `Goals.daysPerWeek` | `GoalsRow.daysPerWeek` | integer, **1–7** (D7) |
| — (not collected) | `Goals.notes?` | `GoalsRow.notes?` | untouched this change |

Both rows are **singletons keyed `id = "me"`** (already documented in the schema).

### 2.2 Two records, one atomic write — ADR

**Decision.** Keep `Profile` and `Goals` as **two rows in two stores** (as the
foundation schema already declares), but write them in a **single Dexie
read-write transaction** at finish so onboarding is all-or-nothing.

**Rationale.** The A→B data hand-off is by concern: Feature B reads `Goals`
(focus + daysPerWeek) to shape the split, and `Profile` (bodyweight) for load
context — two consumers, two rows, cleaner barrels. Merging into one record buys
nothing and fights the existing schema. The only risk of two rows is a
half-written profile (a `Profile` with no `Goals`); the transaction removes it —
either both land or neither does, so **row-presence of `profile` reliably implies
a complete onboarding** (the signal §4 routing depends on).

**Alternative rejected — one merged `ProfileGoals` record.** Would need a
`version(2)` migration to a store the foundation didn't declare, and would couple
two independently-consumed concerns for no gain. Rejected.

**Consequence.** `profileRepo` exposes one write, `saveOnboarding(profile,
goals)`, that wraps both `put`s in `db.transaction('rw', db.profile, db.goals, …)`.
There is no partial-save path and no separate `saveProfile`/`saveGoals` on the
seam this change (see §3.2).

### 2.3 Units — store canonical SI, `unit` is a display preference — ADR

**Decision.** Persist **kg** (`bodyweightKg`) and **cm** (`heightCm`) always;
`unit` records how the user wants to enter/read them. Imperial input is converted
lb→kg / in→cm at the logic boundary (`model.ts`) **before** the write.

**Rationale.** Every downstream consumer (Feature B prompt, later set-logging,
targets) then reads one canonical unit and stays unit-agnostic; only the UI edge
localizes. Storing raw values + a unit tag would force every consumer to branch on
`unit` forever. The field names (`…Kg`, `…Cm`) already commit us to SI.

**Alternative rejected — store as entered + convert on every read.** Spreads unit
logic across all future features. Rejected.

**Consequence / edge.** Values are interpreted in the unit selected **at finish**.
Units live on step 1, bodyweight/height on step 2, so the choice precedes entry.
If the user goes Back and flips units, the typed *number* is left as-is and simply
re-interpreted under the new unit (the label updates) — no silent re-conversion of
a value the user is looking at. Documented, intentional, cheapest correct behavior.

---

## 3. The logic↔UI seam (the parallel-build contract)

Two hooks, both in `modules/profile-goals/logic/`, both re-exported by
`index.ts`. Per the foundation convention: **all business rules live in `logic/`;
the designer's `ui/` is pure rendering + wiring.** Onboarding step orchestration
(which fields per step, validation, gating, unit labels, conversion) is
**business logic → it lives in `useOnboarding`, not in `ui/`.** The `ui/` renders
whatever `fields` the hook hands it and calls its callbacks — it never knows the
field set, the step grouping, or a validation rule.

### 3.1 `useOnboarding()` — drives the 3-step form

The hook owns an ephemeral draft (a `useReducer` inside the hook — not Zustand,
not persisted; it lives only while the form is mounted and is discarded after
finish). It exposes the **current step as a list of ≤2 field descriptors**, which
*structurally* guarantees the "≤2 inputs per step" rule and keeps every label /
option / validation message in logic.

```ts
// modules/profile-goals/logic/useOnboarding.ts  (types re-exported via index.ts)

type FieldName =
  | 'displayName' | 'unit' | 'bodyweight' | 'height' | 'focus' | 'daysPerWeek';

type FieldKind = 'text' | 'number' | 'choice';

interface FieldOption { value: string; label: string; }

interface OnboardingField {
  name: FieldName;
  kind: FieldKind;
  label: string;              // UNIT-AWARE, from logic: "Bodyweight (kg)" | "(lb)"
  value: string;              // controlled; '' === empty (numbers carried as strings)
  required: boolean;
  error: string | null;       // null until a blocked advance surfaces it
  placeholder?: string;
  // kind === 'number':
  min?: number; max?: number; step?: number; suffix?: string;   // e.g. 'kg' | 'lb'
  // kind === 'choice' (unit toggle, focus, days):
  options?: FieldOption[];
}

type OnboardingPhase = 'editing' | 'submitting' | 'error';

interface OnboardingApi {
  // step position (for the tracker: "Step {stepIndex+1} of {stepCount}")
  stepIndex: number;          // 0-based
  stepCount: number;          // 3
  stepTitle: string;          // short heading for the step

  // the current step's inputs — ALWAYS length 1 or 2
  fields: OnboardingField[];
  setField: (name: FieldName, value: string) => void;

  // navigation
  canGoBack: boolean;         // stepIndex > 0
  back: () => void;
  isLastStep: boolean;
  canAdvance: boolean;        // current step's required fields all valid
  next: () => void;           // advances if canAdvance; else fills in field.error (no throw)

  // finish (last step only)
  phase: OnboardingPhase;     // 'submitting' while the write is in flight
  submitError: Error | null;  // repo/tx failure → phase 'error'; ui offers retry
  finish: () => Promise<void>; // persists both rows atomically; see below
}

function useOnboarding(): OnboardingApi;
```

**Designer's rendering dispatch** (pure, presentational — not business logic): map
`field.kind` → a `shared/ui` atom. `text`→`Input`, `number`→`Input`
(numeric, with `suffix`), `choice`→a segmented/radio control (`unit` = 2 options →
toggle; `focus` = 4 → radio group; `daysPerWeek` = **1–7** → segmented/stepper). The
designer never hard-codes labels, options, or which field is on which step — all
of that arrives in `fields`.

**Validation timing (AC 5/6).** `setField` updates the value and clears that
field's error. Validation runs **on `next()`/`finish()`**, not per keystroke: a
blocked advance populates `field.error` and does not change `stepIndex`. `next()`
never throws. This matches "WHEN the user activates continue THEN it does not
advance and the field is indicated."

**What `finish()` does and returns.** Valid last step only. It (1) converts draft
values to canonical SI via `model.ts`, (2) calls
`profileRepo.saveOnboarding(profile, goals)` (single tx, §2.2), (3) resolves
`void`. It does **not** navigate. It does **not** return the saved data — home
reads it reactively (§3.2/§4), so the resolve is just a completion signal; on
resolve the gate has already flipped to home via the live query, and the form may
be unmounting (the ui must not set state after `await finish()`). On tx failure it
rejects → `phase: 'error'`, `submitError` set, ui shows a retry.

**Welcome vs form staging is UI state, not logic.** Which of *intro* / *form* is
on screen is a trivial `ui/` toggle (Start → mount the form). The hook only owns
the form's internal steps. Keeps `useOnboarding` about data, not chrome.

### 3.2 `useProfile()` — final signature (supersedes the foundation stub)

**DECIDED (D5).** The foundation stub
(`{ profile, goals, loading, error, saveProfile, saveGoals }`) was a placeholder.
It is **superseded here** by the read-only reactive hook below. **Engineer action:
rewrite the existing throwing stub** in `logic/useProfile.ts` to this signature —
drop `loading` (replaced by `status`), drop `saveProfile`/`saveGoals` entirely
(onboarding is the *only* writer and it goes through `useOnboarding.finish()`,
atomic, §2.2), and update the `ProfileApi` type + its re-export in `index.ts`. A
future edit-profile change (explicit non-goal) can add a mutation hook when it
exists.

```ts
// modules/profile-goals/logic/useProfile.ts  (re-exported via index.ts)

interface ProfileApi {
  profile: Profile | null;    // the singleton, or null if none saved
  goals: Goals | null;
  status: 'loading' | 'ready';// 'loading' until the first IndexedDB read resolves
  hasProfile: boolean;        // status === 'ready' && profile !== null
  error: Error | null;
}

function useProfile(): ProfileApi;
```

**Implementation.** Backed by `useLiveQuery` (`dexie-react-hooks`) over
`profileRepo.getProfile()` + `getGoals()`. `useLiveQuery` returns `undefined`
until its first emit → that *is* `status: 'loading'`; a resolved `null` row →
`ready` + `hasProfile: false`. Being live, it **re-emits automatically after
`finish()` writes** — this is the entire routing mechanism (§4): no manual
navigation, no refetch.

**Consumers.** The first-run gate (§4) reads `status`/`hasProfile`; the home stub
reads `profile.displayName`.

---

## 4. First-run routing — client-side gate, flash-free

**The hard part, stated plainly:** `shared/db` is **browser-only** (firewall rule
4) — the server *cannot* read Dexie. So the "has profile?" decision **cannot**
happen on the server, in an RSC, or via redirect config. It must be a **client
decision**, and it must not flash onboarding at returning users (AC 12) or home at
new users.

### 4.1 Mechanism — one client gate at `/`, conditional render (no URL redirect)

`app/page.tsx` (thin server wrapper) mounts a client `FirstRunGate` through the
**same `next/dynamic({ ssr: false })` pattern already used** by
`ProfileGoalsScreen` — so the static prerender contains only a neutral splash,
never onboarding or home markup. The gate then renders one of three things off
`useProfile()`:

```
app/page.tsx  (server, thin)
  └─ dynamic(() => FirstRunGate, { ssr:false, loading: <Splash/> })

FirstRunGate  ('use client', modules/profile-goals/ui)
  const { status, hasProfile } = useProfile()
  status === 'loading'          → <Splash/>        // neutral: app background only
  status === 'ready' &&  hasProfile → <HomeScreen/>   // name greeting stub
  status === 'ready' && !hasProfile → <WelcomeFlow/>  // intro → 3-step form
```

**Why conditional render, not `router.push('/welcome')`.** A redirect renders one
screen, then swaps URL + screen — the classic flash. Swapping the *component*
behind a single `/` while the data resolves shows the neutral splash first and
mounts exactly one real screen, once. `WelcomeFlow` is **never mounted when a
profile exists**, so onboarding markup literally cannot flash for returning users.
Specs say "routes to the welcome flow" — satisfied by rendering it; distinct URLs
aren't required and would cost the flash guarantee.

### 4.2 No hydration mismatch

Server output (ssr:false) = the `<Splash/>` fallback. The client's **first**
render, before the live query resolves, is also `<Splash/>` (`status:'loading'`).
They match → clean hydration. The swap to Home/Welcome happens **after**
hydration, when `useLiveQuery` first emits (a post-mount async), so React does the
transition on the client with no server HTML to disagree with. `Splash` is neutral
(app background, optional wordmark) — not an onboarding frame — so the loading
instant reads as "app booting," never as a flash of the wrong screen.

### 4.3 Finish → home, with no navigation code

Because `useProfile` is a live query, `finish()` writing the rows makes the gate
**re-render itself**: `hasProfile` flips `false→true`, `WelcomeFlow` unmounts,
`HomeScreen` mounts. Local-first routing falls out of the reactive read — there is
no `router.push`, no success flag to thread through the UI.

---

## 5. Boundaries & file ownership

Firewall rules 1–3 from the foundation apply unchanged; this change touches no
server code, so rule 4 is untouched. Concretely for Feature A:

- **Rule 1 (UI isolation).** `modules/profile-goals/ui/**` imports only its own
  `../logic` (the two hooks + their types) and `@/shared/ui/**`. It must **not**
  import `../api/profileRepo`, `@/shared/db`, or another feature.
- **Rule 2 (layer direction).** `logic/` may import `api/` + `types`; `api/` may
  import `@/shared/db` + `types`, never `logic`/`ui`.

```
modules/profile-goals/
  ui/         ── DESIGNER ──────────────────────────────────────────────
    FirstRunGate.tsx     reads useProfile; picks Splash | Home | WelcomeFlow
    Splash.tsx           neutral boot frame (app background)
    WelcomeFlow.tsx      intro (Start) ↔ form staging (ui state); hosts useOnboarding
    OnboardingForm.tsx   renders fields[] + tracker + Back/Continue|Finish
    HomeScreen.tsx       name-only greeting stub (reads useProfile)
  logic/      ── ENGINEER ─────────────────────────────────────────────
    model.ts             PURE: field/step defs, validation, unit conversion, labels
    useOnboarding.ts     the form orchestration seam (§3.1)
    useProfile.ts        reactive read seam (§3.2) — rewrites the throwing stub
  api/        ── ENGINEER ─────────────────────────────────────────────
    profileRepo.ts       getProfile · getGoals · saveOnboarding (atomic tx)
  types.ts               Profile, Goals — UNCHANGED
  index.ts               barrel: + useOnboarding & its public types

shared/ui/primitives/  ── DESIGNER (new atoms, reused by every feature) ──
  Input.tsx              text + numeric (label, suffix, error, required)
  Choice controls        segmented / radio / toggle for kind:'choice'
  Stepper.tsx            "Step N of M" progress (foundation lists this atom)
```

**Ownership splits.** Engineer: `logic/*`, `api/profileRepo`, keeps `types.ts`.
Designer: all of `ui/*` plus the new `shared/ui/primitives` atoms. The two build
in parallel against §3.

**`app/page.tsx`** (architect/thin) is re-pointed from the placeholder
`ProfileGoalsScreen` to mount `FirstRunGate` (same ssr:false pattern). The
foundation's `ProfileGoalsScreen`/`ProfileGoalsBody`/`ComingSoon` placeholder path
is retired by this change.

**Home placement note.** `HomeScreen` lives in `profile-goals/ui` for this stub
(its only content is the profile name). When Feature B adds routine entry points,
home will likely graduate to its own module or an app-level shell — flagged, not
solved now (one-plausible-step, no more).

---

## 6. Testing strategy

Weighted to logic + persistence, per the foundation. No IndexedDB mocking —
`fake-indexeddb` runs real Dexie.

| Level | Tool | Covers |
|---|---|---|
| Domain rules (pure) | Vitest | `model.ts`: required-empty/invalid → error; blank **height** advances (AC 6); bodyweight non-numeric/≤0 invalid; **days integer in 1–7** (0/8/non-integer rejected); `canAdvance` per step; each step yields **≤2** fields; unit-aware labels; lb→kg / in→cm conversion (+ rounding) |
| Data layer | Vitest + fake-indexeddb | `profileRepo` round-trip: `saveOnboarding` writes **both** rows; `getProfile`/`getGoals` read back; canonical **kg/cm** stored; **atomicity** — a forced `goals` failure rolls back `profile` (no half-write); reopen db → values persist (AC 10) |
| Seam integration | RTL + fake-indexeddb | Full flow via the hooks: fill 3 steps → `finish()` → both rows persisted → `useProfile` flips `hasProfile` → `FirstRunGate` renders `HomeScreen` greeting **by name** (AC 8/13) |
| Routing gate | RTL + fake-indexeddb | No profile → `WelcomeFlow`; seeded profile → `HomeScreen` **and assert onboarding markup is never rendered** (no-flash, AC 12); loading → `Splash` |
| No-network | Vitest/RTL + fetch spy (or MSW with zero handlers) | `finish()` makes **no** `fetch`/network call (AC 9, local-first) |
| Form UI (light) | RTL | Back preserves entered values (AC 4); Continue blocked + field indicated on invalid required (AC 5); imperial relabels body inputs (AC 7); tracker shows "Step X of 3" |
| E2E (1, optional) | Playwright | First run: welcome → 3 steps → home greets by name; reload → straight to home, no welcome (AC 11/12). A slice of foundation E2E #1 |

---

## 7. Decisions

All forks are **resolved** — no ambiguity remains for the builders.

| # | Decision | Rationale / rejected |
|---|---|---|
| D1 | **No migration** — reuse foundation v1 stores; field set maps 1:1 (§2.1) | Adding a store/version for data that already fits is pure churn |
| D2 | **Two rows, one atomic tx** (§2.2) | Concern-split hand-off to B; tx removes the only downside (half-write). Rejected: one merged record (needs migration, couples B's two consumers) |
| D3 | **Canonical SI stored, `unit` = display pref** (§2.3) | Consumers stay unit-agnostic. Rejected: store-as-entered (spreads unit logic everywhere) |
| D4 | **Field-descriptor seam** — `fields[]` (≤2) with logic-owned labels/validation (§3.1) | Structurally enforces ≤2/step; zero business rules in `ui/`. Rejected: designer-owned step state (leaks rules into UI) |
| D5 | **`useProfile` → read-only reactive**, supersede the foundation stub, drop `saveProfile`/`saveGoals` (§3.2) | Onboarding is the sole writer; live query drives routing. A future edit screen adds its own mutation hook |
| D6 | **Client gate + conditional render + ssr:false splash** (§4) | Only place the profile check *can* run; flash-free by construction. Rejected: `router.push` redirect (flashes) |
| D7 | **Training-days range = integer 1–7** | The `daysPerWeek` `choice` offers 1–7; validation rejects 0, 8, and non-integers. (Supersedes the proposal's "e.g. 2–6" illustration.) |
| D8 | **Returning-user route = neutral splash, Dexie the single source of truth** via `FirstRunGate` (§4) | IDB read + a neutral `Splash` for the sub-100ms load; one source of truth. Rejected: a synchronous `localStorage` `wp.hasProfile` mirror (a second source of truth that can desync from IDB) |
| D9 | **`Stepper` ("Step N of M") lives in `shared/ui/primitives`** as a reusable atom the designer builds | Foundation lists `Stepper` as a shared atom and multi-step flows recur (Feature B). Rejected: feature-local in `profile-goals/ui` |

**Build sequencing (two builders, parallel against §3):**
1. **Engineer:** `model.ts` (validation + conversion + step defs) → `profileRepo`
   → rewrite `useProfile` → `useOnboarding` → extend barrel. Land domain + repo
   tests first (pure + fake-indexeddb).
2. **Designer (in parallel):** new `shared/ui` atoms (`Input`, choice controls,
   `Stepper` per F2) → `WelcomeFlow`/`OnboardingForm` (render `fields[]`) →
   `HomeScreen` stub + `Splash` → `FirstRunGate`.
3. **Architect/thin:** re-point `app/page.tsx` to mount `FirstRunGate`, retiring
   the `ComingSoon` placeholder path.
4. Seam-integration + routing + no-network tests → `spec-review` → hand off.
