# Design — routine-edit-history

Feed the active routine's completed-session history into an AI edit. The edit
machinery already exists (archived `edit-routine` design.md §B/§C/§E); this change
adds ONE optional string — a client-computed history summary — to the edit
request. No new route, no new response contract, no new AI client, no UI screen.

## Context (what already exists, reused as-is)

- **Edit path (routine-generation, Feature B).** `editRoutine(current, instruction)`
  → `postToProxy({ mode: "edit", instruction, routine })` → `consumeStream` →
  Zod → id-preserving `assembleEditedRoutine`. Server: `parseEditBody` →
  `buildEditPrompt(instruction, routine)`, one stateless proxy route. Seam:
  `useRoutineEdit().submit(instruction)`. UI: `RoutineEditor` (floating editor),
  mounted as a sibling in `RoutineHomeScreen`.
- **Session history (workout-mode, Feature D).** `CompletedSession[]` in
  `db.completedSessions` — each carries `exerciseLogs[].series[].weightKg/reps`
  and optional session-level `difficulty`/`fatigue`. `sessionRepo` is the only
  Dexie caller; `getPreviousWeight` already scans all completed sessions
  newest-first. There is **no** "all completed sessions for a routine" query yet.
- **Invariant that simplifies everything:** the active routine is a singleton row
  keyed `"active"` (`routineRepo` overwrites `id` with `ACTIVE_ID`). So
  `routine.id` is ALWAYS `"active"`, and every `CompletedSession.routineId` is
  `"active"` too — there is only ever one routine's history on the device.
- **Dependency direction is fixed: `A ← B ← D ← C`** (dependency-cruiser
  `no-circular`, CI-failing). `workout-mode` (D) already imports
  `routine-generation` (B); therefore **B must never import D** — not even a type.

## Goals / Non-Goals

**Goals.** An edit request carries a compact, on-device trend summary of the
active routine's recent completed sessions (AC1). Edits still work with zero
history (AC2). The strict JSON response contract and id-preservation are
untouched (AC3). Nothing about history leaves the browser except via the existing
proxy (AC4).

**Non-Goals.** No history-aware *build*. No new metrics/logging. No response/shape
change. No new route. No conversational memory. No new UI screen or visual change
(only prop plumbing changes).

---

## The crux — how history reaches the edit WITHOUT B importing D

`useRoutineEdit()` lives in B and cannot reach into D to fetch sessions. The
summary is therefore computed entirely in D (which may import B), handed to the
**app composition layer**, and threaded down as a **plain `string | null`** — the
exact pattern already used for `weekStrip` and `onEditProfile`. `string` is not a
workout-mode type, so B's public API stays D-free and the graph stays acyclic.

```
 workout-mode (D)                app/page.tsx            routine-generation (B)
 ─────────────────               ─────────────           ──────────────────────
 sessionRepo                     Home()
   getCompletedForRoutine ─┐       const s =
 logic/summary.ts          │        useSessionSummary()   RoutineHomeScreen
   summarizeSessions ──────┤          │  (string|null)      sessionSummary prop
 logic/useSessionSummary ──┘          ▼                       │
   (useLiveQuery + useActiveRoutine)  ──sessionSummary prop──▶ RoutineEditor
   returns string | null                                        submit(text, s)
                                                                   │
                                        editRoutine(cur,instr,s) ◀─┘
                                        body.sessionSummary (string, optional)
                                          │
                                          ▼  (existing proxy, unchanged route)
                                        parseEditBody → buildEditPrompt(...,s)
```

D → composition → B. No arrow from B to D anywhere. This is the whole design.

---

## Decision 1 — the raw query lives in workout-mode's `sessionRepo`

**Add** `getCompletedForRoutine(routineId: string, limit: number): Promise<CompletedSession[]>`
— completed sessions for `routineId`, **most-recent first, capped at `limit`**.
Filtering by `routineId` mirrors the AC ("the active routine's history") and
matches how `getPreviousWeight` already reads `db.completedSessions`.

**Rejected — reuse `getPreviousWeight`:** it returns one number for one exercise;
the summary needs whole sessions across many exercises. Wrong shape.

**Rejected — a Dexie query in the hook directly:** `sessionRepo` is the feature's
*only* Dexie caller by contract (firewall/layering). Keep it that way.

## Decision 2 — the summary is a compact per-exercise trend string (pure fn)

**Add** `workout-mode/logic/summary.ts`:
`summarizeSessions(sessions: CompletedSession[]): string | null`. Pure, no I/O,
no React — unit-testable in isolation. Returns `null` for an empty window.

Format (proposal's "trend, not per-set detail" decision), weights in canonical
**kg** (no unit conversion — this is model context, not user display; keeps the
function pure and dependency-free):

```
Recent history (last N sessions):
- Bench Press: 4 sessions, 60→67.5 kg, ~8 reps
- Back Squat: 3 sessions, 80→90 kg, ~5 reps
Session ratings: avg difficulty 3.6/5, avg fatigue 4.1/5 (over 5 rated sessions).
```

Per exercise (grouped by `exerciseId` across the window, chronological): session
count, first→last representative weight (the last `series` entry with
`weightKg > 0` per session — "what you finished on", matching `getPreviousWeight`
semantics), and representative reps. Session ratings averaged only over sessions
that recorded them; the ratings line is omitted if none did. A single-session
exercise shows one weight, not an arrow. Exact numeric edge-cases are the
engineer's, pinned by unit tests.

**Rejected — raw per-set logs:** larger payload, more noise, no better signal
(proposal decision). **Rejected — convert to user units:** would drag the unit +
profile dependency into a pure summarizer for zero model benefit.

## Decision 3 — the seam is a self-resolving hook, no argument

**Add** `workout-mode/logic/useSessionSummary.ts`, exported from D's barrel:

```ts
export function useSessionSummary(): string | null;
```

It reads the active routine via `useActiveRoutine()` (B's barrel — a **legal
D→B** import, same as `useCalendar` and `model.ts` already do), takes its `id`,
`useLiveQuery`s `getCompletedForRoutine(id, RECENT_SESSION_LIMIT)`, and returns
`summarizeSessions(...)`. `null` when there is no routine **or** no history — so
the composition layer needs zero branching.

```ts
const routineId = useActiveRoutine().routine?.id ?? null;
const summary = useLiveQuery(async () => {
  if (routineId === null) return null;
  return summarizeSessions(
    await getCompletedForRoutine(routineId, RECENT_SESSION_LIMIT),
  );
}, [routineId]);
return summary ?? null;   // undefined (first emit) also collapses to null
```

**Why no `routineId` argument:** `routine.id` is always `"active"`; forcing the
caller to fetch and pass a constant is ceremony. Self-resolving keeps `Home()` a
one-liner. The hook already sits in D, which is allowed to depend on B, so
resolving the routine internally costs nothing and stays acyclic.

**Rejected — `useSessionSummary(routineId)`:** pushes an always-constant id onto
the composition layer and makes it read `useActiveRoutine` redundantly.
**Rejected — a pure/non-hook `getSessionSummary()`:** the editor must reflect
history logged *after* mount without a manual refetch; `useLiveQuery` (as
everywhere else in this app) gives that for free.

**Recent window: the 20 most-recent completed sessions** (`RECENT_SESSION_LIMIT
= 20`). Bounds the summarization work and payload regardless of training
frequency, while covering several weeks. Rejected — a time cutoff (last N days):
needs a live clock and gives an unbounded session count for frequent lifters; a
fixed cap is simpler and predictable. Tunable literal, not load-bearing.

## Decision 4 — thread `sessionSummary` as an optional `string`

The summary rides through as a plain optional string at every hop — no new type
crosses a feature boundary:

| Layer | Change |
|---|---|
| `app/page.tsx` `Home()` | `const sessionSummary = useSessionSummary();` → pass as prop |
| `RoutineHomeScreenProps` | add `sessionSummary?: string \| null` (same shape as `weekStrip`/`onEditProfile`), forward to `RoutineEditor` |
| `RoutineEditorProps` | add `sessionSummary?: string \| null` |
| `RoutineEditor.handleSubmit` | `void submit(text.trim(), sessionSummary ?? null)` |
| `RoutineEdit.submit` (B seam) | `submit(instruction: string, sessionSummary?: string \| null): Promise<void>` |
| `editRoutine` (B client) | `editRoutine(current, instruction, sessionSummary?)` |

The seam signature gains a **second optional string** — `useRoutineEdit` stays a
thin pass-through (it forwards the string to `editRoutine`; it never learns where
it came from). No workout-mode type touches B's public API.

**Rejected — the UI pre-concatenates history into the instruction string before
`submit`:** hides history inside the free-text field, so the server can't frame it
as distinct context and the seam signature lies about what's being sent. A named,
optional parameter is honest and keeps prompt framing server-side.

## Decision 5 — server: one optional field, contract unchanged

- **Edit body:** `{ mode: "edit", instruction, routine, sessionSummary?: string }`.
- `parseEditBody` reads `sessionSummary` only if `typeof === "string"` &&
  non-empty; passes it (or `undefined`) to `buildEditPrompt`. Not validated
  beyond "is a non-empty string" — it is the user's own on-device text, echoed as
  prompt context, exactly like `routine`.
- `buildEditPrompt(instruction, routine, sessionSummary?)` appends a
  `"Recent workout history:\n<summary>"` block to the **user** message only when
  present. `EDIT_SYSTEM_PROMPT` gains one sentence: *"If recent workout history is
  provided, take it into account when applying the change."*
- **`OUTPUT_CONTRACT`, `SCHEMA_SHAPE`, `EXAMPLE`, `routineJsonSchema`,
  `response_format: json_schema`, and client-side `routineSchema.parse` are
  byte-for-byte unchanged** (AC3.1). History is INPUT only; the output path is not
  touched. `assembleEditedRoutine` id-preservation is unchanged (AC3.2).

**No-history case (AC2.1): the field is OMITTED.** `useSessionSummary` returns
`null` → `submit(text, null)` → `editRoutine` leaves `sessionSummary` off the body
→ the request is byte-identical to today's history-less edit. No "no history"
marker: an absent section is unambiguous and needs no special server handling.

**Rejected — a second `/api/edit-history` route:** the proposal forbids it and it
would duplicate env/rate-limit/stream wiring and add a second firewall fixture.
One optional field on the existing handler is strictly smaller.

---

## Barrel & seam surface (the exact public deltas)

- **`workout-mode/index.ts`** — add `export { useSessionSummary } from
  "./logic/useSessionSummary";`. No new type (returns `string | null`). Nothing
  else in D's public surface changes.
- **`routine-generation/index.ts`** — no new export; the exported `RoutineEdit`
  interface's `submit` gains a second optional param (backward-compatible —
  existing zero-arg-summary callers still type-check).
- **No new visual UI.** `RoutineEditor` is unchanged except the one `submit`
  argument; designer work is limited to accepting/forwarding the new prop.

---

## Risks & Tradeoffs

- **Stale-window signal.** A 20-session cap can drop older history for very
  frequent lifters. Accepted: "recent" is the point (proposal decision); trends,
  not archives.
- **Renamed exercise loses its trend row.** `summarizeSessions` groups by
  `exerciseId`; if an earlier edit reminted an exercise's id (archived
  edit-routine §C consequence), its pre-rename history won't group with the
  current id. Accepted — it's the same join-loss already documented and
  out-of-scope to reconcile here; the summary just reflects post-rename history.
- **kg-only weights.** The model sees kg even for imperial users. Accepted:
  internal context, not display; conversion would pollute a pure function.
- **Payload growth.** Bounded by distinct-exercise count (a compact line each),
  not session count — negligible next to the routine JSON already sent.

**Testing (flag for `tasks.md`, not written here):**
1. **Unit** — `summarizeSessions`: empty → `null`; single vs. multi-session weight
   arrow; missing/partial `difficulty`/`fatigue` (ratings line omitted); a
   `weightKg <= 0` set skipped (matches `getPreviousWeight`).
2. **Integration** — `useSessionSummary` with `fake-indexeddb`: no routine →
   `null`; routine + zero sessions → `null`; routine + sessions → non-null string;
   re-emits when a session is added mid-mount (live query).
3. **Contract guard** — an edit WITH `sessionSummary` still hits the unchanged Zod
   path; a malformed response is still rejected (AC3.1). Existing edit e2e extended
   to assert the request body carries `sessionSummary` when history exists and
   omits it when none does (AC1.1 / AC2.1).

## Migration Plan (smallest safe increments)

1. **D data + pure fn (engineer):** `getCompletedForRoutine` in `sessionRepo`;
   `logic/summary.ts` + unit tests. No wiring yet.
2. **D seam (engineer):** `useSessionSummary` + barrel export + integration test.
3. **B seam + server (engineer):** extend `submit`, `editRoutine`,
   `buildEditPrompt`, `parseEditBody` with the optional string. Contract assertions.
4. **Composition + props (designer/engineer):** `Home()` calls the hook;
   `RoutineHomeScreen`/`RoutineEditor` forward the prop; `RoutineEditor.handleSubmit`
   passes it to `submit`.
5. **E2E:** extend the existing edit test — body carries/omits `sessionSummary`.

## Firewall check

- **No B→D edge added** — B receives only a `string`. `no-circular` holds; the
  crux is satisfied by construction.
- `useSessionSummary` (D/logic) imports `sessionRepo` + `summary` (own api/logic,
  downward) + `@/modules/routine-generation` barrel (D→B, legal, no cycle).
- Route file + `openrouter.ts` + `prompt.ts` still import only `api/ai/*`
  (rule 4 intact — no `shared/db`/`*Repo`). Summary is computed in the browser and
  sent only via the existing proxy (AC4.1/4.2).
- Cross-feature reads stay barrel-only: `Home()` uses `workout-mode`'s barrel;
  `RoutineHomeScreen`/`RoutineEditor` receive a prop and import no other feature.

## Open Questions

None blocking. The archived edit-routine open point (no guard on editing while a
paused session exists) is unchanged and out of scope here.
