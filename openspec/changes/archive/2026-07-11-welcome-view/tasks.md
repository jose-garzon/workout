# Tasks — welcome-view (Feature A: profile & goals)

Ordered to match `design.md` §7 sequencing and the engineer/designer ownership
split. The **Engineer** and **Designer** groups build **in parallel** against the
§3 seam (`useOnboarding` / `useProfile` + the `OnboardingField` model); neither
blocks the other until the Integration group. Firewall rule 1 holds throughout:
`modules/profile-goals/ui/**` imports only its own `../logic` and `@/shared/ui`,
never `../api` or `@/shared/db`.

Each task has a checkable outcome and traces to a spec scenario via
`(spec: <scenario>)`. The coverage matrix at the end maps every scenario to its
covering task(s).

---

## Engineer — `logic/` + `api/` + tests (design.md §3, §5)

- [x] **E1 — `model.ts` step + field definitions.** Pure module exports the
  3-step layout as `OnboardingField[]` per step, each step holding **≤2** fields:
  step 1 `displayName`(text) + `unit`(choice: metric/imperial, default metric);
  step 2 `bodyweight`(number) + `height`(number, optional); step 3 `focus`(choice:
  4 `TrainingFocus` options) + `daysPerWeek`(choice: **1–7**). Outcome: a pure fn
  returns the field list for a given step index, unit-aware labels resolved (kg/cm
  vs lb/in). (spec: A step presents no more than two inputs and a tracker) (spec:
  All locked fields are collected across the three steps)

- [x] **E2 — `model.ts` validation rules.** Pure per-field validators: required =
  `displayName` (trimmed non-empty), `unit`, `bodyweight` (numeric > 0), `focus`,
  `daysPerWeek` (**integer in 1–7**); `height` optional (blank OK, if present
  numeric > 0). Outcome: `validateStep(index, draft)` returns per-field
  `error | null`; `canAdvance` derives from it. (spec: Continue is blocked when a
  required field is invalid) (spec: A blank optional field does not block
  advancing)

- [x] **E3 — `model.ts` unit conversion.** Pure `lb→kg` / `in→cm` (and kg/cm
  passthrough) with defined rounding, used at finish to canonicalize; plus the
  unit→label map driving E1's labels. Outcome: converting an imperial draft yields
  the correct canonical `bodyweightKg`/`heightCm`. (spec: Imperial units relabel
  the body inputs) (spec: Finishing onboarding writes Profile and Goals locally)

- [x] **E4 — `api/profileRepo.ts` (atomic write + reads).** `getProfile()` /
  `getGoals()` return the singleton (`id "me"`) domain types or `null`;
  `saveOnboarding(profile, goals)` writes **both** rows in one
  `db.transaction('rw', db.profile, db.goals, …)`. Imports only `@/shared/db` +
  `../types` (rule 2). Outcome: a completed draft persists two rows atomically;
  a forced `goals` failure rolls back `profile`. (spec: Finishing onboarding
  writes Profile and Goals locally)

- [x] **E5 — rewrite `logic/useProfile.ts` to the D5 read-only signature.**
  Replace the throwing stub with the reactive `ProfileApi`
  (`profile / goals / status / hasProfile / error`) backed by `useLiveQuery` over
  `profileRepo`; drop `loading` / `saveProfile` / `saveGoals`; update the
  `ProfileApi` type. Outcome: hook returns `status:'loading'` until first emit,
  then `hasProfile` reflects row presence and re-emits after a write. (spec: Home
  shows the saved name) (spec: Saved profile routes straight to home)

- [x] **E6 — `logic/useOnboarding.ts` (the form seam).** Implement `OnboardingApi`
  (§3.1): `useReducer` draft, `fields`/`setField`, `stepIndex/stepCount/stepTitle`,
  `next`/`back`/`canGoBack`/`canAdvance`/`isLastStep`, and
  `finish(): Promise<void>` that canonicalizes (E3) then calls
  `saveOnboarding` (E4). Validation runs on `next`/`finish`, never throws.
  Outcome: driving the hook through 3 valid steps + `finish()` persists both rows;
  a blocked `next()` sets `field.error` and does not change `stepIndex`. (spec:
  Back returns to the previous step with values intact) (spec: Finish saves and
  lands on home)

- [x] **E7 — extend `index.ts` barrel.** Re-export `useOnboarding` + its public
  types (`OnboardingApi`, `OnboardingField`, `FieldName`, …) and the revised
  `ProfileApi`; keep `useProfile`, `Profile`, `Goals`, etc. Outcome: `ui/` can
  import both hooks and their types from `../logic` with no deep `api/` reach.

- [x] **E8 — domain unit tests (Vitest, no mocks).** Cover E1–E3: each step yields
  ≤2 fields; required-empty/invalid → error; blank height advances; bodyweight
  non-numeric/≤0 invalid; **days integer in 1–7 (0/8/non-integer rejected)**;
  unit-aware labels; lb→kg / in→cm conversion + rounding. Outcome: green. (spec: A
  step presents no more than two inputs and a tracker) (spec: Continue is blocked
  when a required field is invalid) (spec: A blank optional field does not block
  advancing)

- [x] **E9 — repo tests (Vitest + fake-indexeddb).** Real Dexie: `saveOnboarding`
  writes both rows; `getProfile`/`getGoals` read them back; canonical **kg/cm**
  stored; **atomicity** (forced goals failure → no half-write); reopen the db →
  values persist. Outcome: green. (spec: Finishing onboarding writes Profile and
  Goals locally) (spec: Saved values are present after a reload)

## Designer — `ui/` + new `shared/ui/primitives` atoms (design.md §3, §5)

- [x] **D1 — `shared/ui/primitives/Input.tsx`.** Reusable text + numeric atom:
  label, `required` mark, `error` state, optional numeric `suffix` (kg/lb/cm/in),
  design-system sizing + focus ring. Outcome: renders both kinds with accessible
  name + error association. (spec: Imperial units relabel the body inputs)

- [x] **D2 — `shared/ui/primitives` choice controls.** Atom(s) for
  `kind:'choice'`: a 2-option toggle (units), a radio group (4 focus options), and
  a segmented/stepper for `daysPerWeek` (**1–7**). Outcome: single-select,
  keyboard-navigable, reflects `value`/`options`. (spec: All locked fields are
  collected across the three steps)

- [x] **D3 — `shared/ui/primitives/Stepper.tsx` (D9).** Reusable "Step N of M"
  progress atom driven by `stepIndex`/`stepCount`. Outcome: renders e.g.
  "Step 2 of 3". (spec: A step presents no more than two inputs and a tracker)

- [x] **D4 — `ui/WelcomeFlow.tsx` (intro ↔ form staging).** Local UI state toggles
  *intro* (app name, one-line description, single primary **Start**) → *form*
  (mounts `OnboardingForm`). Hosts `useOnboarding` for the form stage. Outcome:
  Start swaps intro → form at step 1. (spec: Welcome screen shows identity and a
  Start action) (spec: Start opens the setup form)

- [x] **D5 — `ui/OnboardingForm.tsx` (renders `fields[]`).** Maps `field.kind` →
  D1/D2 atoms (pure dispatch, no business rules), shows the D3 tracker, and wires
  `setField` / `back` / `next` / `finish`; renders **Back** on every step after
  the first, and **Continue** vs **Finish** off `isLastStep`; surfaces
  `field.error` and the `submitting`/`error` phase. Imports only `../logic` +
  `@/shared/ui` (rule 1). Outcome: a full pass through 3 steps drives the hook and
  finishes. (spec: Back returns to the previous step with values intact) (spec:
  Continue is blocked when a required field is invalid) (spec: Finish saves and
  lands on home)

- [x] **D6 — `ui/HomeScreen.tsx` (name stub).** Reads `useProfile`, renders the
  greeting using `profile.displayName`; no other feature content. Outcome: shows
  the saved name. (spec: Home shows the saved name)

- [x] **D7 — `ui/Splash.tsx`.** Neutral boot frame (app background, optional
  wordmark) — deliberately not an onboarding or home frame. Outcome: renders a
  neutral full-height frame for the loading instant. (spec: Saved profile routes
  straight to home)

- [x] **D8 — `ui/FirstRunGate.tsx`.** Reads `useProfile`; renders `Splash` while
  `status:'loading'`, `HomeScreen` when `hasProfile`, else `WelcomeFlow`. Imports
  only `../logic` + `@/shared/ui` (rule 1). Outcome: exactly one real screen
  mounts once data resolves; `WelcomeFlow` never mounts when a profile exists.
  (spec: No saved profile routes to welcome) (spec: Saved profile routes straight
  to home)

- [x] **D9 — light form UI tests (RTL).** Back preserves entered values; Continue
  blocked + offending field indicated on invalid required; imperial relabels body
  inputs; tracker shows "Step X of 3". Outcome: green. (spec: Back returns to the
  previous step with values intact) (spec: Continue is blocked when a required
  field is invalid) (spec: Imperial units relabel the body inputs) (spec: A step
  presents no more than two inputs and a tracker)

## Architect / thin — composition root

- [x] **T1 — re-point `app/page.tsx` to `FirstRunGate`.** Mount `FirstRunGate` via
  the existing `next/dynamic({ ssr:false, loading: <Splash/> })` pattern; retire
  the `ProfileGoalsScreen` / `ProfileGoalsBody` / `ComingSoon` placeholder path.
  Outcome: `/` boots into the gate; no `ComingSoon` remains on the profile path.
  (spec: No saved profile routes to welcome) (spec: Saved profile routes straight
  to home)

## Integration / verify (design.md §6)

- [x] **I1 — seam-integration test (RTL + fake-indexeddb).** Fill 3 steps →
  `finish()` → both rows persisted → `useProfile` flips `hasProfile` →
  `FirstRunGate` renders `HomeScreen` greeting **by name**. Outcome: green. (spec:
  Finish saves and lands on home) (spec: Home shows the saved name)

- [x] **I2 — routing / no-flash test (RTL + fake-indexeddb).** No profile →
  `WelcomeFlow`; seeded profile → `HomeScreen` **and onboarding markup is never
  rendered**; `loading` → `Splash`. Outcome: green. (spec: No saved profile routes
  to welcome) (spec: Saved profile routes straight to home)

- [x] **I3 — no-network test.** Assert `finish()` makes **no** `fetch`/network
  call (fetch spy or MSW with zero handlers). Outcome: green — local-first upheld.
  (spec: Finishing onboarding writes Profile and Goals locally)

- [x] **I4 — full gate green.** `biome check` + `depcruise` + the test suite all
  pass on the pre-commit hook (firewall rules 1–3 clean; no `ui → api`/`shared/db`
  imports). Outcome: a clean commit. (spec: all scenarios — regression gate)

---

## Coverage matrix — spec scenario → covering task(s)

| Spec (delta) | Scenario | Covering task(s) |
|---|---|---|
| onboarding-welcome | Welcome screen shows identity and a Start action | D4 |
| onboarding-welcome | Start opens the setup form | D4 |
| profile-setup-form | A step presents no more than two inputs and a tracker | E1, D3, E8, D9 |
| profile-setup-form | Back returns to the previous step with values intact | E6, D5, D9 |
| profile-setup-form | Continue is blocked when a required field is invalid | E2, E8, D5, D9 |
| profile-setup-form | A blank optional field does not block advancing | E2, E8 |
| profile-setup-form | All locked fields are collected across the three steps | E1, D2 |
| profile-setup-form | Imperial units relabel the body inputs | E3, D1, D9 |
| profile-setup-form | Finish saves and lands on home | E6, D5, I1 |
| profile-persistence | Finishing onboarding writes Profile and Goals locally | E3, E4, E9, I3 |
| profile-persistence | Saved values are present after a reload | E9 |
| first-run-routing | No saved profile routes to welcome | D8, T1, I2 |
| first-run-routing | Saved profile routes straight to home | E5, D7, D8, T1, I2 |
| first-run-routing | Home greets the user by name (Home shows the saved name) | E5, D6, I1 |
