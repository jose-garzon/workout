# Tasks — highlight-next-workout-day

Every task is tagged **[engineer]** or **[designer]**. Group 1 lands first (it is
the shared type). Groups 2–3 (engineer) and group 4 (designer) then run in
PARALLEL against the `DayCard` contract in design.md §"The logic↔UI seam" — the
designer builds against fixture `DayCard[]`, never against the hook. Group 5
joins them.

The Playwright specs themselves are NOT in this file — the engineer writes one per
acceptance criterion in the separate E2E phase, before Build. Group 6 is the
seeding groundwork that phase depends on.

## 1. Shared seam type (engineer)

- [x] 1.1 [engineer] Add `DayState = "idle" | "next" | "finished"` and `DayCard { id, name, position, exerciseCount, state }` to `modules/routine-generation/types.ts`. `position` is the 1-based ROUTINE position (renders as `01`…`05`), never the list index. No barrel change — both stay feature-internal.

## 2. Cycle rules — pure function (engineer)

- [x] 2.1 [engineer] Add `modules/routine-generation/logic/model.ts` with pure `buildDayCards(days: RoutineDay[], completedDayIds: string[]): DayCard[]` implementing the fold in design.md §D2. Input ids are oldest→newest and already time-bounded; ids not present in `days` are skipped. Returns `next` FIRST, then the remaining days in routine order; `[]` for empty `days`. No I/O, no React, no clock.
- [x] 2.2 [engineer] Vitest-unit `buildDayCards`, one case per proposal scenario: fresh routine (day 1 `next`, rest `idle`, none `finished`); after day 1 (`next` = 2, tail order 1,3,4,5); mid-cycle 1,2,3 (`next` = 4, tail 1,2,3,5); full set completed on day 5 → reset to day 1, none finished; full set completed on day 3 (out of order) → reset to day 1, NOT day 4; re-finish day 1 at 3/5 (`next` = 2, only day 1 finished); re-finish day 2 at 3/5 (`next` = 3, only day 2 finished, day 1 idle); wrap onto a finished day (1,2,3 then 5 → day 1 `next` not `finished`, appears once and first, day 4 idle).
- [x] 2.3 [engineer] Vitest-unit the edges: `days: []` → `[]`; a completed id absent from `days` (day dropped or renamed by an edit) is ignored while the surviving days keep their finished state — an edit must NOT reset the cycle (design.md §D2); a 1-day routine resets on every completion; `position` always equals the routine position after reordering.

## 3. Session query + seam hook (engineer)

- [x] 3.1 [engineer] Add `modules/routine-generation/api/cycleRepo.ts` with `getCompletedDayIdsSince(sinceMs: number): Promise<string[]>` — `db.completedSessions` over the `completedAt` index, `>= sinceMs` inclusive, no upper bound, ascending, projected to `dayId`. Imports `@/shared/db` only. Do NOT filter by `routineId` (it is the constant `"active"` for every row — design.md §D2); add a comment saying so.
- [x] 3.2 [engineer] Vitest + fake-indexeddb test for `getCompletedDayIdsSince`: excludes rows below the bound, includes a row exactly at the bound, returns oldest→newest, returns `[]` on an empty table.
- [x] 3.3 [engineer] Add `modules/routine-generation/logic/useDayCycle.ts` exporting `useDayCycle(): DayCycleApi { days: DayCard[]; loading: boolean; error: Error | null }` — zero args. Resolve the routine with `useActiveRoutine()`, `useLiveQuery(getCompletedDayIdsSince(routine.createdAt))` keyed on `createdAt`, feed `buildDayCards`. Match the state table in design.md exactly: `[]` + `loading: true` before the first emit; `[]` + `loading: false` with no routine; on a failed session read, **`buildDayCards(routine.days, [])` — every day in routine order, all `idle`** plus the `Error`. The list must degrade, never vanish: `routine.days` is already loaded and independent of the session read.
- [x] 3.4 [engineer] Integration-test `useDayCycle` (fake-indexeddb): no routine → `[]`, not loading; routine + zero sessions → day 1 `next` first; sessions with `completedAt` BEFORE `routine.createdAt` are ignored (regenerate → fresh cycle); a throwing session read → all days present in routine order, all `idle`, `error` set, `loading: false`; re-emits with the advanced cycle when a completed session is inserted while mounted.

## 4. Day card states + order in the UI (designer)

- [x] 4.1 [designer] Add `days: DayCard[]` to `RoutineSummaryProps`. `RoutineSummary` renders `days` in the given order and STOPS mapping `routine.days`; `routine` stays only for the heading name + edit button. Number = `String(card.position).padStart(2, "0")`, count = `card.exerciseCount`, href = `/workout/${card.id}`. No sorting, no state derivation, no filtering in the component.
- [x] 4.2 [designer] Style the three states per design.md §D4 (DECIDED, not a menu): `idle` unchanged; `finished` = `bg-accent-wash` + day number in `text-accent-text` (never raw `--color-accent` as text — it fails on light); `next` = the `InstallBanner` recipe scaled up — `bg-accent-wash` + solid `border-accent-text` + `text-micro` eyebrow in `accent-text` + a larger min-height/spacing step. Do NOT use a full-saturation `bg-accent` card: home already spends its sanctioned full fill on the week strip. Verify both themes.
- [x] 4.3 [designer] `next` and `finished` share the wash background, so all THREE non-colour separators must be present (design.md §D4): `next` has the accent border / `finished` has none; `next` is a full size step taller / `idle` and `finished` are the same size; `next` has the eyebrow / `finished` has none. Each card also carries a text equivalent for AT — add the new keys to BOTH `src/shared/i18n/en.json` and `es.json`.
- [x] 4.4 [designer] Render `<ul>` only when `days.length > 0` (heading + edit button still render) — that is the pre-first-emit frame and the no-routine case only. No skeleton, no spinner, no error UI: a failed session read arrives as the full day list in routine order, all `idle`.
- [x] 4.5 [designer] No enter/reorder animation: the `next` card does not animate into first position (proposal non-goal). Keep the existing `anim-press` on the rows.
- [x] 4.6 [designer] Component-test `RoutineSummary` against fixture `DayCard[]` (no Dexie): renders in the given order, `next` first, numbers follow `position` not list index, each state's accessible name, and every card — `idle`, `next`, `finished` alike — still links to `/workout/[id]` (guards the untouched "Tapping a day opens workout mode" requirement). Assert all three `next`-vs-`finished` separators from 4.3 (border, size step, eyebrow) — dropping any one is a regression, not a restyle.
- [x] 4.7 [designer] Self-review the day list with the `design-critique` skill (both themes, 320px width, tap targets).

## 5. Wire the seam (engineer)

- [x] 5.1 [engineer] `RoutineHomeScreen` calls `useDayCycle()` (own-feature logic) and passes `days` to `RoutineSummary`. No other prop or behaviour change; `page.tsx` is untouched.
- [x] 5.2 [engineer] Update `routineHome.integration.test.tsx` for the new list source: fresh routine shows day 1 first as `next`; after seeding a completed day-1 session the list re-emits with day 2 first.

## 6. E2E seeding groundwork (engineer)

- [x] 6.1 [engineer] Build the cycle e2e's `seed(page, { sessions })` helper on the `e2e/consistency-calendar.spec.ts` IndexedDB pattern, honouring the contract in design.md §"E2E seeding contract": the seeded routine's `createdAt` MUST be strictly older than every seeded session's `completedAt`. Do NOT copy that file's `createdAt: Date.now()` routine const alongside `nowMinus(…)` sessions — it filters every session out, and the "fresh routine" spec then passes for the wrong reason. Prove the helper before writing specs on it: seed 3 sessions, assert home shows the expected `finished` cards (not day 1 `next`).
- [x] 6.2 [engineer] Exclude "a week boundary does not reset anything" from the e2e set — `buildDayCards` takes no clock/date input, so there is no boundary to roll; the unit tests in 2.2 cover it. Keep "the cycle survives a reload" in the e2e set. Note the exclusion in the spec file so it doesn't look forgotten.

## 7. Verify

- [x] 7.1 [engineer] Run `bun run biome check` + `depcruise src` — both clean. Confirm no new cross-feature import was added (no `@/modules/workout-mode` anywhere in `routine-generation`, `no-circular` holds) and that no `biome.json` / `.dependency-cruiser.cjs` edit was needed (design.md §"Firewall check").
- [x] 7.2 [engineer] Run the full unit + integration suite; check failures against the 3 known pre-existing failures on clean `main` before blaming this change.
