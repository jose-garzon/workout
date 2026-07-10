# Tasks — workout-mode (Feature D)

Ownership: **[E]** software-engineer (types/db/repo/model/store/seam), **[D]**
frontend-dev-designer (ui), **[A]** app-layer routing. The builders meet at the
`useWorkoutSession(dayId)` seam (design.md "Logic↔UI seam contract"): once the
barrel types + seam signature exist (groups 1 + 4), [D] can build every view
against the contract while [E] fills the engine, in parallel.

## 1. Domain & schema reshape [E]

- [ ] 1.1 Reshape `modules/workout-mode/types.ts` to the per-exercise model (D1): add `ExerciseLog` + `SessionPhase`; redefine `WorkoutSession` (in-progress: cursor + in-flight `phase`/`anchorTs`/accumulators/`enteredWeightKg`/`exerciseLogs`) and `CompletedSession` (`dayId`, `exerciseLogs[]`, optional `difficulty?`/`fatigue?`); remove `SetLog`.
- [ ] 1.2 Reshape `SessionRow` + `CompletedSessionRow` fields in `shared/db/schema.ts` to mirror D1 (drop `currentSetIndex`/`logs`; add the new fields + `dayId`). Keep the `version(1).stores({...})` string **byte-for-byte unchanged** — only non-indexed fields change, stores are empty on every device, so NO version bump / migration (D2). Confirm indexes `id`/`routineId`/`completedAt` survive.
- [ ] 1.3 Update `modules/workout-mode/index.ts` barrel (D9): export `useWorkoutSession` + its view-model types + `{ CompletedSession, ExerciseLog, WorkoutSession, SessionPhase }`. Remove `useRestTimer`/`RestTimer`/`SetLog`/`WorkoutStatus`. Keep `CompletedSession` exported (calendar depends on it).
- [ ] 1.4 Delete the superseded `logic/useRestTimer.ts` stub (its role is folded into the unified stopwatch).

## 2. Persistence: sessionRepo [E]

- [ ] 2.1 Create `modules/workout-mode/api/sessionRepo.ts` (imports only `@/shared/db` + `../types`): `getInProgress(routineId, dayId)`, `saveInProgress`, `clearInProgress(routineId, dayId)`, `saveCompleted`, `updateRatings(id, {difficulty?,fatigue?})`, `getPreviousWeight(exerciseId)` (design.md seam contract).
- [ ] 2.2 In-progress id is the composite `${routineId}:${dayId}` → keyed `get` (D5); completed id is `crypto.randomUUID()`. Map `exerciseLogs` (`unknown[]` row field) ↔ domain, as `routineRepo` maps `days`.
- [ ] 2.3 `getPreviousWeight` scans `completedSessions` by `completedAt` **descending** (existing index) and returns the first matching `ExerciseLog` by `exerciseId` **whose `weightKg > 0`** (0 = unset/bodyweight → treated as no weight), else `null` (D6). Returns kg.
- [ ] 2.4 Test `sessionRepo` with `fake-indexeddb`: in-progress save→get→clear round-trip (one row per day); `saveCompleted` then `updateRatings` persists ratings; `getPreviousWeight` returns the most recent match and `null` when absent; survives db close/reopen.

## 3. Pure model [E]

- [ ] 3.1 Create `logic/model.ts` (pure, no Dexie/React): `defaultRestFor(day)` = mode of all `SetPlan.restSeconds` (ties → smaller, fallback `90`) (D7); plan→view mappers (`OverviewExercise[]`, `CurrentExerciseView` incl. `repsPerSet` + `plannedReps = sets[0].reps`); **weight conversion helpers** (kg↔display unit, `1 kg = 2.2046226 lb`; display rounded to a `0.5` step) for the display-unit seam (D11).
- [ ] 3.2 The `tap` reducer as a pure function over the session state (D3 table): work→banks work + increments series → rest (or exercise-complete/finish on last series); rest/overtime→banks rest → next work. Append `ExerciseLog` (weight `?? 0`) when an exercise completes.
- [ ] 3.3 Test `model.ts`: `defaultRestFor` (mode, tie, fallback); the tap reducer transitions for every phase incl. last-series-completes-exercise (no trailing rest) and last-exercise-finishes; accumulation math.

## 4. Timer engine, store & the seam [E]

- [ ] 4.1 `logic/store.ts` — Zustand hot state holding the in-flight `WorkoutSession` shape (`phase`, `anchorTs`, cursor, accumulators, entered weight, `exerciseLogs`) + `status`. Mutates only on transitions (tick-free) (D3).
- [ ] 4.2 `logic/useTimerTick.ts` (private) — a display-only `setInterval` (~250ms) bumping a `nowTick` to force re-render; cleared on unmount and when phase is `exercise-complete`. Never the source of truth (D3).
- [ ] 4.3 Implement `logic/useWorkoutSession(dayId)` (the seam, design.md contract): resolve the active routine via `useActiveRoutine()` + the user's `unit` via `useProfile()` (both routine-generation / profile-goals barrels — legal from `logic/`) + select the day; `status` machine (`loading`/`no-routine`/`overview`/`in-progress`/`success`); `start`, `tap`, `nextExercise`, `setWeight`, `setDefaultRestSeconds`, `submitRatings`; expose `unit` + `weight`/`previousWeight` in the user's **display unit** (convert via 3.1; store canonical kg) (D11); derive `timer` (work↑ / rest↓ / derived `overtime` / complete) entirely from `anchorTs + Date.now()` (D3).
- [ ] 4.4 Persist-on-transition: every `start`/`tap`/`nextExercise`/`setWeight`/`setDefaultRestSeconds` writes `saveInProgress` (D4). Finish sequence (last exercise's work tap): `saveCompleted` → `clearInProgress` → hold completed id → `status='success'` (D5).
- [ ] 4.5 Resume on mount: `getInProgress(routineId, dayId)` rehydrates the store verbatim; derived timer reproduces exact remaining/elapsed incl. a rest that elapsed to overtime while away. **If the rehydrated `phase === "work"`, reset `anchorTs = Date.now()` (and persist)** so a tab closed mid-set doesn't inflate `workSeconds` — banked series are untouched (D4).
- [ ] 4.6 `previousWeight` (display unit): re-run `getPreviousWeight(currentExercise.id)` whenever `currentExerciseIndex` changes; convert kg→display for the seam (D6/D11).
- [ ] 4.7 Tests: timestamp derivation (work-up, rest-down, rest→overtime past zero) using injected/fake clock; resume from a persisted mid-rest row reproduces exact remaining time; **resume mid-work resets the work anchor (no `workSeconds` inflation)**; a backgrounded interval does NOT drift the value; finish writes the completed record before clearing in-progress; **weight conversion round-trips for imperial (enter lb → store kg → display lb)**.

## 5. App routing [A]

- [ ] 5.1 `app/workout/[dayId]/page.tsx`: `await params` (Next 15 async params), pass `dayId` to `WorkoutModeScreen` (D8).
- [ ] 5.2 Thread `dayId` through `WorkoutModeScreen` → `WorkoutModeBody` → `useWorkoutSession(dayId)`; remove the placeholder `"placeholder"` routineId wiring.

## 6. UI — the guided flow [D]

- [ ] 6.1 `ui/SessionOverview` (status `overview`): the day's exercise list (name · planned series × reps), the editable **default rest** field (seeded from the seam), and a primary **Start** (session-overview spec).
- [ ] 6.2 `ui/ExerciseView` (status `in-progress`): exercise name, position (`index/total`), planned series/reps (may show `repsPerSet` as a range), the single **weight field** labelled with the seam's `unit` (kg/lb — no unit math in the UI, D11), and **previous weight** shown only when `previousWeight != null` (exercise-execution spec).
- [ ] 6.3 `ui/Stopwatch`: the big rounded control driven by `timer` + `tap` — the ONE circular element in the system (design-system §3.4). Visual states: WORK (normal pulse), REST (warm/calm color, slower pulse, ring fill = remaining/`restTotalSeconds`), OVERTIME (warning color, faster pulse, an inspiring "time's up, let's continue" prompt). Digits exact + `tabular-nums`, never smoothed. Respect `prefers-reduced-motion` (drop the pulse; the ring fill is data, may stay).
- [ ] 6.4 Exercise advance: when `timer.phase === 'exercise-complete'` show **Next exercise** (`nextExercise`); on the last exercise the final tap has already moved to `success` (no complete screen) (exercise-execution / workout-timer specs).
- [ ] 6.5 `ui/SuccessView` (status `success`): congrats message + an SVG graphic, a **difficulty 1–5** input, a **fatigue 1–5** input (both optional → `submitRatings`), and an always-enabled **back to home** control (`router.push('/')`) (session-completion spec).
- [ ] 6.6 `no-routine` empty state + `loading` skeleton (design-system four states); `WorkoutModeBody` selects the view purely off `status` (never branches on timestamps).

## 7. Design-system additions (only if needed) [D]

- [ ] 7.1 Add reusable primitives ONLY if warranted: a 1–5 rating input and the pulse keyframes for the three stopwatch states (in `shared/ui/tokens/globals.css`, generation-of-motion style, with reduced-motion overrides). The circular ring is workout-mode-specific — keep it in `ui/Stopwatch` unless clearly reusable. Else reuse existing primitives/tokens.

## 8. Tests & verification

- [ ] 8.1 [E] Integration test of the full seam (real store + real `fake-indexeddb`): overview → start → tap through a 2-exercise day (work/rest/overtime) → finish → `success`; assert the persisted `CompletedSession` has correct per-exercise `series`/`reps`/`weightKg`/`workSeconds`/`restSeconds` and no per-series data. **Spy on `fetch` and assert it is NEVER called across the whole session** (session-tracking "no network" scenario).
- [ ] 8.2 [E] Resume test: interrupt mid-exercise, rehydrate, land on the same exercise with weight + series progress intact and an exact timer.
- [ ] 8.3 [D] Component tests: overview lists exercises + Start; weight field + previous-weight visibility; stopwatch renders the three phases off `timer.phase`; success view captures ratings + back-home navigates.
- [ ] 8.4 Playwright e2e: tap a day on home → overview → start → complete a session → success → rate → back home; reload mid-session resumes.
- [ ] 8.5 Run Biome + dependency-cruiser (`bunx biome check src`, `bunx depcruise src`) — `ui/` imports only own `logic/` + `shared/ui`; cross-feature (`routine-generation`) only from `logic/` via barrel; only `api/` touches `shared/db`. No server-firewall surface (workout mode makes no network call).
