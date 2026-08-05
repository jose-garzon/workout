# Tasks — routine-edit-history

Engineer-only: no new UI screen, only prop plumbing (design.md §Decision 4).
Build order follows design.md's Migration Plan — data + pure fn in workout-mode
(D), then the D seam, then the B seam + server, then composition/props, then
E2E + firewall. Every task is `(engineer)`.

## 1. Completed-session query — workout-mode api (engineer)

- [x] 1.1 (engineer) Add `getCompletedForRoutine(routineId: string, limit: number): Promise<CompletedSession[]>` to `sessionRepo` — read `db.completedSessions` filtered by `routineId`, most-recent-first, capped at `limit`. `sessionRepo` stays the feature's only Dexie caller.
- [x] 1.2 (engineer) Unit-test `getCompletedForRoutine` (fake-indexeddb): filters by `routineId`, orders newest-first, respects the `limit` cap.

## 2. Session summarizer — workout-mode logic (engineer)

- [x] 2.1 (engineer) Add `workout-mode/logic/summary.ts` with pure `summarizeSessions(sessions: CompletedSession[]): string | null` — no I/O, no React. Group by `exerciseId` (chronological); per exercise emit session count, first→last representative weight (last `series` entry with `weightKg > 0` per session) and representative reps; a single-session exercise shows one weight, not an arrow. Weights in canonical kg, no unit conversion. Return `null` for an empty window.
- [x] 2.2 (engineer) Add the session-ratings line to `summarizeSessions` — average `difficulty`/`fatigue` only over sessions that recorded them; omit the line entirely when none did.
- [x] 2.3 (engineer) Add `RECENT_SESSION_LIMIT = 20` (co-located with the summarizer/seam) as the recent-window cap.
- [x] 2.4 (engineer) Unit-test `summarizeSessions`: empty → `null`; single-session (one weight, no arrow) vs. multi-session (first→last arrow); missing/partial `difficulty`/`fatigue` → ratings line omitted, averages taken only over rated sessions; a `weightKg <= 0` set is skipped when picking the representative weight.

## 3. Session-summary seam — workout-mode logic (engineer)

- [x] 3.1 (engineer) Add `workout-mode/logic/useSessionSummary.ts` exporting `useSessionSummary(): string | null` — read the active routine via `useActiveRoutine()` (B barrel, legal D→B), `useLiveQuery` `getCompletedForRoutine(id, RECENT_SESSION_LIMIT)` → `summarizeSessions(...)`; collapse no-routine, first-emit `undefined`, and no-history all to `null`.
- [x] 3.2 (engineer) Export `useSessionSummary` from `workout-mode/index.ts` (seam hook only — no new type; it returns `string | null`).
- [x] 3.3 (engineer) Integration-test `useSessionSummary` (fake-indexeddb): no routine → `null`; routine + zero sessions → `null`; routine + sessions → non-null string; re-emits when a completed session is added mid-mount (live query).

## 4. Edit request threading — routine-generation seam + server (engineer)

- [x] 4.1 (engineer) Extend `editRoutine(current, instruction, sessionSummary?: string | null)` in `api/ai/client` — include `sessionSummary` on the edit body only when it is a non-empty string; omit the field otherwise (no "no history" marker).
- [x] 4.2 (engineer) Extend the B seam `RoutineEdit.submit(instruction: string, sessionSummary?: string | null): Promise<void>` and `useRoutineEdit` as a thin pass-through — forward the string to `editRoutine`, nothing else changes; the barrel signature stays backward-compatible (existing zero-summary callers still type-check).
- [x] 4.3 (engineer) Extend `parseEditBody` to read `sessionSummary` only when `typeof === "string"` && non-empty, passing it (or `undefined`) to `buildEditPrompt`; no other validation. Body without `sessionSummary` still parses as today.
- [x] 4.4 (engineer) Extend `buildEditPrompt(instruction, routine, sessionSummary?)` to append a `"Recent workout history:\n<summary>"` block to the **user** message only when present, and add one sentence to `EDIT_SYSTEM_PROMPT` ("If recent workout history is provided, take it into account when applying the change"). Leave `OUTPUT_CONTRACT`, `SCHEMA_SHAPE`, `EXAMPLE`, `routineJsonSchema`, and `response_format` byte-for-byte unchanged.
- [x] 4.5 (engineer) Unit-test the parse + prompt branch: `sessionSummary` present → it appears in the prompt and the edit body parses; absent/empty → the prompt is byte-identical to today's history-less edit and the body still parses.
- [x] 4.6 (engineer) Contract-guard test: an edit WITH `sessionSummary` still validates through the unchanged Zod path (`routineSchema.parse`) and id-preserving `assembleEditedRoutine`; a malformed response is still rejected and the active routine left unchanged (AC3.1/3.2).

## 5. Composition + prop plumbing (engineer)

- [x] 5.1 (engineer) In `app/page.tsx` `Home()`: `const sessionSummary = useSessionSummary();` (from `workout-mode`'s barrel) and pass it as a prop to `RoutineHomeScreen`.
- [x] 5.2 (engineer) Add `sessionSummary?: string | null` to `RoutineHomeScreenProps` (same shape as `weekStrip`/`onEditProfile`) and forward it to `RoutineEditor`.
- [x] 5.3 (engineer) Add `sessionSummary?: string | null` to `RoutineEditorProps`; `RoutineEditor.handleSubmit` calls `void submit(text.trim(), sessionSummary ?? null)`. No visual or behavioral UI change beyond forwarding the prop.

## 6. E2E + firewall sanity (engineer)

- [x] 6.1 (engineer) Extend `e2e/edit-routine.spec.ts`: add `sessionSummary?: string` to the captured `EditBody`; seed one or more completed sessions on-device (IndexedDB) before opening the editor and assert the edit request body carries `sessionSummary`; assert an edit with no seeded history omits `sessionSummary` (AC1.1 / AC2.1). Also assert the ONLY network request made during submit is the existing proxy call (`/api/generate-routine`) — no other endpoint is hit (AC4.1/4.2).
- [x] 6.2 (engineer) Firewall/architecture sanity: confirm no B→D edge was introduced (`depcruise` clean, `no-circular` holds) and `route.ts`/`openrouter.ts`/`prompt.ts` still import only `api/ai/{prompt,schema,errors}` — never `shared/db` or any `*Repo` (Biome + `firewall:proof` pass).
