# Proposal — routine-edit-history (edits informed by workout history)

## Why

Today an AI edit sends only the current routine + the typed instruction, so an
instruction like "the bench has felt heavy, lighten it" or "adjust based on how
it's been going" gets no signal from what the user actually did. Feeding the
user's completed-session history for the active routine into the edit lets the AI
respond to real adherence and weight/reps/difficulty trends, not just the static
routine structure.

## What Changes

- A submitted edit now also sends a **summary of the completed-session history**
  for the active routine (per-exercise logged weights/reps, adherence, and
  difficulty/fatigue ratings where recorded) alongside the current routine + the
  instruction. The edit response can reflect what the user actually logged.
- The summary is **computed on-device** and sent to the **same existing
  stateless AI proxy** — no new network call, no server-side persistence.
- When there is **no completed history yet** (e.g. the first edit after a routine
  is created), the edit proceeds exactly as today; the summary is omitted (or an
  explicit "no history yet" marker sent). No error, no blocked submit.
- The **response contract is unchanged**: the session-aware edit is held to the
  same strict JSON routine contract as build and history-less edits
  (`response_format: json_schema` + client-side Zod validation). *No JSON gap was
  found* — build and edit already share one proxy path and one validator; this
  change must not weaken that, and adds session data only to the request INPUT.
- Existing edit behavior is retained: only the requested change is applied, and
  ids for unchanged days/exercises are preserved so history stays linked.

## Capabilities

### New Capabilities

- `session-aware-editing`: an active-routine edit factors in the user's
  completed-session history — an on-device summary is included in the edit
  request, the edit still works with zero history, the strict JSON response
  contract is preserved, and nothing about history leaves the browser except via
  the existing AI proxy.

### Modified Capabilities

None recorded here. The edit surface itself (`routine-editing`) is introduced by
the `edit-routine` change, which is **not yet archived** — its spec is not in
`openspec/specs/` yet, so there is no spec file to delta. This change layers on
it via the new capability above and **depends on `edit-routine` being archived
first** (see Impact). If, at design time, `routine-editing` is already a live
spec, the architect may fold the "what the edit request sends" scenario in as a
delta instead of a standalone spec — that is a how/sequencing call.

## User stories & acceptance criteria

**Story 1 — history informs the edit.** *As a user, I want my edits to account
for how my workouts have actually gone, so a vague "adjust based on how it's been
going" does something useful.*

- **AC1.1** GIVEN an active routine with one or more completed sessions WHEN the
  user submits an edit THEN the request to the AI includes a summary of the
  active routine's completed-session history, in addition to the current routine
  and the instruction.
- **AC1.2** GIVEN completed-session history WHEN the summary is built THEN it
  reflects what the user recorded — per-exercise logged weights/reps, adherence
  (sessions completed), and difficulty/fatigue ratings where present — using only
  data workout-mode already stores.
- **AC1.3** GIVEN an instruction that references the user's experience (e.g. "ease
  off the bench, it's felt heavy") WHEN the edit is dispatched THEN the history
  summary is part of the payload the model sees, so the response can be informed
  by it rather than the static routine alone.

**Story 2 — first edit / no history.** *As a user editing a brand-new routine, I
don't want history-awareness to get in my way.*

- **AC2.1** GIVEN an active routine with zero completed sessions WHEN the user
  submits an edit THEN the edit proceeds normally, the request omits the history
  summary (or carries an explicit "no history yet" marker), and no error is shown
  and submission is not blocked.

**Story 3 — strict, consistent JSON.** *As a user, I want the edited routine to
apply reliably regardless of whether history was included.*

- **AC3.1** GIVEN a session-aware edit WHEN the AI responds THEN the response is
  held to the same strict JSON routine contract as build and history-less edits;
  a malformed response is rejected and surfaced as an error, and the active
  routine is left unchanged.
- **AC3.2** GIVEN a session-aware edit that succeeds WHEN it is applied THEN only
  the requested change takes effect and ids for unchanged days/exercises are
  preserved (existing edit behavior is retained).

**Story 4 — local-first.** *As a user, I want my logged history to stay on my
device.*

- **AC4.1** GIVEN a session-aware edit WHEN it is dispatched THEN the summary is
  computed on-device and sent ONLY to the existing stateless AI proxy — no new
  network call and no server-side persistence.
- **AC4.2** GIVEN completed sessions on-device WHEN no edit is in progress THEN
  nothing about session history leaves the browser.

## Non-goals

- **No history-aware routine BUILD.** History informs edits only; first-generation
  is unchanged (decided above).
- **No proactive or automatic edits.** The user authors every edit; history only
  informs the model's response.
- **No new metrics or logging.** Summarizes only what workout-mode already
  records — no new fields, no new capture.
- **No change to the response/output contract or routine shape.**
- **No cross-routine or multi-routine history** (one active routine).
- **No conversational memory / multi-turn** — each edit is one request.
- **No network beyond the existing AI proxy; no server persistence.**

## Decisions (resolved)

- **History window: recent, not all-time.** The summary covers a recent window
  (last N sessions / last few weeks — exact cutoff is the architect's call) to
  keep the summary focused and the payload small.
- **Edit only — build is unchanged.** History informs edits only. A fresh
  routine has little/no history, so first-generation stays as-is (confirms the
  Non-goals entry above).
- **Trend summary, not fuller per-set detail.** Per exercise: a compact trend
  (e.g. "Bench Press: 3 sessions, 60kg→65kg, avg fatigue 4/5"), not raw per-set
  logs — smaller payload, still enough signal for the model.

## Impact

- **Edit request** — the edit body now also carries an on-device session summary.
  The exact seam/prop wiring is the architect's `design.md`.
- **workout-mode (Feature D)** — exposes completed-session history
  (`CompletedSession` / `ExerciseLog` / `SeriesLog`, difficulty/fatigue) through
  its public barrel for the composition layer to read. No new logging.
- **Composition layer (`app/page.tsx`)** — wires session data down into the edit
  call, as it already wires cross-feature props. Architecture constraint the
  design must honor: `routine-generation` must NOT import `workout-mode` (would
  create a cycle blocked in CI); data flows D → composition → the edit call,
  preserving the acyclic `A ← B ← D ← C` direction.
- **AI edit prompt** — gains a session-summary section in the request; the output
  contract and `response_format: json_schema` + Zod validation are unchanged.
- **Sequencing** — depends on the `edit-routine` change being archived first, so
  the edit surface this extends is live.
- **Local-first / proxy** — unchanged: still one stateless network call, no
  server-side persistence.
