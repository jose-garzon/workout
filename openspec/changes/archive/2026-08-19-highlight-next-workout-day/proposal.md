## Why

Home lists a routine's days as five identical gray rows. Nothing says which one
is next or which are already done, so on every visit the user has to remember
where they left off. The app already knows — completed sessions are on device —
it just never shows it.

## What Changes

- **Day cards get three states.** `idle` (today's gray outline/surface row —
  unchanged), `next` (the one upcoming day, accent-highlighted and visually
  bigger), `finished` (accent-wash background with the day number in accent
  text — the same treatment the goal badge and the install banner already use).
- **The `next` card renders first** in the day list. The remaining days keep
  their natural routine order below it. Every card keeps its routine-position
  number, so day 3 always reads `03` wherever it sits.
- **A workout cycle replaces the calendar week as the unit of progress.**
  Finishing a day marks it `finished` and moves `next` to the following day,
  wrapping past the last day. The cycle survives week boundaries, reloads, and
  app restarts.
- **The cycle resets in exactly two situations:** finishing the day that makes
  EVERY day in the routine finished — whichever day that happens to be, not
  necessarily the last one in order (→ everything back to `idle`, `next` =
  day 1); or finishing a day that is already `finished` in the current cycle
  (that day stays `finished`, every other day drops to `idle`).
- **Reset is triggered by finishing, never by starting.** Opening a day out of
  order changes nothing on screen.
- **The cycle belongs to the active routine's days.** A newly generated routine
  starts a fresh cycle with day 1 as `next`. An edit keeps the cycle for the days
  that survive it; days that don't survive drop out of the cycle, so a wholesale
  re-split clears it naturally.

## User stories

- As a returning gym-goer, I want the next day of my routine at the top of home
  and visually loud, so I can start without thinking about which day it is.
- As a gym-goer mid-cycle, I want to see which days I already completed, so I
  can tell my progress through the routine at a glance.
- As someone whose week doesn't line up with my split, I don't want my progress
  wiped on Monday, so a 5-day routine can run across whatever days I train.
- As someone who repeats a day, I want the cycle to restart cleanly from that
  day, so the highlight never lies about what I've actually done.

## Acceptance criteria

Throughout: "5-day routine" = an active routine with days 1–5 in that order.
`finished` = accent-wash background with accent-colored day number. `next` =
accent-highlighted, larger, first in the list. `idle` = the current gray card.

**Fresh routine**
- GIVEN a 5-day routine with no completed sessions
- WHEN home is shown
- THEN day 1 renders as `next` and is the first card in the list
- AND days 2, 3, 4, 5 render as `idle` in that order below it
- AND no card renders as `finished`

**Finishing a day advances the cycle**
- GIVEN a 5-day routine with no completed sessions
- WHEN the user completes day 1
- THEN on home day 1 renders as `finished`
- AND day 2 renders as `next` and is the first card in the list
- AND the cards below read, in order: day 1 (`finished`), day 3, day 4, day 5

**Mid-cycle state**
- GIVEN a 5-day routine where days 1, 2, 3 have been completed in the current cycle
- WHEN home is shown
- THEN day 4 is `next` and first; days 1, 2, 3 are `finished`; day 5 is `idle`
- AND the cards below `next` read, in order: day 1, day 2, day 3, day 5

**A newly generated routine starts a fresh cycle**
- GIVEN a 5-day routine where days 1, 2 have been completed in the current cycle
- WHEN the user generates a new routine, replacing it
- THEN no card renders as `finished`
- AND day 1 of the new routine renders as `next` and is first

**An edit keeps the cycle for the days that survive it**
- GIVEN a 5-day routine where days 1, 2 have been completed in the current cycle
- WHEN the user edits the routine in a way that keeps its days
- THEN days 1 and 2 still render as `finished`
- AND day 3 renders as `next` and is first

**Finishing the day that completes the set resets everything**
- GIVEN a 5-day routine where days 1, 2, 3, 4 have been completed in the current cycle
- WHEN the user completes day 5
- THEN on home day 1 renders as `next` and is first
- AND days 2, 3, 4, 5 render as `idle`
- AND no card renders as `finished`

**Re-finishing day 1 at 3/5 restarts the cycle from day 1**
- GIVEN a 5-day routine where days 1, 2, 3 have been completed in the current cycle
- WHEN the user completes day 1 again
- THEN day 1 renders as `finished`
- AND days 2, 3, 4, 5 render as `idle`
- AND day 2 renders as `next` and is first

**Re-finishing day 2 at 3/5 restarts the cycle from day 2**
- GIVEN a 5-day routine where days 1, 2, 3 have been completed in the current cycle
- WHEN the user completes day 2 again
- THEN day 2 renders as `finished`
- AND day 1 renders as `idle` (the default gray card)
- AND days 3, 4, 5 render as `idle`
- AND day 3 renders as `next` and is first

**Opening a day out of order changes nothing**
- GIVEN a 5-day routine where days 1, 2, 3 have been completed and day 4 is `next`
- WHEN the user opens day 2's workout screen and returns home without finishing it
- THEN the card states are unchanged: days 1, 2, 3 `finished`, day 4 `next`, day 5 `idle`

**A week boundary does not reset anything**
- GIVEN a 5-day routine where days 1, 2, 3, 4 have been completed in the current cycle
- WHEN the calendar week rolls over and home is shown
- THEN days 1, 2, 3, 4 still render as `finished` and day 5 renders as `next`

**The cycle survives a reload**
- GIVEN a 5-day routine where days 1, 2 have been completed in the current cycle
- WHEN home is reloaded
- THEN days 1, 2 still render as `finished` and day 3 renders as `next`

**`next` wins when the pointer lands on a finished day**
- GIVEN a 5-day routine where days 1, 2, 3 have been completed and then day 5 is
  completed (so the pointer wraps to day 1, already finished)
- WHEN home is shown
- THEN day 1 renders as `next` (not `finished`) and is first
- AND days 2, 3, 5 render as `finished` and day 4 renders as `idle`

**No routine, no states**
- GIVEN a device with a saved profile and no active routine
- WHEN home is shown
- THEN no day list is shown and no `next` or `finished` treatment appears anywhere

## Non-goals

- No dates, scheduling, or "you should train today" prompts. The cycle has no
  calendar meaning.
- No streaks, counters, or percentage-complete readouts on the day list. The
  weekly "N of M" counter already on home is untouched.
- No notifications or reminders.
- No change to the week strip, activity drawer, or year grid
  (`consistency-tracker` stays exactly as-is).
- No change to workout mode, session recording, or the success view — this
  change only reads what those already store.
- No manual "reset my cycle" control, no way to mark a day done without
  completing it, no undo.
- Not a per-day history view (last weight, last date) — the card shows state,
  not data.
- No new persisted user setting and no way to turn the highlighting off.
- No animation — the `next` card does not animate into first position when a day
  is finished while home is visible; it is simply in place on the next render.

## Priority

One slice, ship whole — the states are meaningless without the cycle rules, and
the cycle rules are invisible without the states.

## Capabilities

### New Capabilities
- `routine-day-cycle`: the cycle of a routine's days — which days count as
  finished in the current cycle, which day is next, and the two rules that reset
  the cycle (finishing the last outstanding day; re-finishing an already-finished
  day). Derived from recorded completed sessions for the active routine; never
  reset by a calendar boundary.

### Modified Capabilities
- `home-routine-dashboard`: the per-day routine summary gains the `next` /
  `finished` / `idle` presentation and the reordering that puts `next` first.
  Existing requirement "Tapping a day opens workout mode" is unchanged — every
  card, in every state, still navigates to that day's workout screen.

## Impact

- Home's routine day list (`modules/routine-generation/ui/RoutineSummary.tsx`)
  and whatever supplies it — cards need a state and the list needs an order.
- Reads the stored completed sessions (`dayId` + `completedAt`) through
  routine-generation's own data access — no cross-feature import. Read-only:
  nothing about session recording changes.
- Reuses the existing accent-wash + accent-text treatment already shipped in
  `GoalBadge` and `InstallBanner`; the `next` card needs an accent emphasis the
  design system has no card precedent for yet.
- Local-first holds — every input already lives in IndexedDB. No network, no new
  storage of user data.
