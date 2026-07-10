# Proposal — routine-generation (Feature B: AI routine)

> Second real user feature. Delivers Feature B from the locked build order
> (A → **B** → D → C). Feature A left home a name-only stub; this change turns
> home into the product's core loop: describe your training in a prompt, watch
> the AI build a structured routine, and land on a routine dashboard you can
> start training from. The *how* (proxy streaming, Dexie store, seam wiring,
> home composition across two features) is the architect's `design.md`; this
> proposal owns *what & why* and the acceptance gate. The execution model
> (`Routine`/`RoutineDay`/`Exercise`/`SetPlan`), the AI response schema, the
> error taxonomy, and the `useRoutineGeneration` / `useActiveRoutine` seam
> signatures already exist as foundation stubs from `bootstrap-architecture`.

## Why

After onboarding, the app knows who the user is but does nothing with it. Home
greets them by name and stops — the whole reason the app exists (a routine to
follow, then guide) has no on-ramp. Feature A deliberately collected exactly the
inputs Feature B needs (goal, training days, bodyweight, units); nothing yet
turns those into a routine.

Our user is an intermediate gym-goer who values efficiency over hand-holding.
They don't want a form-driven routine builder — they want to say what they're
after in their own words and get a structured split back, fast. This change
gives them the single most valuable action in the product: **prompt → routine**,
delivered as a first-class AI experience (a real composer, a live sense that the
model is working, a summary of its thinking) rather than a spinner and a wait.
And because we are local-first, the routine it produces lives on their device
and is there the next time they open the app.

## Target user

The **intermediate gym-goer** (`config.yaml` locked persona). They can describe
their own training intent ("push/pull/legs, 5 days, chest priority") and want the
app to turn that into structure they can execute — not to be walked through
choosing every exercise.

## What changes

- **Home becomes a routine dashboard + AI composer.** The name-only stub is
  replaced by: an identity header (greeting name · a badge showing the user's
  goal · a short motivational line), the active routine's summary when one
  exists, and a persistent prompt composer pinned to the bottom.
- **A pro-grade prompt composer** at the bottom of home: multi-line, roomy,
  clearly the primary action — the look of a serious AI app, not a search box.
- **Generate a routine from a prompt.** Submitting sends the user's prompt *plus
  their saved profile/goals* to the AI backend (the existing stateless
  `/api/generate-routine` proxy), which returns a structured split.
- **A real in-flight experience.** While the model works, an animated building
  indicator sits between the identity header and the composer, and a live
  summary of the model's thinking streams in above the composer — so the wait
  reads as progress, not a hang.
- **A routine summary on home.** On success the routine appears as a per-day
  summary (day names, at-a-glance contents). Tapping a day navigates to workout
  mode (Feature D — an intentionally empty screen for now).
- **A motivational routine blurb.** The generated routine carries a short
  motivational subtitle (AI-authored), shown in the identity header — the "brief
  motivational description about the routine" tying the header to what was built.
- **One routine at a time, enforced.** Generating the *first* routine adopts it
  immediately. Generating again while a routine already exists requires an
  **explicit confirm** before the current routine is replaced — honoring the
  locked "no silent changes / regeneration needs confirmation" decision.
- **Local persistence for the routine.** The active routine is saved to
  IndexedDB and reloads with the app (new `routines` store + `routineRepo`).
- **A route to reach workout mode.** A thin app route so a tapped day opens the
  (empty) workout-mode screen.

The real OpenRouter call + streaming now land behind the proxy (today it is a
`501` shell), and the `useRoutineGeneration` / `useActiveRoutine` seams get their
real implementations behind the signatures the foundation already froze.

## Key decisions (needs approval)

These are the product calls that shape the specs — flagged for review rather than
buried in design:

1. **First generation adopts frictionlessly; replacement is guarded.** The very
   first routine is saved and shown the moment generation finishes — no extra
   "save" step (matches the described flow: finish → summary appears). Only when
   a routine *already exists* does a new generation ask the user to confirm
   before discarding the current one. This reconciles the frictionless flow with
   the locked "no silent changes" rule (which is fundamentally about not
   *replacing* existing work silently).
2. **The composer stays visible after a routine exists.** It is the standing way
   to regenerate; submitting with a routine present triggers the replace-confirm
   above. (Alternative — hide it once a routine exists — was rejected: it hides
   the product's main verb.)
3. **The motivational blurb is AI-authored, part of the routine payload.** It is
   generated with the split and persisted on the routine (a new optional field on
   the response schema + domain `Routine`), so it stays specific to *this*
   routine rather than a generic canned line. Before any routine exists, the
   header shows a neutral invite instead.
4. **The AI receives the saved profile/goals, not just the typed prompt.** Goal,
   training days, bodyweight, and units are folded into the request server-side
   so the split fits the user without them re-typing it.

## Capabilities

### New Capabilities

- `routine-generation`: submitting a prompt (with the saved profile/goals) to the
  AI backend to build a structured routine; the in-flight experience (animated
  building indicator + live thinking-summary); success, error, and offline
  outcomes. The generation *act*.
- `active-routine`: the single active routine as persisted local state — first
  success adopts it, a later generation replaces it only on explicit
  confirmation, it survives reload, and only one exists at a time.
- `home-routine-dashboard`: the home surface — identity header (name · goal badge
  · motivational blurb), the per-day routine summary when a routine exists, the
  neutral empty state when none does, and tapping a day to open workout mode.

### Modified Capabilities

None. `first-run-routing` (Feature A) still routes on profile presence and its
"home greets by name" requirement remains true — home simply gains content around
it, which the new `home-routine-dashboard` capability owns. No existing
requirement changes.

## Impact

- **New app route** to reach workout mode from a tapped day (e.g.
  `app/workout/…/page.tsx`), plus home composition wiring in `app/` that reads
  both the `profile-goals` and `routine-generation` barrels (cross-feature
  composition belongs at the app/route layer).
- **`shared/db`**: a new `routines` object store + a schema-version migration.
- **`modules/routine-generation`**:
  - `api/routineRepo.ts` — new Dexie repo (single-active invariant).
  - `logic/useActiveRoutine` + `logic/useRoutineGeneration` — real
    implementations behind the frozen foundation signatures; a Zustand store for
    in-flight generation state (status, streamed thinking, held result).
  - `api/ai/{prompt,schema,client}` — prompt now folds in profile/goals; schema
    gains the motivational subtitle field; client consumes the stream instead of
    a single response.
  - `ui/` — the composer, the building indicator, the thinking-summary, the
    identity header, and the per-day routine summary (feature-specific composites).
- **`app/api/generate-routine/route.ts`**: the real OpenRouter call — build the
  request from profile/goals + prompt, request structured JSON output, and stream
  the reasoning/thinking back. Stays stateless and firewalled (imports only
  `api/ai/{prompt,schema,errors}`; never `shared/db`, any `*Repo`, or
  `api/ai/client`). `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` remain server-env
  only.
- **`modules/profile-goals`**: consumed read-only via its barrel (`useProfile`
  for the greeting name + goal badge). No changes to Feature A.
- **Testing**: MSW handler for the streaming proxy; `fake-indexeddb` coverage for
  `routineRepo` and the single-active invariant; a Playwright pass over
  prompt → generating → summary → tap-day → workout mode.

## Non-goals

- **No routine editing.** The user cannot hand-tweak days/exercises/sets in this
  change — they regenerate. Manual editing is a later change.
- **No routine library / switching.** One active routine at a time (locked).
- **No workout-mode functionality.** Tapping a day only *navigates* to the
  (empty) Feature D screen; guiding, logging, and timers are Feature D's change.
- **No calendar / consistency.** Deriving a weekly target from the routine is
  Feature C.
- **No prompt history / multi-turn chat.** The composer is a single-shot
  generation input, not a conversation thread.
- **No streaming of the routine structure itself into the UI.** Only the model's
  *thinking summary* streams live; the structured routine is rendered once,
  validated, on completion.
- **No edit-profile entry point** from home.

## Priority

The smallest slice that delivers the core loop: composer → generate (with live
thinking) → routine adopted → per-day summary on home → tap-day opens workout
mode, persisted across reload. First cuts if scope tightens, in order: the live
thinking-summary streaming (degrade to the animated building indicator alone),
then the AI-authored motivational blurb (degrade to a neutral line). The
replace-confirm on regeneration and the one-routine invariant are **not**
cuttable — they protect user data.
