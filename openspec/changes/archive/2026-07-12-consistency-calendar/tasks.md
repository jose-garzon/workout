# Tasks — consistency-calendar

Owner tags: `[engineer]` = software-engineer (logic/data), `[designer]` =
frontend-dev-designer (UI). The seam types (group 1) land first so both builders
unblock; groups 2 (engineer) and 3 (designer) then run in parallel against the
frozen `CalendarApi` contract (design.md §5).

## 1. Seam & types (unblocks both builders)

- [x] 1.1 [engineer] Replace `calendar/types.ts`: define `WeekStripDay`,
  `WeeklyProgress`, `YearGridDay` (design.md §4); remove the placeholder
  `CalendarDay`, `CalendarWeek`, `ConsistencySummary`.
- [x] 1.2 [engineer] Define `CalendarApi` in `logic/useCalendar.ts` per §5
  (`week`, `weeklyProgress`, `yearGrid`, `loading`, `error`).
- [x] 1.3 [engineer] Update `calendar/index.ts` barrel to export `useCalendar`,
  `CalendarApi`, and the three new view types.

## 2. Data + aggregation (engineer)

- [x] 2.1 [engineer] `api/calendarRepo.ts` — `getCompletedInRange(lowerMs,
  upperMs)` reading `db.completedSessions.where("completedAt").between(...)`,
  projecting rows to a minimal `{ completedAt, dayId }[]`. Imports `@/shared/db`
  only.
- [x] 2.2 [engineer] `logic/model.ts` pure helpers: `localDayKey`, `startOfWeek`
  (Monday), `dayLabel`, `buildWeek`, `weeklyProgress`, `buildYearGrid` — all
  local-time bucketing (design.md §3).
- [x] 2.3 [engineer] Replace the throwing `useCalendar` stub with the real hook:
  compute the `[lower, upper]` range, `useLiveQuery` over `calendarRepo`, pull the
  active routine via the `@/modules/routine-generation` barrel (`useActiveRoutine`
  for the `dayId→name` map + target M), derive `week`/`weeklyProgress`/`yearGrid`
  via `model.ts`, surface `loading`/`error`.

## 3. UI — strip, drawer, grid (designer)

- [x] 3.1 [designer] `ui/WeekCell.tsx` — presentational, props = one
  `WeekStripDay`. Muted placeholder vs accent two-line (label + `sessionName`);
  zero radius, tokens only.
- [x] 3.2 [designer] `ui/CalendarWeekStrip.tsx` (`'use client'`) — consumes
  `useCalendar()`; renders 7 `WeekCell`s + the counter (only when
  `weeklyProgress !== null`); the whole strip is a button that opens the drawer;
  owns `open` state; loading placeholder row.
- [x] 3.3 [designer] `ui/YearGrid.tsx` — presentational; chunks `yearGrid` into
  rows of 7; pad cells (`date === null`) render as empty gaps, worked accent,
  others muted; non-interactive squares.
- [x] 3.4 [designer] `ui/ActivityDrawer.tsx` — props `{ open, yearGrid,
  onClose }`; backdrop + panel on `elevated-surface`; title "Activity tracker" +
  description + `<YearGrid>`; animate in AND out (`isClosing` + `onAnimationEnd`
  unmount); dismiss via backdrop, close control, and Esc; `role="dialog"
  aria-modal="true"`; respects `prefers-reduced-motion`.

## 4. Wiring & cleanup

- [x] 4.1 [designer] Add `weekStrip?: ReactNode` prop to `RoutineHomeScreen` and
  render `{weekStrip}` between the identity block and the `flex-1` routine region
  (design.md §1). No calendar import in home.
- [x] 4.2 [designer] `app/page.tsx` — deep-import `CalendarWeekStrip` and pass it
  as `weekStrip={<CalendarWeekStrip />}` into `RoutineHomeScreen`.
- [x] 4.3 [designer] Delete the dead, unrouted scaffold `ui/CalendarScreen.tsx`
  and `ui/CalendarBody.tsx` (they reference the removed stub API).

## 5. Verify

- [x] 5.1 [engineer] Confirm `biome check` + `depcruise src` + typecheck pass —
  UI imports only its own `logic/` + `shared/ui`; `calendarRepo` touches only
  `shared/db`; no network anywhere (firewall rules 1–4, local-first).
  Biome (calendar) + `depcruise src` clean. Typecheck clean for all logic/data;
  the sole remaining `tsc` error is the dead `ui/CalendarBody.tsx` scaffold that
  references the removed stub API — designer's task 4.3 deletes it (design §4).
</content>
