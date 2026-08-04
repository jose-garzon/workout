# Proposal — edit-routine (edit the active routine via the AI chatbox)

## Why

Once a routine exists, the only way to change it today is a full regenerate that
discards it. Users want to nudge one thing ("swap dumbbells for machines on leg
day") without rebuilding from scratch. This turns the post-creation surface into
an **edit** affordance: the standing build composer is replaced by an edit button,
and tapping it floats a fixed editor over the visible routine so the user can see
what they're changing while they type a targeted instruction.

## What Changes

- **BREAKING** — The prompt composer no longer persists once a routine exists.
  When there's an active routine, home shows an **edit button next to the routine
  title** instead of the standing composer. (No routine → the build composer is
  shown as before.)
- **BREAKING** — The "Replace your routine?" confirm flow for
  regenerating-while-a-routine-exists is removed. Editing is the single
  post-creation path to modify a routine.
- Tapping edit reveals a **floating, fixed editor** docked at the bottom (same
  position as the old composer) that **rises up from the bottom** on open and
  animates back down on close. The routine stays **visible and stationary**
  behind it (not a dimmed modal).
- Submitting an edit sends the **current routine + the typed instruction** to the
  AI and applies **only the requested change** — parts of the routine the user
  didn't reference stay unchanged.
- An edit **applies directly** (no confirmation dialog) — see Decision 1.
- While the edit runs, the loading state uses **edit-specific verbs** (improving,
  enhancing, powering…), distinct from the build verbs.
- On success the editor **animates closed** and home returns to the normal
  routine view + edit button.
- On failure the editor **stays open** with a human-readable message; the routine
  is left unchanged so the user can retry.

## Product decisions (resolved)

1. **Edits apply directly — no confirm dialog.** The confirmation gate exists to
   guard *discarding a whole routine* on a fresh generation. An edit is
   user-authored, user-sent, targeted, and the routine survives — the user sees
   the before (routine behind the editor) and the after (in-place update), so the
   change is neither silent nor destructive. This satisfies config's "no silent
   changes" (the user drives and observes it) while dropping friction the request
   doesn't want. No undo (non-goal).
2. **Completed-session history / in-progress sessions vs. an edited routine —
   deferred to design.** Completed sessions are historical records and must not be
   rewritten; how an in-progress workout reconciles with a routine that changed
   under it is a *how* question. Flagged for the architect, out of scope here.
3. **A failed or empty edit keeps the editor open.** Empty/whitespace can't submit
   (same rule as the composer). On AI error or offline, the routine is unchanged
   and the editor stays open so the user can retry or dismiss.

## Capabilities

### New

- `routine-editing` — the post-creation edit surface: the edit button (shown only
  when a routine exists), the floating fixed editor that rises from the bottom
  over the visible routine, sending the current routine + instruction to the AI,
  the targeted in-place update, edit-specific loading verbs, direct-apply on
  success, and error/offline handling that preserves the routine. Local-first: the
  only network call is the existing AI proxy; nothing else leaves the browser.

### Modified

- `routine-generation` — **BREAKING**. The "Composer remains available with a
  routine present" scenario is replaced: when a routine exists the standing
  composer is **hidden** in favor of the edit affordance. The build composer still
  shows when no routine exists.
- `active-routine` — **BREAKING**. The regenerate-while-routine-exists "Replace
  your routine?" explicit-confirmation requirement is **removed** — editing is the
  single post-creation path (the confirm requirement lives in this capability, not
  `routine-generation`).

## User stories & acceptance criteria

**Story 1 — enter edit mode.** *As a user with a routine, I want an edit button by
my routine title so I can ask for a change.*

- **AC1.1** GIVEN an active routine WHEN home is shown THEN an edit button is
  present next to the routine title.
- **AC1.2** GIVEN an active routine WHEN home is shown THEN the standing build
  composer is NOT shown.
- **AC1.3** GIVEN no active routine WHEN home is shown THEN no edit button is shown
  and the build composer is present (existing behavior).

**Story 2 — the floating editor.** *As a user, I want a fixed editor at the bottom
so I can see my routine while I type.*

- **AC2.1** GIVEN an active routine WHEN the user activates the edit button THEN a
  fixed editor docked at the bottom appears, animating upward from the bottom.
- **AC2.2** GIVEN the editor is open WHEN the user reads the screen THEN the
  routine content is visible behind the editor and does not move or scroll while
  the editor is open.
- **AC2.3** GIVEN the editor is open with no text (or only whitespace) WHEN the
  user attempts to submit THEN no request is made and submission does not proceed.
- **AC2.4** GIVEN the editor is open WHEN the user dismisses it without submitting
  THEN it animates closed, the routine is unchanged, and home returns to the edit
  button.

**Story 3 — targeted AI edit.** *As a user, I want to describe a change and have
only that change applied.*

- **AC3.1** GIVEN a non-empty instruction in the editor WHEN the user submits THEN
  the system sends the current active routine together with the instruction to the
  AI backend.
- **AC3.2** GIVEN a submitted edit WHEN the backend returns a valid updated routine
  THEN the active routine reflects the requested change and the parts of the
  routine the instruction did not reference remain unchanged.
- **AC3.3** GIVEN a submitted edit WHEN it succeeds THEN the update is applied
  directly with no confirmation dialog.
- **AC3.4** GIVEN an edit request in progress WHEN the loading state is shown THEN
  it uses edit-specific verbs (e.g. improving, enhancing, powering) distinct from
  the build verbs.
- **AC3.5** GIVEN an edit request in progress WHEN it succeeds THEN the editor
  animates closed (downward) and home returns to the normal routine view + edit
  button.

**Story 4 — edit failures.** *As a user, I want a failed edit to keep my routine
and let me retry.*

- **AC4.1** GIVEN an edit request in progress WHEN the backend returns an error
  THEN a specific human-readable message is shown, the active routine is unchanged,
  and the editor stays open so the user can retry.
- **AC4.2** GIVEN the device is offline WHEN the user submits an edit THEN the
  system indicates a connection is required, makes no network call, leaves the
  routine unchanged, and keeps the editor open.

## Impact

- **Home** — when a routine exists, the standing composer is replaced by an edit
  button next to the routine title; the floating fixed editor overlays the visible
  routine. No routine → unchanged build flow.
- **routine-generation module** — new edit seam (send current routine +
  instruction, persist the updated routine); a new AI prompt/verb set for editing
  reusing the existing stateless proxy route and Zod validation. *Exact
  seam/prompt/schema are the architect's `design.md`.*
- **AI prompt** — a new edit prompt instructing targeted modification of a supplied
  routine (vs. build-from-scratch).
- **Testing** — Playwright over: routine present → edit button (no composer) →
  open editor (rises, routine visible/stationary) → submit → targeted update
  applied → editor closes; plus error/offline keep-open and empty-submit blocked.

## Non-goals

- **No undo / edit history.** Edits apply in place; no revert, no diff log.
- **No direct manipulation.** No drag/tap-to-edit of exercises or sets — edits are
  AI-mediated via free text only.
- **No conversational memory.** Each edit is a single request against the current
  routine; no multi-turn chat thread.
- **No multiple routines / switching** (locked: one active routine).
- **No reconciliation of edited exercises with completed-session history or an
  in-progress workout** — deferred to design (Decision 2).
- **No separate build-from-scratch affordance once a routine exists** — editing is
  the post-creation path (Decision 1 / open question).
- **No network beyond the existing AI proxy.**

## Open question for the user

Once a routine exists, is the edit editor the **only** way to fully replace it
(e.g. "replace the whole thing with a 5-day PPL"), or should a separate "start
over / replace" affordance remain? Default chosen: the edit editor is the single
post-creation path and broad edits apply directly — which is why the old "Replace
your routine?" confirm flow is removed (BREAKING). Confirm if you want a distinct
replace path kept.

## Priority

Smallest slice that delivers the request: edit button (composer hidden when a
routine exists) → floating fixed editor rising from bottom over the stationary
routine → send-current-routine-plus-instruction → targeted direct-apply with
edit verbs → close on success, keep-open on error. **Not cuttable:** the edit
button + floating editor + targeted update — that is the feature. First cut if
scope tightens: the edit-specific verb set (fall back to the build verbs).
