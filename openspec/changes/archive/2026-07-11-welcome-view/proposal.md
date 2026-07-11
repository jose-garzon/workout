# Proposal — welcome-view (Feature A: profile & goals)

> First real user feature. Delivers Feature A from the locked build order
> (**A** profile-goals → B → D → C) as a first-run onboarding flow. The *how*
> (schema, seam wiring, routing mechanics) is the architect's `design.md`; this
> proposal owns *what & why* and the acceptance gate. Domain types already exist
> in `modules/profile-goals/types.ts` (`Profile`, `Goals`) from the foundation
> change — the field set below stays inside them.

## Problem / why

The app opens to an empty shell. Before it can do anything valuable — its whole
reason to exist is generating and guiding a routine (Feature B onward) — it must
know **who the user is and what they train for**. The AI routine generator
(Feature B) cannot produce a split, exercise selection, or weekly volume without
a goal, a training frequency, and body context. Today there is no way to capture
any of it, and no persistence-backed profile.

First impressions also matter: our user is an intermediate gym-goer who values
efficiency. A slow, form-heavy, one-giant-page signup would bounce them. We need
a fast, guided, low-friction first run that collects exactly the data Feature B
needs — nothing more — and then gets out of the way. And because we are
local-first, once they've done it, the app must remember them on this device and
never ask again.

## Target user

The **intermediate gym-goer** (full-gym equipment, values efficiency over
hand-holding — `config.yaml` context, locked persona). They want to answer a few
sharp questions and get to the product. They will not tolerate a long form or
data the app doesn't visibly need.

## User stories

- **As a first-time user,** I want a welcome screen that tells me what the app is
  and lets me start, so I understand the value before committing.
- **As a first-time user,** I want to enter my details in short, focused steps
  (never more than two questions at once) with a visible sense of progress and
  the ability to go back, so onboarding feels quick and forgiving.
- **As a first-time user,** I want to reach the app immediately after finishing
  setup and see it greet me by name, so I know my details were saved.
- **As a returning user,** I want the app to skip onboarding and open straight to
  home, so I never re-enter data I already gave on this device.

## The field set (KEY DECISION — needs approval)

This is the main product call: the concrete data onboarding collects. Kept lean;
every field earns its place by feeding Feature B (AI routine generation) or the
home greeting. All of it maps to the **existing** `Profile` / `Goals` types.

| Field | Type | Required? | Why it's collected |
|---|---|---|---|
| **Display name** | text | **Required** | Home greeting; personal feel. |
| **Units** | metric / imperial (toggle, default metric) | **Required** | Governs how weight is entered/shown here and everywhere later (logging, targets). |
| **Bodyweight** | number (kg/lb per units) | **Required** | Load context for Feature B — bodyweight-exercise progression, relative-strength framing. |
| **Height** | number (cm/in per units) | **Optional** | Light body context; not needed for routine structure. Candidate to cut. |
| **Primary goal** | strength / hypertrophy / endurance / general (single select) | **Required** | Drives Feature B's split, rep ranges, rest targets. |
| **Training days / week** | number (e.g. 2–6) | **Required** | Drives Feature B's split volume; later drives the calendar's weekly target. |

**Deliberately NOT collected** (flag for approval):
- **Experience level** — persona is locked as *intermediate*; we assume it rather
  than ask. Removes a question.
- **Equipment** — full-gym access is assumed (config). Not asked.
- **Age / sex / injuries / diet** — out of scope for a structure-only generator;
  adds friction without changing routine structure in MVP.

**Proposed step grouping** (≤2 inputs/step; final visual grouping is the
designer's, this is intent): Step 1 — name + units · Step 2 — bodyweight +
height · Step 3 — primary goal + training days. Three steps.

## Acceptance criteria (Given / When / Then)

**Welcome screen**
1. GIVEN a device with no saved profile, WHEN the app opens, THEN a welcome
   screen shows the app name, a one-line description of what it does, and a single
   primary **Start** action.
2. GIVEN the welcome screen, WHEN the user activates **Start**, THEN the
   step-by-step setup form opens at step 1.

**Multi-step form**
3. GIVEN the setup form, WHEN any step is shown, THEN it presents **at most two**
   input fields and a step tracker indicating current position and total (e.g.
   "Step 2 of 3").
4. GIVEN any step after the first, WHEN it is shown, THEN a **Back** control is
   present and returns to the previous step with previously entered values intact.
5. GIVEN a step with one or more **required** fields, WHEN a required field is
   empty or invalid, THEN the forward/continue action does not advance and the
   invalid field is indicated.
6. GIVEN an **optional** field left blank (height), WHEN the user continues, THEN
   the step advances without error.
7. GIVEN the units toggle is set, WHEN bodyweight/height are entered, THEN their
   labels and interpretation match the selected units (kg/cm vs lb/in).
8. GIVEN the final step with all required fields valid, WHEN the user activates
   the finish action, THEN their profile and goals are saved and they land on home.

**Persistence (local-first)**
9. GIVEN a completed onboarding, WHEN finish is activated, THEN a `Profile` and
   `Goals` record are persisted to IndexedDB on this device (no network call —
   the only permitted network call in the whole app is Feature B's AI proxy).
10. GIVEN a saved profile, WHEN the browser is fully reloaded or reopened, THEN
    the saved values are still present.

**First-run routing**
11. GIVEN a device with **no** saved profile, WHEN the app opens, THEN it routes
    to the welcome flow (not home).
12. GIVEN a device **with** a saved profile, WHEN the app opens, THEN it routes
    directly to home, skipping welcome, with no visible onboarding flash.

**Home (stub)**
13. GIVEN a saved profile, WHEN home is shown, THEN it displays the user's saved
    display name; no other feature content is required.

## Non-goals

- **No routine generation** — that is Feature B. Onboarding only captures the
  inputs B will later consume.
- **No edit-profile / settings screen** — data is collected once; changing it
  later is a separate future change.
- **No accounts, auth, login, or sync** — local-first; profile lives only on this
  device. "Returning user" means "this browser has a saved profile," nothing more.
- **Home is a stub** — it shows only the name. No routine, calendar, or workout
  entry points yet.
- **No multi-device or cross-browser continuity**, no data export/import.
- **No onboarding skip / guest mode** — the fields are the minimum Feature B
  needs; all required ones must be provided to finish.

## Priority

Smallest slice that delivers real value: the welcome screen + 3-step form +
persistence + first-run routing + name-on-home. Height (optional) and any visual
polish beyond the design system are the first cuts if scope tightens.

## Capabilities (→ specs/ deltas)

Each becomes one spec delta under `specs/` next:

1. **onboarding-welcome** — the welcome screen (app name, description, Start) and
   the entry into the setup flow.
2. **profile-setup-form** — the multi-step form: ≤2 inputs/step, step tracker,
   back, forward validation, the field set, finish.
3. **profile-persistence** — saving `Profile` + `Goals` to IndexedDB and reading
   them back (local-first, no network).
4. **first-run-routing** — profile-absent → welcome, profile-present → home,
   including the home name stub.
