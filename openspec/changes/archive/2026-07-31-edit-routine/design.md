# Design — edit-routine

How the post-creation edit surface is built. Reuses the routine-generation
machinery end to end (one AI client, one stream parser, one proxy route, one
persistence path). No second of anything is introduced.

## Context (what already exists, reused as-is)

- `api/ai/client.ts` — `postGenerateRoutine` (offline short-circuit + HTTP
  dispatch → streaming `Response`), `consumeStream` (SSE → Zod → domain),
  `assembleRoutine` (mints ids). We extend this file; no parallel client.
- `api/ai/openrouter.ts` — server handler behind the ONE proxy route.
- `api/ai/prompt.ts` / `schema.ts` — isomorphic prompt build + `routineSchema`.
- `api/routineRepo.ts` — `saveActive` (put on the `"active"` singleton row),
  `getActive`.
- `logic/useActiveRoutine.ts` — reactive Dexie live query of the active routine.
- `logic/generationStore.ts` / `useRoutineGeneration.ts` — the BUILD seam.

**Key fact that de-risks id handling:** the persisted routine row is a singleton
keyed `"active"` (`routineRepo.toRow` overwrites `id` with `ACTIVE_ID`). So
`routine.id` is ALWAYS `"active"` — it never changes across edits. Only `day.id`
and `exercise.id` are content-derived UUIDs, and only those matter for §C.

---

## A. Where the edit capability lives → **extend `routine-generation`**

**Decision.** The edit code lives inside `modules/routine-generation`, not a new
`modules/routine-editing`. The proposal's `routine-editing` is a **spec
capability** (behavior doc), not a code module.

**Rationale.** The edit surface operates on the same domain object and needs the
same feature-private internals: `client.ts` (`editRoutine`), `routineRepo`
(`saveActive`), `types` (`Routine`), and it renders the edit button *inside*
`RoutineSummary`. Under the firewall a separate feature's `ui/` may import only
its own `logic/` + `shared/ui`, and cross-feature access is barrel-only (seam
hooks + types — never `saveActive`/`editRoutine`, which are `api/`). A separate
module would force re-exporting AI-client + repo functions through the barrel or
duplicating the client wiring — pure plumbing for zero isolation gain.

**Rejected — new `modules/routine-editing`:** would need `Routine`, an edit seam,
and the `RoutineSummary` composite threaded across the barrel, plus a second AI
client seam. Cost without benefit; violates the simplicity rule.

**Consequence.** The `routine-editing` spec capability documents behavior; the
implementation is new files under `routine-generation/{logic,ui,api}` and two
new barrel exports.

---

## B. The AI edit path (server + client)

### Server — one branch in the existing handler

The proxy route file (`app/api/generate-routine/route.ts`) is **unchanged** — it
still delegates to `handleGenerateRoutine`. Firewall rule 4 stays intact: the
route and `openrouter.ts` import only `api/ai/*`; nothing new reaches `shared/db`
or a `*Repo`.

- **Request body gains a discriminant.**
  - Build (unchanged): `{ prompt, profile, goals }`.
  - Edit (new): `{ mode: "edit", instruction: string, routine: RoutinePayload }`
    where `routine` is the current routine **stripped of ids** (schema shape:
    `name`, `subtitle?`, `days[].name`, `exercises[].name`, `sets[]`).
- `openrouter.parseBody` branches on `mode === "edit"`: require `instruction`
  (non-empty string) + `routine` (object), then call the new `buildEditPrompt`.
  The incoming routine is **not** deeply re-validated server-side — it is the
  user's own on-device data echoed back purely as prompt context; the RESPONSE
  is still Zod-validated client-side. Keeps the server a thin, dumb pass-through.
- **Ids never round-trip through the AI.** We strip them before sending, so the
  model can't echo, drop, or invent them. Id stability is decided client-side
  (§C), not trusted from the model.
- `response_format` is **unchanged** — same `routineJsonSchema`; an edit returns
  a FULL routine in the same shape. `routineSchema` reuse confirmed.

**`prompt.ts` gains `buildEditPrompt(instruction, routine)`** (still pure /
server-safe / no Dexie). System prompt: *"You are editing an EXISTING routine.
Apply ONLY the requested change. Return the FULL updated routine in the same
schema. Everything the instruction does not mention must stay byte-for-byte the
same."* User content: the current routine JSON + the instruction.

**Rejected — a second route** (`/api/edit-routine`): more surface, a second
firewall fixture, duplicate streaming/env/rate-limit wiring. A `mode` branch in
one stateless handler is strictly smaller.

### Client — `editRoutine`, reusing the stream + validation

Add to `api/ai/client.ts`, reusing `postGenerateRoutine` + `consumeStream`:

```ts
/** Strip a domain Routine to the id-less schema shape sent to the model. */
function stripToPayload(routine: Routine): RoutinePayload;

/** Assemble the AI payload back into a Routine, PRESERVING ids by name (§C). */
function assembleEditedRoutine(payload: RoutinePayload, previous: Routine): Routine;

/** Edit seam: send current routine + instruction, return the id-preserved result. */
export async function editRoutine(
  current: Routine,
  instruction: string,
): Promise<RoutineOutcome>;
```

- `editRoutine` calls `postGenerateRoutine`-equivalent dispatch with the edit
  body, then `consumeStream`.
- **Small refactor to reuse `consumeStream`:** it currently hard-codes
  `assembleRoutine`. Give it an `assemble: (p: RoutinePayload) => Routine`
  parameter. `generateRoutine` passes `assembleRoutine`; `editRoutine` passes
  `(p) => assembleEditedRoutine(p, current)`. Same stream loop, same Zod parse —
  one parser, as required.
- Offline is already handled by the dispatch layer (`navigator.onLine === false`
  → `{ kind: "offline" }` with no fetch) — AC4.2 falls out for free.
- The edit path does **not** consume the reasoning/thinking stream (no thinking
  log for edit — §E, first-cut simplicity). `consumeStream`'s `onThinking` is
  simply not wired.

**Rejected — overloading `postGenerateRoutine` with an optional routine arg:** a
named `editRoutine` reads clearly at both call sites and keeps the build body
untouched. Same underlying dispatch/stream code is still shared.

---

## C. ID preservation — RESOLVES deferred Decision 2 (HIGHEST RISK)

### The reference model (confirmed by reading the code)

| Reference | Where | Keyed by | Breaks if reminted |
|---|---|---|---|
| `routineId` | in-progress + completed sessions | always `"active"` | never — stable by construction |
| `dayId` | in-progress key `"active:${dayId}"`, calendar strip name join | `day.id` | resume + past-day name |
| `exerciseId` | `ExerciseLog.exerciseId` → `getPreviousWeight` | `exercise.id` | "last weight" history anchor |

Completed sessions denormalize `name` and are read via `completedAt`/`dayId`;
they are **immutable historical rows** — an edit never writes to
`db.completedSessions`. So "corruption" is impossible; the only risk is a **lost
join** from a reminted id.

### Rule — hierarchical normalized-name matching

`assembleEditedRoutine(payload, previous)`:

1. `routine.id` = `previous.id`, `createdAt` = `previous.createdAt` (the routine
   is edited, not recreated).
2. Match each returned day to a previous day by `name.trim().toLowerCase()`;
   reuse its `id`. **Match-and-consume** (remove the matched entry) so a second
   same-named day gets a fresh id instead of a duplicate.
3. Within a matched day, match exercises to that day's previous exercises by
   normalized name (match-and-consume); reuse `id`. Unmatched → fresh
   `crypto.randomUUID()`.
4. Unmatched days → fresh id + all-fresh exercise ids.
5. Sets carry no id — assembled fresh, as today.

Pure, no I/O, unit-testable. Lives beside `assembleRoutine` in `client.ts`.

### Consequence (state explicitly)

- **Common case (targeted edit):** untouched days/exercises keep identical names →
  ids preserved → every session/history/calendar join survives. Only the item the
  user actually changed gets a new id, which is correct — a swapped exercise
  *should* have its own history.
- **If the AI renames an item the user didn't target** (e.g. "Legs" → "Leg Day"):
  its id reminted →
  (a) `getPreviousWeight` returns null for that exercise (its "last weight"
  history anchor is lost until re-logged);
  (b) a **paused in-progress session** on a renamed day orphans — its resume key
  `"active:${oldDayId}"` no longer matches, so it silently won't resume and the
  next entry starts fresh;
  (c) the calendar week strip shows `null` (blank name) for past sessions on that
  day.
  History rows are never altered — only the live-routine join is lost.
- **Accepted** vs. the alternatives: positional matching breaks under
  reorder/insert (a leg-day insert would shift every id); full remint breaks ALL
  anchors on EVERY edit. Undo / reconciliation of a mid-workout edit is an
  explicit non-goal. The edit prompt's "leave untouched everything not mentioned"
  instruction makes stray renames rare.

**Open point (low-risk, flagged not blocking):** we do not actively block editing
while a session for the active routine is paused. Given rename-triggered orphaning
is rare and undo is out of scope, no guard is added now.

---

## D. State & status → **separate edit store, direct-apply**

**Decision.** New `logic/editStore.ts` (Zustand) + `logic/useRoutineEdit.ts`
seam. Do NOT reuse `generationStore`.

**Rationale.** `generationStore.status` drives BUILD-only UI on the same screen —
the frictionless-adopt effect and the `awaitingReplace` branch in
`RoutineHomeScreen` both key off `status === "generating" | "ready"`. An in-flight
edit writing that store would misfire those. The build flow also has a
held-result `ready` gate (`confirmSave`); an edit **direct-applies** and has no
held state. Two lifecycles in one store is more code than a second tiny store.

**Rejected — reuse `generationStore` with an extra `mode` field:** every reader
would need to disambiguate; higher risk than an isolated store.

**Store shape.**

```ts
type EditStatus = "idle" | "editing" | "success" | "error";
interface EditState {
  status: EditStatus;
  error: AiError | null;
  start(): void;                 // → editing
  succeed(): void;               // → success
  fail(error: AiError): void;    // → error
  reset(): void;                 // → idle
}
```

**Direct-apply flow** (in `useRoutineEdit.submit`):

1. Guard: empty/whitespace instruction → no-op (belt-and-suspenders; UI also
   disables the button).
2. `getActive()` → fresh current routine (read from repo, not a stale closure —
   mirrors the workout seam's `getState()` discipline). Null → no-op.
3. `store.start()`.
4. `editRoutine(current, instruction)`.
5. On `ok`: `await saveActive(outcome.routine)` **then** `store.succeed()`. This
   is the ONLY persistence call — no `confirmSave`, no held-result gate. The
   `useActiveRoutine` live query re-emits, updating the routine in place behind
   the (about-to-close) editor.
6. On failure: `store.fail(outcome.error)` — no save, routine unchanged.

---

## E. THE logic↔UI interface (the seam the engineer + designer meet at)

New seam hook `logic/useRoutineEdit.ts`, exported from the feature barrel.

```ts
export type EditStatus = "idle" | "editing" | "success" | "error";

export interface RoutineEdit {
  /** idle before/after; editing while in flight; success once applied; error on failure. */
  status: EditStatus;
  /** Human-readable, edit-flavored message for the current error; null unless status==="error". */
  errorMessage: string | null;
  /**
   * Submit a targeted edit. Reads the current active routine itself, sends it +
   * `instruction` to the AI, and on success persists the id-preserved result
   * DIRECTLY (no confirm). No-op on empty/whitespace or when no routine exists.
   */
  submit: (instruction: string) => Promise<void>;
  /** Return to idle (drop an error / clear after close). */
  reset: () => void;
}

export function useRoutineEdit(): RoutineEdit;
```

**Field-by-field for the designer:**

- `status` — drives everything: `"editing"` locks the textarea + shows the
  edit-verb loading indicator; `"error"` keeps the editor open + shows
  `errorMessage`; `"success"` is the signal to play the close (lower) animation.
- `errorMessage` — already-humanized string (the seam maps `AiError` → copy, so
  the editor UI is pure presentation — unlike the build flow which exposes raw
  `AiError` and maps in the UI; edit copy is edit-flavored, e.g. *"Couldn't apply
  your edit — try again."*, *"You're offline — editing needs a connection."*).
- `submit(instruction)` — the one action. The designer does NOT thread the
  routine; the seam resolves it.
- `reset()` — call after the close animation finishes (or on dismiss) to return
  `status` to `idle`.

**What the seam does NOT own — the editor's open/closed visibility.** That is
LOCAL UI state (`editorOpen` boolean, owned by the home/summary region). The edit
button sets it true; dismiss sets it false. The seam only reports edit *status*.
Interplay:

- Submit → `submit(instruction)`; `status` goes `editing`.
- On `status === "success"` → the UI sets `editorOpen = false` (plays the exit
  animation via the mount lifecycle in §F), then calls `reset()`.
- On `status === "error"` → `editorOpen` stays true; render `errorMessage`;
  textarea re-enabled for retry.

**New barrel exports** (`routine-generation/index.ts`):

```ts
export { useRoutineEdit } from "./logic/useRoutineEdit";
export type { EditStatus, RoutineEdit } from "./logic/useRoutineEdit";
```

Everything else (edit body, `buildEditPrompt`, `editRoutine`,
`assembleEditedRoutine`, `editStore`, id strategy, `saveActive`) stays private
behind the seam. Engineer owns it all; designer consumes only `RoutineEdit`.

---

## F. UI structure notes (constraints only — designer owns implementation)

- **Edit button** sits next to the routine title in `RoutineSummary` (the `<h3>`
  row). Present only when a routine exists (it lives inside `RoutineSummary`,
  which only renders with a routine — AC1.1/1.3 fall out).
- **Composer hidden when a routine exists** (AC1.2): `RoutineHomeScreen` renders
  the `Composer` dock only in the no-routine branch. The `awaitingReplace` scrim
  dialog and its `confirmSave`-on-confirm wiring are **removed** (BREAKING) —
  editing is the single post-creation path.
- **The editor is `position: fixed`, docked bottom** (same slot the old composer
  occupied). It **rises on open / lowers on close** using design-system motion
  tokens (§3.6 `rise`/`ease-out` in, the leaving counterpart out). The routine
  content behind it stays **visible and stationary** — NOT a scrim modal.
  Contrast: the removed `awaitingReplace` used `fixed inset-0` + `rgba(0,0,0,.6)`
  + `aria-modal` (a real dimming dialog); the editor uses none of those.
- **Mount lifecycle (load-bearing — reuse the `ActivityDrawer` pattern):** stay
  mounted through the exit animation and unmount on `onAnimationEnd`; never vanish
  synchronously — otherwise the "animate closed on success" (AC3.5) has nothing to
  play. Under `prefers-reduced-motion` the exit preset drops to `animation: none`
  (fires no `animationend`), so check reduced-motion in JS and unmount
  immediately, exactly as `ActivityDrawer` does.
- **`prefers-reduced-motion`** — transform-based rise/lower drop to instant
  state-change (design-system §Motion).
- **a11y — NOT a modal.** The editor does **not** trap focus and is **not**
  `aria-modal`; the routine behind stays in the tab order and interactive (the
  whole point is editing-while-seeing). Model it as a `role="region"` /
  complementary labelled group, not `role="dialog"`. Focus management: on open,
  move focus to the editor's textarea; on close (success or dismiss), return focus
  to the edit button. `Esc` dismisses (→ `editorOpen = false` + `reset()`).
- **Empty-submit blocked** (AC2.3): reuse the `Composer`'s `canSubmit` guard
  (trimmed non-empty && not busy). The editor is a sibling of `Composer` in shape;
  it may reuse the same field/guard recipe but with the edit button label +
  edit-verb loading indicator.
- **Edit-verb loading indicator** — an edit-flavored counterpart to
  `BuildingIndicator` (verbs like *improving / enhancing / powering*, per the
  proposal), first verb a stable literal for the test assertion. Copy/verbs are
  the designer's; first-cut fallback if scope tightens is reusing the build verbs.

---

## Sequencing (smallest safe increments)

1. **Server + client seam (engineer):** `buildEditPrompt`; `openrouter` `mode`
   branch; `stripToPayload` + `assembleEditedRoutine` (+ its unit tests — this is
   the §C risk surface); `consumeStream` `assemble` param; `editRoutine`.
2. **State seam (engineer):** `editStore` + `useRoutineEdit` (+ barrel exports).
   Now the interface exists; UI can build in parallel from here.
3. **UI (designer):** edit button in `RoutineSummary`; hide `Composer` +
   **remove** the `awaitingReplace` dialog in `RoutineHomeScreen`; the fixed
   floating editor (rise/lower + non-modal focus model); the edit-verb indicator.
4. **E2E (engineer):** routine present → edit button, no composer → open (rises,
   routine visible/stationary) → submit → targeted update applied in place →
   editor closes; plus error keep-open, offline keep-open, empty-submit blocked.

## Firewall check

- Route file unchanged; `openrouter` + `prompt` stay in `api/ai/` (rule 4 intact,
  no new `shared/db`/`*Repo` import). Existing scaffold fixture still covers it.
- `useRoutineEdit` (logic) → `client` + `routineRepo` (api) + `types`: downward
  only. Editor UI → own `logic/` (`useRoutineEdit`) + `shared/ui`: rule 1 intact.
  Cross-feature consumers still touch only the barrel.

## Open question (non-blocking)

No active guard against editing while a paused session exists for the active
routine (§C consequence b). Deferred: rename-triggered orphaning is rare, undo is
a non-goal. Flag if the product owner wants paused-session protection.
