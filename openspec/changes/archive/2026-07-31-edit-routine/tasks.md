# Tasks — edit-routine

Two builders work in parallel and meet at the `useRoutineEdit` seam. Engineer
builds groups 1–3 + tests; designer builds group 4 against the seam once it
exists (group 3). Groups 5–7 are verification and E2E.

## 1. AI edit path — server (engineer)

- [x] 1.1 (engineer) Add `buildEditPrompt(instruction, routine)` to `api/ai/prompt.ts` — pure/server-safe, instructs "apply ONLY the requested change, return the FULL updated routine in the same schema, leave everything else unchanged".
- [x] 1.2 (engineer) Branch `openrouter.parseBody` on `mode === "edit"`: accept `{ mode, instruction, routine }`, validate `instruction` non-empty + `routine` is an object, call `buildEditPrompt`; build path unchanged. `response_format` stays `routineJsonSchema`.
- [x] 1.3 (engineer) Unit-test `buildEditPrompt` + the edit-body parse branch (edit body accepted, build body still works, malformed edit body rejected).

## 2. AI edit path — client + id preservation (engineer)

- [x] 2.1 (engineer) Add `stripToPayload(routine)` to `api/ai/client.ts` — maps a domain `Routine` to the id-less `RoutinePayload` shape sent to the model.
- [x] 2.2 (engineer) Add `assembleEditedRoutine(payload, previous)` — hierarchical normalized-name matching (day-by-name then exercise-by-name, match-and-consume), reuse ids for matched items, fresh UUIDs for new/renamed, preserve `id` + `createdAt`.
- [x] 2.3 (engineer) Refactor `consumeStream` to take an `assemble: (p: RoutinePayload) => Routine` param; `generateRoutine` passes `assembleRoutine` (unchanged behavior).
- [x] 2.4 (engineer) Add `editRoutine(current, instruction)` — dispatch the edit body (reusing the offline short-circuit), consume the stream with `assembleEditedRoutine`, no `onThinking` wiring.
- [x] 2.5 (engineer) Unit-test `assembleEditedRoutine` id preservation: unchanged day/exercise keep ids; renamed/new get fresh ids; duplicate names don't collide (match-and-consume); `createdAt` preserved.

## 3. Edit state seam (engineer)

- [x] 3.1 (engineer) Add `logic/editStore.ts` — Zustand store `status: "idle"|"editing"|"success"|"error"` + `error: AiError|null` with `start/succeed/fail/reset`.
- [x] 3.2 (engineer) Add `logic/useRoutineEdit.ts` — `submit(instruction)`: no-op on empty/whitespace, `getActive()` fresh, `start()`, `editRoutine`, on ok `saveActive` then `succeed()` (direct-apply, no confirm), on fail `fail(error)`; expose `status`, `errorMessage` (AiError→edit-flavored copy), `submit`, `reset`.
- [x] 3.3 (engineer) Add barrel exports to `routine-generation/index.ts`: `useRoutineEdit`, and types `EditStatus`, `RoutineEdit`.
- [x] 3.4 (engineer) Integration-test `useRoutineEdit` (fake-indexeddb + MSW): success direct-applies + re-emits via `useActiveRoutine`; error/offline leave the active routine unchanged; empty submit is a no-op.

## 4. UI (designer) — consumes `useRoutineEdit`

- [x] 4.1 (designer) Add an edit button next to the routine title in `RoutineSummary` that opens the editor (local `editorOpen` state).
- [x] 4.2 (designer) In `RoutineHomeScreen`, hide the standing `Composer` when a routine exists and remove the `awaitingReplace` "Replace your routine?" scrim dialog + its `confirmSave`-on-confirm wiring.
- [x] 4.3 (designer) Build the floating fixed editor: bottom-docked, rises on open / lowers on close (design-system motion tokens), routine visible + stationary behind (no scrim), `prefers-reduced-motion` → instant, `ActivityDrawer` mount-lifecycle (stay mounted through exit, unmount on `animationend`).
- [x] 4.4 (designer) Wire the editor to `useRoutineEdit`: `submit(instruction)`, lock field while `status==="editing"`, empty/whitespace can't submit (reuse `Composer` guard).
- [x] 4.5 (designer) On `status==="success"` set `editorOpen=false` (play close animation) then `reset()`; on `status==="error"` keep open and show `errorMessage`.
- [x] 4.6 (designer) Add an edit-specific verb loading indicator (improving/enhancing/powering…), distinct from the build verbs, first verb a stable literal.
- [x] 4.7 (designer) A11y: editor is non-modal (not `aria-modal`, no focus trap; routine stays interactive) — focus the textarea on open, return focus to the edit button on close, `Esc` dismisses.
- [x] 4.8 (designer) Block background interactivity WHILE loading only: while `status==="editing"`, mark the shell `inert` (native attribute — removes it from a11y tree, hit-testing, and tab order) + subtle `opacity` dim; restore on `success` AND `error`. Editor lifted to a sibling of `AppShell` so `inert` doesn't disable itself. Integration test asserts the `[inert]` toggle across idle→editing→error.

## 5. Update existing tests (engineer)

- [x] 5.1 (engineer→designer) Done by designer: `routineHome.integration.test.tsx` updated — the "replace confirmation" describe block (drove the removed `awaitingReplace` dialog) is deleted; the "routine summary" describe block gained a test asserting the edit button is present and the build composer (`"Describe the routine you want"`) is absent once a routine exists. `useEditStore.getState().reset()` added to `beforeEach` for isolation. All 6 tests in the file pass (`bunx vitest run`).

## 6. Firewall + local-first sanity (engineer)

- [x] 6.1 (engineer) Confirm firewall rule 4 still holds after the edit branch: `route.ts`/`openrouter.ts` import only `api/ai/{prompt,schema,errors}` (+ `rateLimit`), no `shared/db`/`*Repo`; `editRoutine` + `routineRepo` stay browser-side (Biome + depcruise pass). `depcruise` clean (no violations, 98 modules); `firewall:proof` all PASS. Engineer-owned Biome scope clean.

## 7. E2E Playwright specs (engineer, next phase — orchestrator-driven)

One test per acceptance criterion, written RED-first, now GREEN (7 pass, 1 `test.fixme`):

- [x] 7.1 (engineer) AC1.1/1.2/1.3 — routine present → edit button next to title, standing composer hidden; no routine → composer shown, no edit button.
- [x] 7.2 (engineer) AC2.1/2.2 — activating edit reveals the bottom editor rising up; routine visible + stationary behind.
- [x] 7.3 (engineer) AC2.3/2.4 — empty/whitespace can't submit; dismiss without submit closes, routine unchanged.
- [x] 7.4 (engineer) AC3.1/3.2/3.3 — submit sends current routine + instruction; only the requested change applies; direct-apply, no confirm dialog.
- [x] 7.5 (engineer) AC3.4/3.5 — edit-specific verbs during load; success animates editor closed, returns to routine + edit button.
- [x] 7.6 (engineer) AC4.1/4.2 — backend error keeps editor open + human message + routine unchanged; offline makes no network call, routine unchanged, editor open.
- [x] 7.7 (engineer) ID preservation — `test.fixme` in e2e (a full log-a-weight flow is too brittle for e2e); covered instead by the `assembleEditedRoutine` unit tests (task 2.5).
