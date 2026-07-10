# Design — workout-mode (Feature D: the guided in-gym workout)

## Context

Feature B turned home into a routine dashboard: tapping a day pushes to
`app/workout/[dayId]/page.tsx`, which today renders an empty
`WorkoutModeScreen` (ComingSoon) and ignores `[dayId]`. `bootstrap-architecture`
pre-froze this feature as compiling stubs built around a **per-set** model:
`SetLog`, `WorkoutSession.currentSetIndex`, and two throwing seam hooks
(`useWorkoutSession(routineId)` returning `logSet`/`startRest`, and a
`useRestTimer()` with `skip`/`restart`/`exit`). None of that is consumed by real
code yet — `WorkoutModeBody` passes a `"placeholder"` routineId to a stub that
throws.

The product-owner's proposal **reverses the framing-v1 per-set decision**
(Key decision 1): workout mode now records **per-exercise aggregates** (one
weight, the plan's reps, total work + total rest time) with **no per-series
breakdown**, and resume granularity coarsens to **the exercise in progress**.
This design reshapes the frozen types and seams to that model, specifies the
single timestamp-based stopwatch state machine, the persistence + resume
mechanics, the previous-weight lookup, and the exact logic↔UI seam the engineer
and designer build against in parallel.

Constraints that shape everything below:

- **Local-first, zero network.** Every read/write is Dexie in the browser.
  Workout mode makes **no** network calls — the app's only network call remains
  routine-generation's AI proxy. No `app/api/**` route is touched by this change.
- **The timer is the heartbeat (design-system Principle 3, workout-timer spec).**
  Always the real number, never smoothed, and correct across tab backgrounding
  and page refresh. This forces a **timestamp-based** timer (persist anchors,
  derive from `Date.now()`), never tick-counting. It is a **not-cuttable**
  requirement (proposal priority).
- **Import firewall.** `workout-mode/ui` imports only its own `logic/` +
  `shared/ui`; the cross-feature read of the active routine happens in `logic/`
  via `routine-generation`'s barrel (rule 3); only `api/` touches `shared/db`
  (rule 1). The whole feature is browser-only — no server firewall surface.

## Goals / Non-Goals

**Goals**

- Reshape `types.ts` + the two `shared/db` row shapes from the per-set model to
  the per-exercise aggregate, keeping `CompletedSession` on the barrel (calendar
  depends on it).
- Specify the single stopwatch as a **timestamp-based state machine**
  (work → rest → overtime → next series; last series completes the exercise) that
  survives refresh exactly.
- Define the **one seam** (`useWorkoutSession`) the screen consumes for every
  behavior a–g, firewall-legal.
- Specify persistence + resume-at-exercise, the previous-weight lookup, and the
  `dayId` → screen routing.
- Update `config.yaml`'s now-stale per-set framing line.

**Non-Goals** (from the proposal — restated so the seam stays honest)

- No per-series logging, no PR charts/analytics, no routine editing mid-session,
  no calendar aggregation, no coaching/form cues/media/rep-counting, no
  skip/reorder, no partial "save & finish," no audio/haptic alerts. No network.

## Decisions

### D1 — Per-exercise aggregate data model (reshape `types.ts` + rows)

`SetLog` and the per-set cursor are removed. The unit of record becomes an
**`ExerciseLog`** aggregate. New `types.ts` surface:

```ts
export interface ExerciseLog {
  exerciseId: string;   // the routine's exercise id — the history key (D6)
  name: string;         // denormalized so history/calendar need no routine join
  series: number;       // completed series count (== plannedSeries on a full exercise)
  reps: number;         // the plan's representative reps (see note)
  weightKg: number;     // the single weight entered for this exercise (0 if unset)
  workSeconds: number;  // total work across all series
  restSeconds: number;  // total rest across all rests (last series has no trailing rest)
}

/** Stored phase. `overtime` is DERIVED, never stored (D3). */
export type SessionPhase = "work" | "rest" | "exercise-complete";

/** An in-progress session — one resumable per (routine, day) (D5). */
export interface WorkoutSession {
  id: string;              // `${routineId}:${dayId}`
  routineId: string;
  dayId: string;
  startedAt: number;
  defaultRestSeconds: number;
  exerciseLogs: ExerciseLog[];   // exercises already completed, in order
  // --- in-flight state of the CURRENT exercise ---
  currentExerciseIndex: number;
  enteredWeightKg: number | null;
  completedSeries: number;       // series finished within the current exercise
  accumWorkSeconds: number;      // work banked from completed series this exercise
  accumRestSeconds: number;      // rest banked from completed rests this exercise
  phase: SessionPhase;
  anchorTs: number;              // Date.now() at the current phase's start (D3/D4)
}

/** A finished session — what calendar (C) aggregates via the barrel. */
export interface CompletedSession {
  id: string;              // crypto.randomUUID() — one per completion (D5)
  routineId: string;
  dayId: string;           // NEW — lets calendar attribute a session to its day
  completedAt: number;     // indexed for calendar range queries
  exerciseLogs: ExerciseLog[];
  difficulty?: number;     // 1–5, optional (session-completion spec)
  fatigue?: number;        // 1–5, optional
}
```

**Representative reps.** A plan's sets can carry different reps (12/10/8). Since
we deliberately store no per-series breakdown, `ExerciseLog.reps` and the
displayed "planned reps" take `exercise.sets[0].reps`; the seam also exposes the
full `repsPerSet` array so the designer *can* show a range without it entering
the record. Accepted limitation: a varied-rep exercise stores only its first
figure — reference-only data we don't yet analyze (non-goal).

`plannedSeries = exercise.sets.length`.

- **Alternative — keep `SetLog[]` and aggregate at read time:** rejected. It
  re-introduces exactly the per-series record the PO removed, and calendar/history
  would carry data we've committed not to store.

### D2 — No Dexie version bump; only non-indexed row fields change

`shared/db/schema.ts` changes the **field lists** of `SessionRow` and
`CompletedSessionRow` to mirror D1 (drop `currentSetIndex`/`logs`; add the
in-flight fields, `exerciseLogs`, `dayId`, `difficulty?`, `fatigue?`), but leaves
the `version(1).stores({...})` string **byte-for-byte unchanged**:

```
sessions:          "id, routineId"
completedSessions: "id, completedAt, routineId"
```

IndexedDB stores arbitrary object shapes; only the **declared indexes** are part
of the schema. The reshaped fields are all non-indexed, and every field we still
index (`id`, `routineId`, `completedAt`) survives — so the new shape is legal
under v1 with **no `version(2)` and no migration**. Independently, both stores
are **empty on every device** (Feature D has never written a row), so there is no
existing data to migrate regardless. This is the cleanest possible reshape: a
type + repo change, invisible to Dexie's versioning.

`shared/db` still declares row types itself (dependency-leaf rule); `sessionRepo`
maps `unknown[]` fields (`exerciseLogs`) to domain types, exactly as
`routineRepo` maps `days`.

- **Alternative — bump to `version(2)` for cleanliness:** unnecessary and slightly
  worse; it implies a migration where none exists and invites the reader to look
  for upgrade logic that isn't there. We bump only when an **index** changes.
- **Alternative — index `sessions` by `dayId`:** not needed; resume does a keyed
  `get` on the composite id (D5), so no secondary lookup exists to index.

### D3 — One timestamp-based stopwatch state machine

A single control (`tap`) drives one exercise's series. **Stored phases** are
`work | rest | exercise-complete`; the seam surfaces a fourth, **`overtime`**,
which is *derived* from a `rest` phase whose time has run out — so it needs no
stored transition and no timer to "fire."

```
          start / next series
                 │
                 ▼
   ┌──────────────────────────┐   tap (not last series)   ┌───────────────┐
   │  WORK  (counts up)       │ ────────────────────────▶ │ REST (down)   │
   │  display = ⌊(now−a)/1s⌋   │                           │ rem = R−⌊…⌋   │
   └──────────────────────────┘                           └──────┬────────┘
          │ tap (LAST series)                       rem ≤ 0 │     │ tap
          ▼                                    (derived,    ▼     │
   ┌──────────────────────────┐  no write) ┌───────────┐   │     │
   │ exercise-complete        │            │ OVERTIME  │───┘     │
   │  (append ExerciseLog;    │            │ "time's up"│         │
   │   no trailing rest)      │            └───────────┘         │
   └──────────┬───────────────┘                  └──────────────┘
              │ nextExercise()  (more exercises)      → WORK (next series)
              │ finish          (last exercise)
              ▼
        write CompletedSession → status 'success'
```

`a = anchorTs`, `R = defaultRestSeconds`, `now = Date.now()`. Derivation:

- **work:** `displaySeconds = floor((now − a)/1000)`, counting up from 0.
- **rest:** `remaining = R − floor((now − a)/1000)`; if `remaining > 0` → phase
  `rest`, `displaySeconds = remaining`; if `remaining ≤ 0` → phase `overtime`,
  `displaySeconds = 0`, `overtimeSeconds = −remaining`.

**What `tap()` does per phase:**

| phase        | action |
|--------------|--------|
| `work`       | `banked = floor((now−a)/1000)`; `accumWorkSeconds += banked`; `completedSeries += 1`. If `completedSeries < plannedSeries` → `phase='rest'`, `anchorTs=now`. Else the exercise is done: append `ExerciseLog` (weight = `enteredWeightKg ?? 0`), and either → `exercise-complete` (more exercises) or **finish** (last exercise, D5/D10). |
| `rest`/`overtime` | `banked = floor((now−a)/1000)`; `accumRestSeconds += banked`; `phase='work'`, `anchorTs=now` (next series). |
| `exercise-complete` | `tap` is inert; advance is the separate `nextExercise()` control (exercise-execution spec). |

Every `tap` (and `start`, `setWeightKg`, `nextExercise`) writes the session row
(D4). **REST→OVERTIME writes nothing** — it's the same `rest` row read later.

**Where the ticking lives.** The **persisted + hot truth is tick-free**: the
Zustand store in `logic/` holds `{phase, anchorTs, …}` and mutates only on
transitions. A **display-only** interval in the seam hook (`setInterval` ~250ms,
cleared on unmount / when phase is `exercise-complete`) bumps a local `nowTick`
to re-render; all shown seconds are recomputed from `anchorTs + Date.now()` in
render. So the number is always the real wall-clock value, never an accumulated
count — it cannot drift while backgrounded, and a coarse interval only affects
*redraw cadence*, never correctness (design-system: the ring fill is data, the
digits are exact).

- **Alternative — tick a counter in the store every second:** rejected outright.
  Backgrounded tabs throttle timers, so a counted value drifts — the exact
  failure the heartbeat requirement forbids.

### D4 — Persist-on-transition + exact restore *is* resume

Because the persisted state carries `anchorTs` and elapsed is always derived from
the wall clock, **restoring the row verbatim on mount reproduces the exact live
state** — including a mid-rest countdown or an overtime that elapsed while the
tab was closed (`remaining ≤ 0` → overtime). This single mechanism satisfies
*both* the workout-timer "survives refresh/backgrounding, exact remaining time"
requirement **and** session-tracking's resume-at-exercise, so there is nothing to
reconcile and nothing to reset.

This is a deliberate divergence from the "reset the in-flight accumulators on
resume" simplification floated in the brief: resetting would (a) discard logged
work/rest time and corrupt the aggregate, and (b) **violate** the not-cuttable
"refresh during rest resumes the correct remaining time" scenario. Timestamp
persistence makes exact resume *free*, so we keep it.

"Resume at the exercise, not at an exact set" (PO Key decision 1) is honored in
the **shape of the record**, not by throwing timer state away: there is no
`setIndex` and no per-set log to restore; resume is expressed as
`currentExerciseIndex` + `completedSeries` + banked accumulators + the entered
weight + the live `phase/anchorTs`. The user lands back in the same exercise with
their series progress and weight intact.

**Work-anchor reset on resume (the one exception to verbatim restore).** Restoring
a `work` anchor verbatim is wrong: `work` counts *up* with no ceiling, so a tab
closed mid-set for an hour would reopen with ~3600s of "work" that then banks into
`workSeconds` on the next tap — corrupting the permanent aggregate and making the
"exact" claim read false for work. Policy: **on hydrate, if the persisted
`phase === "work"`, set `anchorTs = Date.now()`** (and persist the corrected row)
before serving the store. Nothing logged is lost — the in-flight series' work is
never banked until the ending tap, and all *already-banked* series
(`accumWorkSeconds`, `completedSeries`) are untouched; only the current series'
stopwatch restarts from 0. `rest`/`overtime` anchors are restored **verbatim** —
their exactness across refresh/background is the workout-timer requirement and a
countdown is naturally bounded (elapsing past zero is the correct `overtime`, not
inflation).

- **Trade-off vs. the old per-set resume:** we can no longer reconstruct
  individual sets (we don't store them). We gain a far simpler record and *keep*
  the timer exact. This is the trade the PO chose.

### D5 — In-progress session keyed by `${routineId}:${dayId}`; completed by UUID

The in-progress `WorkoutSession.id` is the composite `${routineId}:${dayId}`, so
there is **at most one resumable session per day** and finding it on mount is a
keyed `sessionRepo.getInProgress(routineId, dayId)` → `db.sessions.get(id)` — no
query, no secondary index. Each day of the routine is independently resumable
(start Push, leave, start Pull — both resume correctly).

A **completed** session is a distinct historical record, so
`CompletedSession.id = crypto.randomUUID()` (the established id pattern) — many
completions of the same day accumulate as history. The composite in-progress id
and the UUID completed id are intentionally different id spaces.

**Finish sequence** (final tap of the last exercise) is ordered for durability
(session-completion spec — the workout must survive a closed tab *before* ratings):

1. `saveCompleted(completedSession)` — the record is now safe.
2. `clearInProgress(routineId, dayId)` — delete the resumable row.
3. store the returned completed id in the hot store; `status = 'success'`.

Ratings arrive later via `submitRatings` → `sessionRepo.updateRatings(id, …)`
targeting that stored id. Leaving without rating leaves the record complete.

### D6 — Previous-weight lookup: match by `exerciseId`

`sessionRepo.getPreviousWeight(exerciseId)` walks `completedSessions` ordered by
`completedAt` **descending** (the existing index) and returns the `weightKg` of
the first `ExerciseLog` whose `exerciseId` matches **and whose `weightKg > 0`**;
**`null`** when no such log exists (first-time-ever → no reference shown). The
`weightKg > 0` filter treats a `0` (the unset/bodyweight sentinel from D1/D3) as
"no weight recorded," so history never surfaces a misleading "previous 0 kg". The
hook re-runs this whenever `currentExerciseIndex` changes.

Matching on **id** (not name) is exact and false-positive-free *within a
routine's lifetime* — which is the dominant case: the user keeps one routine for
weeks and every session shares the same exercise ids. **Caveat:** exercise ids
are minted per routine, so **regenerating the routine (Feature B) invalidates all
previous-weight history** — new ids match nothing. This is acceptable for MVP:
the previous-weight reference is explicitly the *first* feature to cut under
scope pressure (proposal priority), and regeneration is occasional versus the
per-week same-routine cadence.

- **Alternative — match by normalized name:** survives regeneration but is
  fragile ("Bench Press" vs "Barbell Bench Press" vs a genuinely different
  same-named lift). Rejected for MVP; noted as the natural future enhancement
  (prefer-id-then-name) in Open Questions.

### D7 — Default rest prefills from the day's most common `restSeconds`

The overview's editable default rest is seeded by a pure helper in
`logic/model.ts`: the **mode** of every `SetPlan.restSeconds` across the day's
exercises (ties → the smaller value), falling back to a constant (`90`) if the
plan carries no rest. Mode is more representative of "the routine's prescribed
rest for the day" than an arbitrary first value when most sets agree and one
exercise differs. The edited value is stored on the session and used for **every**
rest countdown (no per-series override — non-goal).

- **Alternative — first exercise's first set:** simpler but skewed by an outlier
  opening exercise; mode is one small reducer and reads truer.

### D8 — State-driven flow within the one route; `dayId` via async params

`app/workout/[dayId]/page.tsx` is a server component; in Next 15 `params` is a
Promise, so it `await`s it and passes the string down:
`<WorkoutModeScreen dayId={dayId} />` → `WorkoutModeBody` → `useWorkoutSession(dayId)`.
The hook resolves the active routine itself (D9), so the screen never needs a
`routineId`.

The three phases of the flow — **overview → in-progress → success** — are one
**state-driven** screen keyed off `status`, **not** sub-routes. Rationale: it is
one continuous flow over one shared hot store; intermediate states have no
meaningful URL, resume already reconstructs position from Dexie, and a single
route keeps the store's lifetime aligned with the page. The back-home control
navigates by `router.push('/')` / `next/link` in the UI.

- **Alternative — nested routes (`/workout/[dayId]/exercise`, `/success`):**
  rejected; it fragments the hot store across route remounts and buys nothing —
  there is no deep-link or refresh-to-step requirement that resume doesn't already
  cover.

### D9 — Reshaped seams: `useWorkoutSession` is the single seam; `useRestTimer` is superseded

The frozen per-set seams don't fit the aggregate model and are not yet consumed,
so both are reshaped. The screen consumes **one** seam,
`useWorkoutSession(dayId)`, which internally calls `useActiveRoutine()` (from
`routine-generation`'s barrel), selects the day, owns the Zustand store + the
display tick, and drives `sessionRepo`. The whole stopwatch is exposed as a
`timer` view-model on that one API (full contract below).

`useRestTimer` / `RestTimer` are **removed from the barrel** — the timer is no
longer a standalone concept but one facet of the unified stopwatch, and nothing
consumes the old hook. The internal display-tick logic lives in a private
`logic/useTimerTick` helper that `useWorkoutSession` composes; it is not public.

**New barrel surface** (`modules/workout-mode/index.ts`):

```ts
export { useWorkoutSession } from "./logic/useWorkoutSession";
export type { WorkoutSessionApi, SessionStatus, TimerView, TimerPhase,
              CurrentExerciseView, OverviewExercise } from "./logic/useWorkoutSession";
export type { CompletedSession, ExerciseLog, WorkoutSession, SessionPhase } from "./types";
```

`CompletedSession` stays exported (calendar reads it); `SetLog`, `WorkoutStatus`,
`useRestTimer`, `RestTimer` are gone.

### D10 — Completion writes before ratings; ratings are optional enrichment

Covered by D5's finish sequence: the `CompletedSession` is durable the instant
the final exercise's work tap lands, *before* the success view renders. The two
1–5 ratings are an `update` on that record and are never required to leave. The
back-home control is always enabled. (session-completion spec.)

### D11 — Weight units: canonical kg in the record, display unit at the seam

The profile carries `unit: "metric" | "imperial"`, and welcome-view **locked**
that units govern how weight is entered and shown everywhere downstream. The seam
rule ("`ui/` never sees Dexie or another feature") means the designer **cannot**
read the profile unit itself — a cross-feature UI import is firewall-illegal. So
the unit conversion is the seam's job, not the UI's.

- **Canonical storage stays kg.** `ExerciseLog.weightKg`, the persisted
  `enteredWeightKg`, and the previous-weight lookup are all kg — one unit in the
  record forever, so history compares cleanly and a later unit toggle never
  rewrites stored data.
- **The seam exposes display-unit values + the unit.** `logic/useWorkoutSession`
  reads `useProfile()` from the **profile-goals barrel** (legal from `logic/`) and
  converts at the boundary in `logic/model.ts`. The API's weight fields are in the
  user's **display unit** (not kg): the designer renders `weight` /
  `previousWeight` and calls `setWeight` with the number the user typed, never
  doing math. The `unit` (`MeasurementUnit`, re-exported through the barrel) is
  exposed only so the UI can render the label ("kg" / "lb"), never to convert.
- **Conversion.** `1 kg = 2.2046226 lb`. `setWeight(displayValue)` stores
  `imperial ? displayValue / 2.2046226 : displayValue` as canonical kg;
  `weight`/`previousWeight` convert kg → display and round to a `0.5` step. The
  sub-`0.5` round-trip drift is below any real plate increment and is acceptable
  (we optimize for a stable record, not a lossless echo). When the profile is
  still loading or absent, the seam defaults to `metric`/kg.

This is why the seam's weight fields are named unit-neutral (`weight`,
`setWeight`, `previousWeight`) rather than `*Kg`: the `Kg` suffix survives only in
the domain/record types, where the value really is kg.

- **Alternative — keep `*Kg` on the seam and let the UI convert via `unit`:**
  rejected. It pushes unit math into the designer's components, duplicates the
  conversion at every weight surface, and invites the imperial-user-types-225-→-
  stored-as-225-kg bug the review flagged. The seam is the right place to own it.

## Logic↔UI seam contract

The **one interface** the software-engineer implements in `logic/` and the
frontend-dev-designer consumes in `ui/`. The screen imports **only** this hook +
`shared/ui`; it never sees Dexie, `routine-generation`, or timestamps.

```ts
// modules/workout-mode/logic/useWorkoutSession.ts   ('use client')
import type { MeasurementUnit } from "@/modules/profile-goals"; // barrel, legal from logic/

export type SessionStatus =
  | "loading"      // resolving active routine + any resumable session
  | "no-routine"   // dayId not in the active routine, or no active routine
  | "overview"     // pre-start: exercise list + editable default rest + Start
  | "in-progress"  // working exercises
  | "success";     // final exercise done; ratings + back-home

export type TimerPhase = "work" | "rest" | "overtime" | "exercise-complete";

export interface OverviewExercise {   // (a) the day's plan, for the overview list
  id: string;
  name: string;
  plannedSeries: number;
  plannedReps: number;        // representative (sets[0].reps)
}

export interface CurrentExerciseView {   // (b) the current exercise + plan
  id: string;
  name: string;
  index: number;              // 0-based position in the day
  total: number;              // exercises in the day
  plannedSeries: number;
  plannedReps: number;
  repsPerSet: number[];       // full plan, for a "8–12" style display; not recorded
  isLast: boolean;            // last exercise of the day
}

export interface TimerView {   // (e) everything the stopwatch renders
  phase: TimerPhase;          // includes derived 'overtime'
  displaySeconds: number;     // work: elapsed↑ · rest: remaining↓ · overtime: 0 · complete: 0
  restTotalSeconds: number;   // for the ring fill fraction (= defaultRestSeconds)
  overtimeSeconds: number;    // >0 only in overtime
  currentSeries: number;      // 1-based
  plannedSeries: number;
}

export interface WorkoutSessionApi {
  status: SessionStatus;
  dayName: string;

  // --- overview ---
  exercises: OverviewExercise[];                 // (a)
  defaultRestSeconds: number;                    // seeded per D7
  setDefaultRestSeconds: (seconds: number) => void;
  start: () => Promise<void>;                    // → status 'in-progress', first exercise WORK

  // --- in-progress ---
  currentExercise: CurrentExerciseView | null;   // (b)
  unit: MeasurementUnit;                         // (c) "metric"|"imperial" — for the "kg"/"lb" label only
  weight: number | null;                         // (c) entered weight in DISPLAY unit, once per exercise
  setWeight: (value: number | null) => void;     // (c) value in display unit; converted to kg in logic (D11)
  previousWeight: number | null;                 // (d) last session's weight for this exercise in display unit, or null
  timer: TimerView;                              // (e)
  tap: () => Promise<void>;                       // (e) the single stopwatch action
  nextExercise: () => Promise<void>;             // (f) advance after 'exercise-complete'

  // --- completion ---
  submitRatings: (r: { difficulty?: number; fatigue?: number }) => Promise<void>;  // (g)
}

export function useWorkoutSession(dayId: string): WorkoutSessionApi;
```

Notes for the two builders:

- **UI reads `status` to pick the view** (overview / exercise / success /
  no-routine / a skeleton on loading). It never branches on timestamps or phase
  beyond `timer.phase`.
- **The stopwatch is `tap` + `timer`.** During `work`/`rest`/`overtime` the CTA
  is `tap`; when `timer.phase === 'exercise-complete'` the UI shows **Next
  exercise** (`nextExercise`) — unless `currentExercise.isLast`, in which case the
  final tap has already moved `status` to `'success'` (no exercise-complete
  screen for the last exercise).
- **Weight** is a single field per exercise, in the user's **display unit**
  (`unit`); the seam converts to canonical kg internally (D11). `previousWeight`
  is display-only reference. Unset weight records as `0` kg.
- **`no-routine`** renders the empty-state (design-system: one sentence + a way
  back), never a broken screen (session-overview spec).

### Module layout (all inside `modules/workout-mode`, firewall-legal)

```
ui/        WorkoutModeScreen(dayId) · WorkoutModeBody · SessionOverview ·
           ExerciseView · Stopwatch · SuccessView    ← import only ../logic + shared/ui
logic/     useWorkoutSession.ts (the seam) · store.ts (Zustand hot state) ·
           useTimerTick.ts (private display interval) · model.ts (pure: defaultRest
           mode, plan→view mappers, tap reducer, kg↔display conversion D11)
                                                       ← imports ../api + routine-generation
                                                         & profile-goals barrels (unit, D11)
api/       sessionRepo.ts                             ← imports @/shared/db + ../types only
types.ts   ExerciseLog · WorkoutSession · CompletedSession · SessionPhase
index.ts   the barrel (D9)
```

`sessionRepo` methods:

```ts
getInProgress(routineId: string, dayId: string): Promise<WorkoutSession | null>;
saveInProgress(session: WorkoutSession): Promise<void>;            // put (per-transition)
clearInProgress(routineId: string, dayId: string): Promise<void>;  // delete on finish
saveCompleted(session: CompletedSession): Promise<void>;           // put
updateRatings(id: string, r: { difficulty?: number; fatigue?: number }): Promise<void>;
getPreviousWeight(exerciseId: string): Promise<number | null>;     // kg; completedAt desc scan, skips weightKg<=0 (D6)
```

## Risks / Trade-offs

- **Backgrounded-timer drift** → derive every displayed value from
  `anchorTs + Date.now()`, never a counter; persist the anchor on each
  transition. Test: fake timers advancing wall-clock across a simulated
  background + a re-hydrate from a persisted row (fake-indexeddb).
- **Write frequency** → we persist on every transition (each tap), not every
  tick, so a set is ~2 writes; volume is trivial and keyed puts are cheap. No
  debounce needed except `setWeightKg`, which may coalesce (persist on change is
  still fine at this scale).
- **Regeneration nukes previous-weight history** (D6) → accepted for MVP;
  documented; name-fallback is the future path. It degrades gracefully to "no
  reference," which is also the designated first scope cut.
- **Varied per-set reps flattened to one figure** (D1) → reference-only data,
  not analyzed yet; the seam still exposes `repsPerSet` for display so nothing is
  hidden from the user, only from the record.
- **Reshaping frozen seams** could ripple to consumers → the only consumer is
  `WorkoutModeBody` (a placeholder) and the barrel; calendar (C) isn't built.
  `CompletedSession` stays exported, so the sole cross-feature contract holds.
- **Two id spaces** (composite in-progress vs UUID completed) → a deliberate,
  documented split; the finish sequence (D5) is the only place they meet, and it
  writes the completed record *before* clearing the in-progress one, so a crash
  between steps loses at most the resumable row, never the finished workout.

## Migration Plan

Additive and migration-free. `shared/db` keeps `version(1)` untouched (D2); only
non-indexed row *fields* change, and both stores are empty on every device.
Rollback = revert the change; nothing durable was reshaped. The
`config.yaml` framing line is updated (below) to match the shipped behavior.

**`config.yaml` edit made by this change.** The framing-v1 line —
*"Workout mode logs actual weight + reps + rest per set; rest timer has
skip/exit + restart; sessions resume at the exact set after interruption."* — is
now false. It is revised to the per-exercise aggregate + single-stopwatch +
resume-at-exercise reality this change establishes, with a note that it
supersedes framing-v1 (PO Key decision 1). Every agent inherits the corrected
framing.

## Open Questions

- **Previous-weight after regeneration** — ship id-only match (D6); revisit a
  prefer-id-then-normalized-name match if users report losing references across
  regenerations. Only `sessionRepo.getPreviousWeight` changes.
- **Overtime display ceiling** — how long overtime counts up before it's just
  "over" is a design-system call; the seam exposes `overtimeSeconds` and lets the
  designer decide the visual treatment (spec fixes only the state + prompt).
- **Display tick cadence** — 250ms is a starting point that keeps digits smooth
  without waste; the designer may align redraws to whole-second boundaries. Purely
  a redraw concern — correctness is anchor-derived either way.
- **Orphaned in-progress row after mid-session regeneration** — an in-progress
  row keyed `${routineId}:${dayId}` is stranded if the routine is regenerated
  (new routine id + day ids) while a session is unfinished. On resume the new
  `dayId` finds no row → clean overview, and the stale row is harmless (never
  read again). If it should be actively swept, `sessionRepo` can delete any
  session whose `routineId` differs from the active routine on mount — deferred
  as low-value housekeeping, not a correctness issue.
</content>
</invoke>
