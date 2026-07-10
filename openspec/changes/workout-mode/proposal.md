# Proposal — workout-mode (Feature D: the guided in-gym workout)

> Third real user feature. Delivers Feature D from the locked build order
> (A → B → **D** → C). Feature B turned home into a routine you can start; today
> tapping a day opens an empty `/workout/[dayId]` placeholder. This change fills
> that screen with the whole reason a routine exists: standing in the gym, the
> app walks you through each exercise, times your work and rest, and records what
> you actually did. The *how* (data model, the timer state machine, resume
> mechanics, the seam signatures already frozen as foundation stubs
> — `useWorkoutSession`, `useRestTimer`, `SetLog`/`WorkoutSession`/
> `CompletedSession`) is the architect's `design.md`; this proposal owns *what &
> why* and the acceptance gate.

## Why

A routine that only lives on the home screen is a plan, not a workout. Our user
is in the gym, phone in one hand, mid-set, and needs the app to do three things
without getting in the way: tell them what's next, time the rest between sets
(the single most-requested behavior in the product vision), and remember what
they lifted so next time they can beat it. Nothing does that yet — the day tap
lands on a blank screen.

This change delivers the execution loop: start a day → move through its exercises
one at a time → per exercise, log the weight and let a single stopwatch button
carry you through work and rest for each series → finish → a short success moment
that captures how the session felt. Everything is recorded on-device so the
calendar (Feature C, later) can show consistency and the next session can show
last time's weight.

## Target user

The **intermediate gym-goer** (`config.yaml` locked persona) — efficiency over
hand-holding. They don't want coaching or form cues; they want a fast, glanceable
guide and an honest rest timer they can trust between sets while fatigued. Every
control is sized and sequenced for a tired thumb (design-system Principle 5).

## What changes

- **The `/workout/[dayId]` screen becomes a real, guided session** for that day
  of the active routine, replacing the empty placeholder.
- **A session overview** first: the day's exercises listed with their planned
  series × reps, an editable **default rest time** for the whole session, and one
  **Start** button.
- **A per-exercise view**, one exercise at a time: exercise name, its planned
  series and reps, and a **weight field**. If the user has done this exercise in a
  prior completed session, the view shows the **previous weight** as a reference;
  if they never have, it shows none.
- **A single stopwatch button that cycles work and rest.** It counts **work**
  time up during a series; a tap ends the series and starts a **rest** countdown
  from the session default; if rest runs out before the user advances it enters an
  **overtime** state with a "time's up, let's continue" prompt; a tap starts the
  next series. Colors/pulse are the designer's — the *states and their triggers*
  are the requirement.
- **Advancing through the day.** After the last series of an exercise, a **Next
  exercise** control appears; after the last exercise, the session completes.
- **Per-session, per-exercise tracking.** Each finished session records its date
  and, per exercise, the series count, reps, weight, total work time, and total
  rest time. Individual series are **not** recorded (see Key decision 1).
- **Resume after interruption.** A session left partway through reopens where it
  was, with already-finished exercises preserved (see Key decision 1).
- **A success view** on finishing: a congratulations message with a celebratory
  graphic, a **difficulty (1–5)** input, a **fatigue (1–5)** input, and a button
  back home.
- The frozen `useWorkoutSession` / `useRestTimer` seams get their real
  implementations behind the signatures the foundation already declared.

## Key decisions (needs approval)

These are the product calls that shape the specs — flagged for review rather than
buried in design. Decision 1 is load-bearing and **supersedes a locked framing-v1
decision**.

1. **Track per-exercise aggregates, not per set — this reverses a locked v1
   decision.** `config.yaml` currently locks: *"Workout mode logs actual weight +
   reps + rest per set … sessions resume at the exact set after interruption,"*
   and the foundation stubs (`SetLog`, `WorkoutSession.currentSetIndex`) reflect
   that. The user has now explicitly asked for **per-exercise aggregates and no
   individual-series tracking**: one weight per exercise, the plan's reps, and
   total work/rest time. We adopt the user's model. Consequences that need a yes:
   - **Resume granularity coarsens from per-set to per-exercise.** An interrupted
     session resumes at the **exercise in progress** (with already-completed
     exercises preserved and that exercise's entered weight and series progress
     restored), not at an exact set index. This is the deliberate trade for the
     simpler record.
   - **`config.yaml` and the foundation types will need updating** by the
     architect (`SetLog`/per-set cursor → per-exercise aggregate). That's a
     `design.md` task; this proposal only sets the behavior.
2. **One weight per exercise; reps come from the plan.** The weight field is per
   *exercise view*, entered once, and applies to every series of that exercise.
   Reps are **not** entered — they are the routine's planned reps, shown for
   reference. (Recommended: this keeps mid-set input to a single number.)
3. **"Previous weight" = the weight logged for the same exercise in the most
   recent completed session.** "First session ever" means no prior completed
   session contains that exercise → no previous weight is shown. The *matching
   mechanism* (by exercise id vs. name across routine regenerations) is an open
   note for the architect; this proposal fixes only the behavior.
4. **The default rest time is set once on the overview and applies to every
   rest.** It prefills from the routine's prescribed rest for the day (the
   architect picks the exact source value — e.g. the day's typical/first
   `restSeconds`) and is editable before starting. There is no per-series rest
   override in this change.
5. **The stopwatch is one control cycling states**: WORK (counts up) → tap → REST
   (counts down from the default) → *if rest elapses untapped* → OVERTIME (warning
   + "time's up" prompt) → tap → next series' WORK. Ending the **final** series
   completes the exercise (no trailing rest) and reveals **Next exercise**. Each
   state and transition is an acceptance criterion; the visual treatment is not.
6. **Difficulty and fatigue ratings are optional.** The completed session is
   recorded the moment the final exercise finishes (so a closed tab never loses a
   finished workout); the two 1–5 ratings enrich that record when provided, and
   the back-home button is always enabled. Rationale: the efficiency-first persona
   and the design principle that success is quiet and never blocks — we don't
   gate leaving on a rating. (Alternative — required ratings — rejected as
   friction on an already-complete workout.)

## Capabilities

### New Capabilities

- `session-overview`: the pre-start screen for a day — the exercise list with
  planned series × reps, the editable session default-rest field, and Start;
  entry from a tapped day of the active routine.
- `exercise-execution`: the per-exercise view — name, planned series/reps, the
  single weight field, the previous-weight reference, and advancing through an
  exercise's series and on to the next exercise until the day is done.
- `workout-timer`: the single stopwatch control's work → rest → overtime state
  machine — its triggers, the "time's up" prompt, and the requirement that it is
  exact and survives tab backgrounding/refresh (the heartbeat).
- `session-tracking`: what a session persists locally — date plus per-exercise
  aggregates (series, reps, weight, total work time, total rest time), no
  per-series breakdown, resume-at-exercise after interruption, and no network.
- `session-completion`: the success view — congratulations + graphic, the
  optional difficulty (1–5) and fatigue (1–5) inputs stored on the completed
  session, and the return-home control.

### Modified Capabilities

None. There is no existing `workout-mode` spec in `openspec/specs/`; all behavior
here is new. Note the conflict with a locked *framing* decision in
`config.yaml` (Key decision 1) — that config text, and the foundation types, are
updated by the architect, not by an existing spec's requirements changing.

## Impact

- **`app/workout/[dayId]/page.tsx`**: the placeholder becomes a thin wrapper
  delegating into `modules/workout-mode/ui`, scoped to the day of the active
  routine.
- **`modules/workout-mode`**:
  - `logic/useWorkoutSession` + `logic/useRestTimer` — real implementations
    behind the frozen foundation signatures; a Zustand store for hot in-session
    state (current exercise, current series, accumulated work/rest, entered
    weight, timer state).
  - `api/sessionRepo.ts` — the Dexie repo persisting in-progress and completed
    sessions.
  - `types.ts` — reshaped from the per-set `SetLog` model to the per-exercise
    aggregate model (Key decision 1); `CompletedSession` gains the optional
    difficulty/fatigue ratings.
  - `ui/` — the overview, the per-exercise view, the stopwatch control, and the
    success view (feature-specific composites).
- **`shared/db`**: the `sessions` / `completedSessions` row shapes change from
  per-set logs to per-exercise aggregates + ratings, via a schema-version
  migration. **Reads cross-feature by calendar (Feature C, downstream) via the
  barrel** — this change's data-model change defines what calendar will later
  read, though calendar itself is out of scope.
- **`modules/routine-generation`**: consumed read-only via its barrel
  (`Routine`/`RoutineDay`/`Exercise`/`SetPlan`) for the day's plan. No changes to
  Feature B.
- **Testing**: `fake-indexeddb` coverage for `sessionRepo`, resume, and the
  previous-weight lookup; timer tests for the work/rest/overtime transitions and
  timestamp-based survival of refresh; a Playwright pass over overview → per-
  exercise stopwatch cycling → finish → success → home.

## Non-goals

- **No network, ever.** Workout mode makes **zero** network calls — the only
  network call in the whole app remains routine-generation's AI proxy. Everything
  here reads and writes IndexedDB only (hard local-first constraint).
- **No per-series logging.** Individual sets are not recorded — per-exercise
  aggregates only (Key decision 1). No PR charts or progress analytics; data is
  captured, not yet visualized.
- **No routine editing mid-session.** The user follows the day's plan as
  generated; changing exercises/sets/reps is not part of workout mode.
- **No calendar / consistency view.** Aggregating completed sessions into a
  weekly target is Feature C.
- **No form guidance, coaching cues, exercise media, or rep counting.** The
  persona is intermediate; the app times and records, it doesn't coach.
- **No skipping/reordering exercises, and no partial-session "save & finish."**
  A session is worked in order; an unfinished session is resumed, not
  force-completed.
- **No audible/haptic timer alerts in this change's scope beyond the visual
  states** — the design-system's permission-gated cue is a later refinement, not
  gated on here.

## Priority

The smallest slice that delivers the loop: overview (with default rest) → Start →
per-exercise view with weight field and previous weight → the stopwatch cycling
work/rest/overtime → advance through all exercises → success view → recorded
completed session → home, all surviving a mid-session reload. First cuts if scope
tightens, in order: the previous-weight reference (degrade to a plain empty
field), then the difficulty/fatigue ratings (degrade to congrats + home only).
**Not cuttable:** the exactness and refresh-survival of the rest timer (the
heartbeat), and persisting the completed session on finish — both protect the
core value and the user's data.
