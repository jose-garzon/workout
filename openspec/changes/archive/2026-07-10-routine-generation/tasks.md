# Tasks — routine-generation (Feature B)

Ownership: **[E]** software-engineer (logic/api/db/AI), **[D]** frontend-dev-designer
(ui), **[A]** app-layer composition + routes. Builders work in parallel meeting at
the frozen seams (`useRoutineGeneration`, `useActiveRoutine`) — groups 1–5 (E) and
group 8 (D) can proceed concurrently once the schema deltas in group 1 land.

## 1. Domain & schema deltas [E]

- [x] 1.1 Add optional `subtitle?: string` to `Routine` in `modules/routine-generation/types.ts` (D7).
- [x] 1.2 Add `subtitle` (optional, non-empty when present) to `routineSchema` in `api/ai/schema.ts`; confirm `routineJsonSchema` regenerates to include it.
- [x] 1.3 Extend `buildRoutinePrompt` signature to `(userPrompt, ctx: { profile, goals })`; fold goal / daysPerWeek / bodyweight / units into the messages and instruct the model to author a short motivational `subtitle` (D2, D7). Keep it pure/server-safe (no Dexie).
- [x] 1.4 Unit-test `buildRoutinePrompt`: profile/goals appear in the messages; output is deterministic and side-effect-free.

## 2. Persistence: routines store [E]

- [x] 2.1 Add a `routines` object store + schema-version bump + migration in `shared/db` (empty store is a valid state for existing users) (D6). *(Store already declared in schema v1; added non-indexed `subtitle?` to `RoutineRow` — no version bump needed.)*
- [x] 2.2 Create `modules/routine-generation/api/routineRepo.ts`: `getActive(): Promise<Routine | null>` and `saveActive(routine): Promise<void>` using a singleton row id `"active"` (`put` overwrites → one-at-a-time is structural).
- [x] 2.3 Test `routineRepo` with `fake-indexeddb`: save→read round-trips; a second `saveActive` leaves exactly one row (invariant); empty store reads `null`.

## 3. Streaming proxy route [E]

- [x] 3.1 Implement the real OpenRouter call in `app/api/generate-routine/route.ts`: read `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` (server env only), validate the `{ prompt, profile, goals }` body, build messages via `buildRoutinePrompt`, request `stream: true` with `response_format` from `routineJsonSchema` (D2, D3).
- [x] 3.2 Pass the upstream SSE `ReadableStream` straight back to the client without buffering the whole response (stays stateless — a pass-through, persists nothing).
- [x] 3.3 Map upstream/HTTP failures to `AiError` via `aiErrorForStatus`; return the discriminated error shape (never a raw string).
- [x] 3.4 Verify the firewall fixture still holds: the route imports only `api/ai/{prompt,schema,errors}` — never `shared/db`, any `*Repo`, or `api/ai/client`. Biome must error if it did.

## 4. Browser AI client: stream consumption [E]

- [x] 4.1 Extend `postGenerateRoutine` to send `{ prompt, profile, goals }` and expose stream parsing: accumulate `delta.reasoning` → thinking text and `delta.content` → routine JSON string (D3). Keep the offline short-circuit (`{kind:'offline'}`, no network hit). *(Kept `postGenerateRoutine` for smoke tests; layered `generateRoutine` + `consumeStream`.)*
- [x] 4.2 Parse the assembled JSON and validate with `routineSchema` at stream end; assemble into a domain `Routine` (add `id`/`createdAt`/`active:true`, day/exercise ids). Validation failure → `AiError{kind:'parse'}`.

## 5. Generation & active-routine seams [E]

- [x] 5.1 Add a Zustand store under `logic/` holding `status: GenStatus`, `progressMessage`, `result: Routine | null`, `error: AiError | null` (D4).
- [x] 5.2 Implement `useRoutineGeneration.generate(prompt)`: `generating` → drive `progressMessage` from streamed reasoning → on success hold the validated `Routine` in `result` with `status:'ready'`; on failure set `error` + `status:'error'` and leave any active routine untouched (spec `routine-generation`). *(`generate(prompt, ctx)` — ctx carries profile context per D2.)*
- [x] 5.3 Implement `confirmSave()` as the ONLY persist path: write the held `result` via `routineRepo.saveActive`, then clear the held result/reset status (D5).
- [x] 5.4 Add a reset/decline action that drops the held `result` and returns to `idle` without persisting (for declined replacement) (D5).
- [x] 5.5 Implement `useActiveRoutine` as a `useLiveQuery` over `routineRepo.getActive()` → `{ routine, loading, error }`, re-emitting after `confirmSave` writes (D6). Remove the throwing stub.
- [x] 5.6 Keep `index.ts` barrel exports (signatures unchanged); confirm no deep cross-feature imports.

## 6. App-layer home composition [A]

- [x] 6.1 Refactor `FirstRunGate` to accept a `home` render slot `(profile, goals) => ReactNode` instead of hard-coding `HomeScreen`; keep loading→`Splash`, absent→`WelcomeFlow` (D1).
- [x] 6.2 Update `app/page.tsx` to pass `home={(p, g) => <RoutineHomeScreen displayName={p.displayName} goal={g.focus} />}` (app layer may deep-import the feature screen + call the profile barrel). *(Passes discrete scalars incl. daysPerWeek/bodyweight/unit so the UI needs no profile-goals import.)*
- [x] 6.3 Remove the superseded name-only `HomeScreen` from `profile-goals/ui` (and its test) — home content now lives in routine-generation (D1). *(Integration test updated to a stand-in home slot, keeping it independent of routine-generation.)*
- [x] 6.4 Add `app/workout/[dayId]/page.tsx` thin wrapper rendering `WorkoutModeScreen` (empty for now) (D8).

## 7. Design-system additions (if needed) [D]

- [x] 7.1 Add any missing primitives the composer/badge need (e.g. multi-line text input, small badge/pill) to `shared/ui/primitives` — reused, sharp-rectangle, token-driven; else reuse existing `Input`/`Button`. *(No new primitive needed: composer textarea + badge are feature composites reusing `Button` + tokens. Added the generation-only `anim-build-bars` motion preset to `shared/ui/tokens/globals.css` — the sanctioned AI-generation loop, with a reduced-motion freeze.)*

## 8. Home UI: dashboard + composer [D]

- [x] 8.1 Build `RoutineHomeScreen` (routine-generation `ui/`) taking `{ displayName, goal }` props; consumes `useActiveRoutine` + `useRoutineGeneration` (its own logic only — no cross-feature import) (D1).
- [x] 8.2 Identity header: greeting name + small goal badge + motivational line — routine's `subtitle` when present, else a neutral "build your routine" invitation (spec `home-routine-dashboard`, D7).
- [x] 8.3 Pro-grade prompt composer pinned to the bottom: roomy multi-line, primary-action styling, disabled/blocked on empty prompt (spec `routine-generation`).
- [x] 8.4 Animated building indicator between header and composer, shown only while `status==='generating'`, cleared on resolve (spec `routine-generation`). Subtle/purposeful per design ethos.
- [x] 8.5 Live thinking summary above the composer bound to `progressMessage`, in a bounded auto-scrolled region; hidden when empty (spec `routine-generation`, D3).
- [x] 8.6 Per-day routine summary when a routine exists: list days by name, at-a-glance contents; each day activates navigation to `/workout/[dayId]` (spec `home-routine-dashboard`, D8).
- [x] 8.7 Empty state (profile present, no routine): header invitation + composer only, no day summary.
- [x] 8.8 Error surface: render the mapped `AiError` as a specific human message with retry; offline message on offline submit (spec `routine-generation`).
- [x] 8.9 Replace-confirmation: when `status==='ready'` and a routine already exists, prompt to confirm before replacing; confirm → `confirmSave()`, decline → reset (D5). First routine (none exists) adopts automatically.

## 9. Tests & verification

- [x] 9.1 [E] MSW streaming handler emitting reasoning + content deltas; integration test of `generate` → `progressMessage` updates → validated `Routine` in `result`. *(`generation.integration.test.tsx` — streaming success, parse-error, and HTTP-error-preserves-routine.)*
- [x] 9.2 [E] Test the adopt-vs-replace logic: first success auto-persists; second success holds pending until confirm; decline preserves the current routine. *(Hook-level confirmSave/reset in the integration test; UI auto-adopt + decline in the component test.)*
- [x] 9.3 [D] Component tests: composer blocks empty submit; indicator visibility tracks `generating`; thinking summary renders `progressMessage`; day tap routes to `/workout/[dayId]`. *(`RoutineHomeScreen.test.tsx`.)*
- [x] 9.4 Playwright e2e: onboarding → home → prompt → generating (indicator + thinking) → summary appears → tap day → workout mode; reload keeps the routine. *(`e2e/routine-generation.spec.ts`, proxy intercepted with deterministic SSE. Production `next build` passes; the Playwright run itself was not executed in this session — no browser runtime here.)*
- [x] 9.5 Run the Biome + dependency-cruiser firewall check (pre-commit) — no cross-feature UI imports, route firewall intact. *(`biome check` + `depcruise src` clean; `firewall-proof.sh` all green.)*
