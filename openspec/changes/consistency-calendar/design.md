# Design — consistency-calendar (Feature C)

The `useCalendar` seam gets its real body; calendar `api/` + `logic/` aggregate
`completedSessions` into three read-only views; calendar `ui/` renders a home
week-strip + counter and a tap-to-open year drawer. Local-first: pure browser
Dexie reads, zero network.

## 1. The load-bearing decision — how the strip reaches home

Home (`RoutineHomeScreen`) lives in `routine-generation/ui`. Firewall rule 1: a
feature's `ui/` may not import another feature. So home **cannot** import the
calendar strip.

**Decision: a `weekStrip?: ReactNode` slot on `RoutineHomeScreen`, filled by the
app composition layer (`app/page.tsx`).** Home renders `{weekStrip}` between the
identity block and the `flex-1` routine region; it never names calendar.
`app/page.tsx` deep-imports `CalendarWeekStrip` and passes it in.

- **Why app/ may deep-import it:** the depcruise `cross-feature-barrel-only`
  rule scopes `from` to `^src/modules/` — `app/` is exempt. `page.tsx` already
  deep-imports `RoutineHomeScreen`, `Splash`, `FirstRunGate`. Same seam, no new
  precedent, no barrel change.
- **Client-only for free:** the slot node is created inside `FirstRunGate`'s
  `home` render-prop, which only runs client-side (`dynamic ssr:false`). So the
  strip's Dexie reads never run during Next's static build — no ssr guard needed.
- **Rejected — barrel-export the component + import from `@/modules/calendar`:**
  the barrel is documented "seam hooks + public types only"; app already
  deep-imports UI, so a barrel export would be an inconsistent second pattern for
  zero gain.
- **Rejected — a `<CalendarSlot>` wrapper in `shared/ui`:** shared/ui is
  feature-agnostic; a calendar-aware component there leaks the feature upward.

```
app/page.tsx (composition — may reach both features)
  └ RoutineHomeScreen weekStrip={<CalendarWeekStrip/>}
        identity block (h2 + goal badge + motivation)   ← unchanged
        {weekStrip}                                      ← NEW slot
        flex-1 routine region (RoutineSummary / invite)  ← unchanged
        composer dock                                    ← unchanged

CalendarWeekStrip (calendar/ui) → useCalendar() (calendar/logic)
  → calendarRepo (calendar/api, reads shared/db) + useActiveRoutine (rtn-gen barrel)
```

## 2. Data flow (one Dexie read, three views)

`useCalendar` does a single `useLiveQuery` over `completedSessions` and derives
all three views from the same rows — reactive, so a session completed elsewhere
repaints the strip with no manual refresh.

- **Source:** `completedSessions`, indexed on `completedAt` (schema unchanged —
  no migration). Range read `[lower, upper]`:
  - `upper = now` (sessions are never in the future).
  - `lower = min(startOfCurrentYear, startOfCurrentWeek)` — covers the year grid
    **and** an early-January week whose Monday falls in the prior December.
- **Projection:** the repo returns a minimal `{ completedAt, dayId }[]` — the
  only fields the views need. `exerciseLogs` are not read.
- **Routine join / target:** `useCalendar` calls `useActiveRoutine()` (via the
  routine-generation **barrel** — a cross-feature import allowed in `logic/`, not
  in `ui/`). `routine.days` gives the `dayId → name` map for the strip's second
  line; `routine.days.length` is the weekly target M.
- **`calendarRepo` reads `shared/db` rows directly** (the established repo
  pattern — `sessionRepo` does the same), not `CompletedSession` via
  workout-mode's barrel. We need only two scalar row fields; a cross-feature
  dependency buys nothing. (Supersedes the stub's "via workout-mode barrel"
  hint.)

## 3. Aggregation — `logic/model.ts` (pure, no I/O, unit-testable)

All bucketing is **local time** (never UTC): a session's day = `getFullYear/
getMonth/getDate` of `new Date(completedAt)`. Explicit local handling is required
so "trained Saturday night" lands on Saturday, not Sunday UTC.

- `localDayKey(ms) → "yyyy-mm-dd"` — local calendar day.
- `startOfWeek(date) → Date` — **Monday** 00:00 local (ISO week).
- `dayLabel(dayKey) → "Sat 11 Jul"` — weekday + day + short month.
- `buildWeek(refs, dayNameById, now) → WeekStripDay[]` — 7 cells Mon→Sun of the
  current week. A cell is `worked` if ≥1 ref bucketed to that day; `sessionName`
  = the `dayId→name` of the **most-recent** ref that day (max `completedAt`), or
  `null` (un-worked, or the routine no longer contains that `dayId`).
- `weeklyProgress(week, routine) → WeeklyProgress | null` — `null` when no active
  routine; else `{ completed: worked-day count in week, target: days.length }`.
- `buildYearGrid(refs, year) → YearGridDay[]` — leading `date:null` pad cells so
  the first real square lands under its Monday column, then Jan 1 → Dec 31, each
  `worked` if ≥1 ref that day. UI chunks the flat array into rows of 7.

## 4. Seam types — reconciling the frozen barrel

The frozen stub types (`CalendarDay`, `CalendarWeek`, `ConsistencySummary`) were
foundation placeholders and **do not carry** worked-flag, session-name, day-label
or pad cells the UI needs. **Decision: replace all three** with three purpose-fit
view types. Barrel + `types.ts` updated; the throwing `useCalendar` stub and the
dead, unrouted `CalendarScreen`/`CalendarBody` scaffold (which reference the old
API) are removed.

```ts
// calendar/types.ts — leaf, imports nothing
export interface WeekStripDay {
  date: string;          // local ISO yyyy-mm-dd
  label: string;         // "Sat 11 Jul"
  worked: boolean;       // ≥1 completed session that day
  sessionName: string | null; // most-recent session's routine-day name, or null
}
export interface WeeklyProgress {
  completed: number;     // distinct worked days this week (N)
  target: number;        // active routine days.length (M)
}
export interface YearGridDay {
  date: string | null;   // local ISO, or null = leading pad cell (Monday align)
  worked: boolean;       // always false for pad cells
}
```

## 5. The logic↔UI interface (the meeting point)

**Engineer exposes** from `@/modules/calendar` (barrel) — designer imports
`useCalendar` from its own `../logic/useCalendar`:

```ts
export interface CalendarApi {
  week: WeekStripDay[];              // exactly 7, Monday → Sunday
  weeklyProgress: WeeklyProgress | null; // null ⇒ counter hidden (no routine)
  yearGrid: YearGridDay[];           // pad cells + Jan 1 → Dec 31, current year
  loading: boolean;                  // true until first Dexie emit
  error: Error | null;
}
export function useCalendar(): CalendarApi;
```

That is the whole contract. UI does **no** date math, joins, or counting — every
displayed value arrives ready.

## 6. UI components (calendar/ui — designer)

All zero-radius, accent `#E8FF3D` with `--color-on-accent` text, tokens only.

- **`CalendarWeekStrip`** (`'use client'`) — calls `useCalendar()`. Renders the 7
  `WeekCell`s in a row plus the counter (only when `weeklyProgress !== null`:
  `{completed} of {target} this week`). The whole strip is a `<button>` that
  opens the drawer; owns `open` state. While `loading`, renders a placeholder row
  (no flash). This is the node the app slot renders.
- **`WeekCell`** — presentational, props = one `WeekStripDay`. Un-worked → muted
  placeholder square, label only. Worked → accent fill, two lines (label +
  `sessionName`).
- **`ActivityDrawer`** — props `{ open, yearGrid, onClose }`. Backdrop
  (`--z-modal`, `rgba(0,0,0,0.6)`) + panel on `elevated-surface`. Title
  **"Activity tracker"**, a one-line description, and `<YearGrid>`. Dismiss on
  backdrop tap, a close control, and **Esc** (`keydown` listener while open).
  `role="dialog" aria-modal="true"`.
  - **Animate in and out:** enter with `anim-rise`/`anim-fade`; on dismiss set an
    `isClosing` flag applying an exit animation, unmount on `onAnimationEnd`
    (don't unmount synchronously, or AC2.5 fails). `prefers-reduced-motion`
    collapses both to instant (global rule already drops `anim-rise`).
- **`YearGrid`** — presentational, chunks `yearGrid` into rows of 7; pad cells
  (`date === null`) render as empty gaps, worked squares accent, others muted.
  Non-interactive squares (Key decision 4).

## 7. Boundaries & firewall check

- `calendar/api/calendarRepo.ts` → imports `@/shared/db` only. ✅ rule 2
- `calendar/logic/{model,useCalendar}.ts` → model imports `../types`;
  useCalendar imports `../api/calendarRepo`, `../types`, and the
  `@/modules/routine-generation` **barrel** (cross-feature via barrel, allowed in
  logic/). ✅ rules 2, 3
- `calendar/ui/*` → import only `../logic/useCalendar` + `shared/ui`. Never
  another feature, never `api/`, never `shared/db`. ✅ rule 1
- `routine-generation/ui/RoutineHomeScreen` → gains a `ReactNode` prop; imports
  nothing new. ✅ rule 1
- `app/page.tsx` → deep-imports `CalendarWeekStrip` (app exempt from barrel
  rule). ✅
- No server, no network anywhere. ✅ local-first

## 8. Testing strategy (tests authored in a later phase)

- **Unit (Vitest, `model.ts`):** Monday week boundaries; local-day bucketing
  (late-night session stays same day); two-sessions-one-day → most-recent name;
  empty week → all placeholders; year-grid pad-cell count vs Jan 1 weekday;
  early-January week crossing the year boundary.
- **Integration (fake-indexeddb, `calendarRepo` + `useCalendar`):** range read
  returns only in-range refs; `weeklyProgress` null without a routine; N counts
  distinct days, not sessions.
- **E2E (Playwright):** home shows the strip between identity and routine; a
  worked day is accent with its name; tap → drawer opens (title + grid); dismiss
  via backdrop, close control, and Esc.

## 9. Sequencing

Seam types + `CalendarApi` land first (both builders unblock off §4/§5), then
repo → model → real hook (engineer) in parallel with the strip/cell/drawer/grid
(designer against the frozen §5 contract), then the app slot wiring, then delete
the dead stub + scaffold.
</content>
</invoke>
