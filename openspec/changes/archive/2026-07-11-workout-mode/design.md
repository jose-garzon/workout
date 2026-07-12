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

> **REVISION — 2026-07-11 (D1 reopened; per-set logging restored).** The PO has
> **reversed the per-exercise-aggregate decision**: workout mode now records
> **per-series** data again. On each completed set (the `work`→`rest` tap) the
> app banks that set's **elapsed work time**, the **weight** used, the plan's
> **reps** for that set, and the **volume (`weightKg × reps`)**. `ExerciseLog`
> becomes a `series: SeriesLog[]` array; `restSeconds` stays an exercise-level
> aggregate (rest is between sets, not a property of one — see revised D1). Only
> D1, D3, D6, D9, the seam contract, and the derived-stats notes move; the
> timestamp stopwatch (D3), persistence/resume mechanics (D4/D5), tap-to-start
> (D12), and the single-`tap` control are **unchanged in shape** — the reducer
> just pushes a `SeriesLog` where it used to bump scalar accumulators. A
> pleasant consequence: varied per-set reps (12/10/8) are now recorded exactly,
> retiring the D1 "representative reps" flattening.

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

- Shape `types.ts` + the two `shared/db` row shapes to the **per-series** model
  (revised D1): `ExerciseLog.series: SeriesLog[]` with `{ reps, weightKg,
  workSeconds, volumeKg }` per set, plus an exercise-level `restSeconds`
  aggregate — keeping `CompletedSession` on the barrel (calendar depends on it).
- Specify the single stopwatch as a **timestamp-based state machine**
  (work → rest → overtime → next series; last series completes the exercise) that
  survives refresh exactly.
- Define the **one seam** (`useWorkoutSession`) the screen consumes for every
  behavior a–g, firewall-legal.
- Specify persistence + resume-at-exercise, the previous-weight lookup, and the
  `dayId` → screen routing.
- Update `config.yaml`'s now-stale per-set framing line.

**Non-Goals** (from the proposal — restated so the seam stays honest)

- No PR charts/analytics, no routine editing mid-session, no calendar
  aggregation, no coaching/form cues/media, no **actual** rep-counting (a set's
  logged reps = the *plan's* reps for that set index; we never count what the
  user did), no per-series **rest** override (one default rest for the day), no
  skip/reorder, no partial "save & finish," no audio/haptic alerts. No network.
  (Per-series **logging** was a non-goal under the original D1; the 2026-07-11
  revision restores it — see the banner above.)

## Decisions

### D1 — Per-series data model (REVISED 2026-07-11) — reshape `types.ts` + rows

**Revised.** The original D1 stored one `ExerciseLog` aggregate per exercise
(single `weightKg`, one `reps`, total `workSeconds`/`restSeconds`) and cut
per-set logging as a non-goal. **The PO has reversed that decision:** every set
is now recorded. The unit of record is a **`SeriesLog`** captured when a set's
work ends; an **`ExerciseLog`** collects a set's worth into a `series` array plus
the exercise's aggregate rest. New `types.ts` surface:

```ts
/** One completed set — captured on the work→rest (or work→complete) tap (D3). */
export interface SeriesLog {
  reps: number;         // the PLAN's reps for this set index (sets[i].reps) — not counted
  weightKg: number;     // the weight used for THIS set, canonical kg (0 if unset)
  workSeconds: number;  // elapsed work time of this set (from anchorTs → tap)
  volumeKg: number;     // = weightKg × reps (kg·reps); the headline per-set number
}

export interface ExerciseLog {
  exerciseId: string;   // the routine's exercise id — the history key (D6)
  name: string;         // denormalized so history/calendar need no routine join
  series: SeriesLog[];  // one entry per completed set, in order — the record
  restSeconds: number;  // TOTAL rest across the exercise's inter-set rests (aggregate)
}

/** Stored phase. `overtime` is DERIVED, never stored (D3); `ready` = armed/idle (D12). */
export type SessionPhase = "ready" | "work" | "rest" | "exercise-complete";

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
  enteredWeightKg: number | null; // current set's weight; carries over per set (D12)
  currentSeries: SeriesLog[];     // sets already completed within THIS exercise
  accumRestSeconds: number;       // rest banked from completed inter-set rests this exercise
  phase: SessionPhase;
  anchorTs: number;              // Date.now() at the current phase's start (D3/D4)
}

/** A finished session — what calendar (C) aggregates via the barrel. */
export interface CompletedSession {
  id: string;              // crypto.randomUUID() — one per completion (D5)
  routineId: string;
  dayId: string;           // lets calendar attribute a session to its day
  completedAt: number;     // indexed for calendar range queries
  exerciseLogs: ExerciseLog[];
  difficulty?: number;     // 1–5, optional (session-completion spec)
  fatigue?: number;        // 1–5, optional
}
```

**What changed vs. the old aggregate** (for the software-engineer):

- `ExerciseLog.series: number` (a count) → `series: SeriesLog[]` (the records).
  The count is now `series.length`.
- The old top-level `reps` / `weightKg` / `workSeconds` scalars are **removed
  from the record** — they now live per set inside `SeriesLog`. No denormalized
  exercise total is stored: a stored total would be a second copy that can drift
  from the array. Readers derive totals with pure helpers in `logic/model.ts`:
  `exerciseVolumeKg(log) = Σ series.volumeKg`, `exerciseWorkSeconds(log) =
  Σ series.workSeconds`, `seriesCount(log) = series.length`.
- `restSeconds` **stays an exercise-level aggregate** (see the rejected
  per-series-rest alternative below).
- In-flight state: `completedSeries: number` + `accumWorkSeconds: number` →
  a single `currentSeries: SeriesLog[]` (completed count = `.length`; per-set
  work already lives in each entry, so no running work scalar is needed).
  `accumRestSeconds` is retained (it feeds `ExerciseLog.restSeconds`).

**Reps are the plan's, per set — no flattening, no counting.** A set at index `i`
records `exercise.sets[i].reps` (so 12/10/8 is stored exactly — the old
"representative `sets[0].reps`" flattening is gone). We do **not** count what the
user actually performed (non-goal: no rep-counting), so `reps` and therefore
`volumeKg` are *planned-load* figures, not measured ones. This is the honest
scope: we record the prescribed work the user committed to, at the weight they
entered. `plannedSeries = exercise.sets.length`.

- **Alternative — per-series `restSeconds` on each `SeriesLog`:** rejected for
  MVP. Rest is the *gap between* sets, not a property of a set; the last set has
  no trailing rest (a per-set field would be a permanent `0` sentinel there), and
  banking it would force the rest→ready tap to back-patch the previously pushed
  `SeriesLog`. The aggregate keeps the reducer's two banking sites clean (work
  tap pushes a `SeriesLog`; rest tap adds to a scalar). Per-set rest is the
  natural future extension if density/rest analytics are ever wanted — noted in
  Open Questions.
- **Alternative — keep the aggregate + also store a `series[]`:** rejected as
  redundant denormalization; the array is the source of truth and totals derive
  in O(sets) — trivial at gym scale.

### D2 — No Dexie version bump; only non-indexed row fields change

`shared/db/schema.ts` changes only the **non-indexed field lists** of
`SessionRow` and `CompletedSessionRow`. For the 2026-07-11 per-series revision:
`SessionRow` replaces `completedSeries` + `accumWorkSeconds` with
`currentSeries: unknown[]` (a `SeriesLog[]`, stored opaquely like `exerciseLogs`)
and keeps `accumRestSeconds`; the shape *inside* `exerciseLogs`
(`ExerciseLog.series[]` instead of scalar fields) is invisible to Dexie since
`exerciseLogs` was already an opaque `unknown[]`. `CompletedSessionRow` is
untouched at the row level (`exerciseLogs: unknown[]` unchanged). The
`version(1).stores({...})` string stays **byte-for-byte unchanged**:

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
| `work`       | `banked = floor((now−a)/1000)`; `i = currentSeries.length` (the set just finished); **push a `SeriesLog`**: `{ reps: sets[i].reps, weightKg: enteredWeightKg ?? 0, workSeconds: banked, volumeKg: (enteredWeightKg ?? 0) × sets[i].reps }` onto `currentSeries`. If `currentSeries.length < plannedSeries` → `phase='rest'`, `anchorTs=now`. Else the exercise is done: append `ExerciseLog` (`series: currentSeries`, `restSeconds: accumRestSeconds`), then → `exercise-complete` (more exercises) or **finish** (last exercise, D5/D10). |
| `rest`/`overtime` | `banked = floor((now−a)/1000)`; `accumRestSeconds += banked`; `phase='ready'`, `anchorTs=now` (next series is armed, not auto-running — D12). |
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
exotic reconstruction to do; resume is expressed as `currentExerciseIndex` +
`currentSeries` (the sets already logged this exercise) + `accumRestSeconds` +
the entered weight + the live `phase/anchorTs`. The user lands back in the same
exercise, on the same set, with their per-set progress and weight intact.
(Post-revision this granularity is finer than "the exercise" — the completed
`SeriesLog[]` restores verbatim — but it costs nothing extra: it is the same
row read back.)

**Work-anchor reset on resume (the one exception to verbatim restore).** Restoring
a `work` anchor verbatim is wrong: `work` counts *up* with no ceiling, so a tab
closed mid-set for an hour would reopen with ~3600s of "work" that then lands in
the next `SeriesLog.workSeconds` on the ending tap — corrupting a permanent
record and making the "exact" claim read false for work. Policy: **on hydrate, if
the persisted `phase === "work"`, set `anchorTs = Date.now()`** (and persist the
corrected row) before serving the store. Nothing logged is lost — the in-flight
set's work is never pushed to `currentSeries` until the ending tap, and every
*already-recorded* set in `currentSeries` (and `accumRestSeconds`) is untouched;
only the current set's stopwatch restarts from 0. `rest`/`overtime` anchors are restored **verbatim** —
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
`completedAt` **descending** (the existing index). For the first `ExerciseLog`
whose `exerciseId` matches, it returns the `weightKg` of that log's **last
`SeriesLog` with `weightKg > 0`** (post-revision an exercise no longer has one
top-level weight — sets can differ; the last real set is "what you finished on,"
the most useful progression reference). If that log has no positive-weight set it
keeps scanning older sessions; **`null`** when none exists ever (first-time → no
reference shown). The `weightKg > 0` filter treats a `0` (the unset/bodyweight
sentinel) as "no weight recorded," so history never surfaces a misleading
"previous 0 kg". The hook re-runs this whenever `currentExerciseIndex` changes.

- **Alternative — first-set or max-across-sets weight:** first-set is the most
  directly comparable to the set-1 weight the user is about to enter, and max is
  the heaviest handled; both are defensible. Last-set is chosen because it is
  unambiguous, matches "the last thing you lifted on this," and is unaffected by
  a warmup-lighter opening set. Cheap to revisit — a one-line change in the repo.

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
              CurrentExerciseView, OverviewExercise, SeriesView } from "./logic/useWorkoutSession";
export type { CompletedSession, ExerciseLog, SeriesLog, WorkoutSession, SessionPhase } from "./types";
```

`CompletedSession` stays exported (calendar reads it, and can now sum
`series.volumeKg` for a session-volume stat); `SeriesLog` (domain) + `SeriesView`
(display-unit view-model) are the new per-series exports. `SetLog`,
`WorkoutStatus`, `useRestTimer`, `RestTimer` are gone.

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

- **Canonical storage stays kg.** `SeriesLog.weightKg`/`volumeKg`, the persisted
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

### D12 — Tap-to-start (`ready` phase) + weight required per set (post-apply refinement)

User feedback after the first build: the clock should NOT auto-run after Start /
Next exercise — the user taps the stopwatch to start each set — and the weight
field must be filled before a set can begin. Adjustments:

- **New `ready` phase** (stored `SessionPhase` + surfaced `TimerPhase`): a series
  is armed but the clock is idle (`displaySeconds` = 0). It is the phase after
  `start()`, after `nextExercise()`, and after every rest/overtime tap. A series
  cycle is now **ready → (tap) → work → (tap) → rest → (tap) → ready(next set)…**;
  the last set: ready → tap → work → tap → complete/finish. This supersedes D3's
  work-on-entry: the reducer's rest/overtime branch and `advanceExercise` now land
  in `ready`, and `initialSession` starts in `ready`.
- **`tap()` in `ready` starts the work clock only if a weight is entered**
  (`enteredWeightKg !== null`); otherwise it is a no-op. The seam exposes
  **`canStartSet: boolean`** (`= phase === 'ready' && weight !== null`) so the UI
  can gate/label the control. Weight carries over within an exercise (a new set
  starts pre-filled with the prior set's weight, editable); `advanceExercise`
  clears it so each exercise's first set is entered fresh.
- **Per-set weight is recorded (revised D1, 2026-07-11).** Weight carries over
  between sets for convenience, but each set now banks *its own* `weightKg` into
  its `SeriesLog` on the work tap — so an edited mid-exercise weight is captured
  per set, not collapsed to one figure. (This bullet supersedes the original
  "storage unchanged / per-set weights not stored" note.)
- **Resume:** `ready` needs no anchor (clock idle); `work` still resets `anchorTs`
  on rehydrate (D4); rest/overtime restore verbatim.

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

export type TimerPhase =
  | "ready" // armed, tap-to-start, clock idle (§D12)
  | "work"
  | "rest"
  | "overtime"
  | "exercise-complete";

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
  currentSeries: number;      // 1-based — the set now in progress / just finished
  plannedSeries: number;
}

export interface SeriesView {   // (h) one completed set of the CURRENT exercise, display-unit
  reps: number;               // the plan's reps for this set index
  weight: number;             // DISPLAY unit (kg→lb converted at the seam, D11); 0 if unset
  workSeconds: number;        // that set's elapsed work time
  volume: number;             // display-unit volume = weight × reps (UI does no math, D11)
}

export interface WorkoutSessionApi {
  status: SessionStatus;
  dayName: string;

  // --- overview ---
  exercises: OverviewExercise[];                 // (a)
  defaultRestSeconds: number;                    // seeded per D7
  setDefaultRestSeconds: (seconds: number) => void;
  start: () => Promise<void>;                    // → status 'in-progress', first set READY (§D12)

  // --- in-progress ---
  currentExercise: CurrentExerciseView | null;   // (b)
  unit: MeasurementUnit;                         // (c) "metric"|"imperial" — for the "kg"/"lb" label only
  weight: number | null;                         // (c) entered weight for the CURRENT set in DISPLAY unit (§D12)
  setWeight: (value: number | null) => void;     // (c) value in display unit; converted to kg in logic (D11)
  previousWeight: number | null;                 // (d) last session's weight for this exercise in display unit, or null
  canStartSet: boolean;                          // (§D12) ready && weight entered — UI gates the start tap on this
  timer: TimerView;                              // (e)
  completedSets: SeriesView[];                   // (h) the CURRENT exercise's finished sets, in order — for a per-set progress list
  tap: () => Promise<void>;                       // (e) the single stopwatch action (ready→work→rest→…); the work-phase tap RECORDS the set
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
- **The set is recorded on the work-phase `tap` — there is no separate
  "log set" action.** When the user is in `work` and taps (they call it "start
  next set" / "start rest"), the seam captures that set from live state: its
  **elapsed work time** (`floor((Date.now() − anchorTs)/1000)`), the **weight**
  currently entered (`weight`, stored canonical kg), and the **plan's reps** for
  that set index → a `SeriesLog { reps, weightKg, workSeconds, volumeKg }`
  appended to the current exercise. The UI never assembles this; `tap()`'s
  signature is unchanged.
- **Per-set progress is `completedSets` + `timer.currentSeries`/`plannedSeries`.**
  `completedSets` is the ordered list of the current exercise's finished sets in
  **display units** (e.g. render "Set 1 · 12 × 80 kg · 0:45"); `currentSeries`/
  `plannedSeries` give the "Set 2 of 4" counter for the set in progress. Both
  reset when `nextExercise()` moves to the next exercise.
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
           mode, plan→view mappers, tap reducer w/ SeriesLog capture, per-exercise
           total derivations, kg↔display conversion D11)
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
getPreviousWeight(exerciseId: string): Promise<number | null>;     // kg; completedAt desc scan; last SeriesLog with weightKg>0 of the newest matching ExerciseLog (D6)
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
- **Reps/volume are planned, not counted** (revised D1) → each `SeriesLog.reps`
  is the plan's reps for that set index and `volumeKg = weightKg × planned reps`,
  since rep-counting is a non-goal. The record captures prescribed load at the
  entered weight, not measured output — honest and clearly labelled. (This
  revision *retires* the old "varied reps flattened to `sets[0]`" limitation:
  12/10/8 is now stored per set.)
- **Stored-total drift avoided** → no denormalized exercise total (`workSeconds`/
  `volumeKg`) is persisted; totals derive from `series[]` via pure helpers, so a
  stored total can never disagree with the array.
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

**`config.yaml` edit made by this change.** The product-decision line is kept
authoritative. After the 2026-07-11 revision it reads as: workout mode logs
**per-series** data — each set's weight, the plan's reps, elapsed work time, and
volume (`weight × reps`) — with rest kept as a per-exercise aggregate; a single
tap-to-start stopwatch cycles ready → work (up) → rest (down) → overtime; sessions
resume at the exercise/set in progress after interruption. This supersedes both
framing-v1 and the interim per-exercise-aggregate wording. Every agent inherits
the corrected framing.

## Open Questions

- **Per-series rest** — revised D1 keeps rest as an exercise-level aggregate
  (`ExerciseLog.restSeconds`). If rest-density analytics or per-set rest display
  are ever wanted, add `restSeconds` to `SeriesLog` (banked by having the
  rest→ready tap patch the last-pushed set). Deferred; not in the PO's ask.
- **Previous-weight extraction across varying sets** — D6 returns the last
  positive-weight set of the newest matching exercise. If users prefer "set-1
  weight" or "top set," it is a one-line repo change; revisit on feedback.
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
