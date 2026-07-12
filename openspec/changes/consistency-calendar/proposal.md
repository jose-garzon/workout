# Proposal — consistency-calendar (Feature C: the consistency tracker)

> Last real user feature in the locked build order (A → B → D → **C**). Features A–D
> made a plan, generated a routine, and turned each day into a guided, recorded
> workout. Those workouts now pile up as `completedSessions` in the browser with
> nothing showing the user their follow-through. This change surfaces that: a
> 7-day strip on home and a full-year activity grid in a drawer. The *how* (the
> `useCalendar` seam already frozen as a stub, the Dexie aggregation, the drawer
> mechanics, the `dayId → RoutineDay.name` join) is the architect's `design.md`;
> this proposal owns *what & why* and the acceptance gate.

## Why

The whole point of a routine is showing up. Feature D records every finished
session on-device, but the user never sees the pattern — did I train this week?
Am I keeping it up? Consistency is the retention loop the product promises
("a calendar that tracks consistency") and nothing renders it yet. This change
gives the user two glances: **this week** at home, and **the whole year** on
demand — both read-only, both celebrating what they actually did, never nagging
about what they missed.

## Target user

The **intermediate gym-goer** (locked persona) — efficiency over hand-holding,
allergic to guilt-driven scheduling. They train whenever; the tracker rewards
consistency without imposing a schedule (no planned days, no missed-day shaming).

## What changes

- **A 7-day week strip on home**, placed **between** the identity block (greeting
  + goal badge + motivation line) and the routine summary.
- **Seven day cells** for the current week. A day with no completed session is a
  **muted placeholder**; a day with a completed session is painted in the
  **accent** color and shows two lines — the **day label** (e.g. "Sat 11 Jul")
  and the **session name** performed that day (e.g. "Lower A", the routine day's
  name joined via `dayId`).
- **A "N of M this week" counter** alongside the week strip — N = distinct days
  this week with ≥1 completed session, M = the weekly target derived from the
  active routine.
- **Tapping the strip opens a drawer** containing the full-year **activity
  tracker**: a title, a short description, and a vertical grid of day squares
  laid out as **rows of 7** (one square per day), rows running top-to-bottom from
  **January to December** of the current calendar year. Days with a completed
  session are accent; all others are muted.
- **The drawer animates in and out** and is dismissible (backdrop, close control,
  and Esc).
- The frozen `useCalendar` seam gets its real implementation behind the signature
  the foundation already declared.

## Key decisions (resolved defaults)

Product calls that shape the specs. Sensible defaults chosen — flagged for review.

1. **Two sessions on one day → the strip square shows the most-recently-completed
   session's name.** A day is binary worked/not — a second session doesn't change
   the accent fill; the second line simply reflects the latest session's name.
   No count badge (keeps the cell glanceable). *Alternative — showing a "+1"
   marker — cut as clutter for a rare case.*
2. **Weeks start Monday** (ISO). The current-week strip runs Monday→Sunday, and
   the year grid's rows of 7 align Monday-first. *Rationale: a training week reads
   as Mon–Sun; consistent with a gym mental model.*
3. **The year grid is the current calendar year only** — Jan 1 to Dec 31. No
   prior/next-year navigation, no rolling 12-month window. *Simplest thing that
   matches the request; multi-year is a non-goal.*
4. **Individual year-grid squares are non-interactive** — accent if worked, muted
   if not, no tooltip/tap detail. The drawer is a read-only overview; day-level
   detail already lives in the home strip. *Keeps the drawer minimal.*
5. **The weekly target M = the active routine's day count** (`Routine.days.length`
   — e.g. a 4-day routine → "N of 4 this week"). WHEN no active routine exists,
   the counter is **hidden** (there is no target to count against, and home
   already shows a build-a-routine invitation in that state). *Reuses the frozen
   `ConsistencySummary` stub's `weeklyTarget`/`weeklyCompleted` conceptually;
   `currentStreakWeeks` stays out of scope — still no streaks.*

## Capabilities

### New Capabilities

- `consistency-tracker`: the home-surface consistency views over completed
  sessions — the current-week 7-day strip (muted placeholder vs. accent
  worked-day with day-label + session-name), the "N of M this week" counter
  (distinct worked days vs. the routine-derived weekly target), and the full-year
  activity drawer (title + description + vertical 7-wide Jan→Dec grid, worked days
  accent), including the drawer's open/close animation and dismissal. Read-only,
  browser-only, no network.

### Modified Capabilities

None. Home already renders the identity header and routine summary
(`home-routine-dashboard`); this inserts a new surface between them without
changing those requirements.

## User stories & acceptance criteria

**Story 1 — glance at this week.** *As a returning user, I want to see which days
I trained this week so I know if I'm keeping up.*

- **AC1.1 — strip renders.** GIVEN home is shown WHEN the page loads THEN a
  7-cell week strip appears between the identity block and the routine summary.
- **AC1.2 — worked day.** GIVEN a day in the current week has ≥1 completed session
  WHEN the strip renders THEN that day's cell is filled in the accent color and
  shows two lines: the day label (e.g. "Sat 11 Jul") and the session name
  performed that day.
- **AC1.3 — un-worked day.** GIVEN a day in the current week has no completed
  session WHEN the strip renders THEN that day's cell is a muted placeholder with
  no session name.
- **AC1.4 — two sessions one day.** GIVEN a day has two completed sessions WHEN
  the strip renders THEN the cell is accent and its second line shows the
  most-recently-completed session's name.

**Story 1b — am I on target this week?** *As a user with a routine, I want to see
how many of my target sessions I've done this week so I know if I'm on pace.*

- **AC1b.1 — counter shown.** GIVEN an active routine with M days WHEN the strip
  renders THEN a "N of M this week" counter appears with the strip, where N is the
  number of distinct days this week with ≥1 completed session and M = the
  routine's day count.
- **AC1b.2 — counter updates with completions.** GIVEN N distinct worked days this
  week WHEN another session is completed on a not-yet-worked day this week THEN N
  increases by one; a second session on an already-worked day does not change N.
- **AC1b.3 — no routine hides the counter.** GIVEN no active routine WHEN home is
  shown THEN the "N of M this week" counter is not shown.

**Story 2 — see the whole year.** *As a user tracking a habit, I want a year-at-a-
glance view of every day I trained.*

- **AC2.1 — open drawer.** GIVEN the week strip is shown WHEN the user taps
  anywhere on the strip THEN a drawer opens showing a title "Activity tracker", a
  description, and the year grid.
- **AC2.2 — grid layout.** GIVEN the drawer is open WHEN the year grid renders
  THEN it is a vertical grid of rows of 7 day-squares (one per day), ordered top
  (January) to bottom (December) for the current calendar year.
- **AC2.3 — worked days accent.** GIVEN a day in the current year has ≥1 completed
  session WHEN the grid renders THEN that day's square is accent; every day with
  no completed session is muted.
- **AC2.4 — open animation.** GIVEN the user taps the strip WHEN the drawer opens
  THEN it animates in (not an instant appearance).
- **AC2.5 — close animation.** GIVEN the drawer is open WHEN it is dismissed THEN
  it animates out (not an instant disappearance).
- **AC2.6 — dismissal.** GIVEN the drawer is open WHEN the user taps the backdrop,
  activates the close control, or presses Esc THEN the drawer closes and home is
  fully interactive again.

## Impact

- **Home screen**: gains the week strip between the identity block and
  `RoutineSummary`; no change to those two.
- **`modules/calendar`**: `logic/useCalendar` real implementation behind the frozen
  signature; `api/` Dexie aggregation reading `completedSessions` (by
  `completedAt`) and joining `dayId → RoutineDay.name` via routine-generation's
  barrel (read-only); `ui/` the strip, the day cells, and the animated drawer with
  the year grid.
- **Testing**: `fake-indexeddb` coverage for week/year aggregation and the
  two-sessions-one-day and empty-week edge cases; a Playwright pass over home →
  strip → open drawer → year grid → dismiss (all three dismissal paths).

## Non-goals

- **No streaks or analytics beyond the week counter and the two views asked for**
  — no streak count, no PR/volume charts in this change (`currentStreakWeeks`
  stays unsurfaced; only `weeklyTarget`/`weeklyCompleted` are used).
- **No planned or missed days.** The tracker marks only days a session was
  completed; no schedule, no target overlay, no missed-day styling (locked
  no-guilt decision).
- **No editing history.** Days can't be marked, unmarked, or annotated — the grid
  is a read-only reflection of `completedSessions`.
- **No multi-year navigation.** Current calendar year only (Key decision 3).
- **No per-square detail in the year grid** — no tooltip/tap on individual year
  squares (Key decision 4).
- **No network, ever.** All data reads from IndexedDB; the tracker makes zero
  network calls (hard local-first constraint).

## Priority

Smallest slice that delivers both glances: the current-week strip (accent/muted
cells with day-label + session-name) inserted on home, and the tap-to-open
animated drawer with the read-only Jan→Dec year grid. First cut if scope tightens:
the drawer's year grid (ship the week strip alone). **Not cuttable:** the week
strip and its worked/un-worked distinction — that is the core consistency glance.
