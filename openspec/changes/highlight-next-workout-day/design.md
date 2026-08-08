# Design — highlight-next-workout-day

Home's day list gains three states (`idle` / `next` / `finished`) and puts `next`
first. The states come from a **cycle derived from completed sessions**, computed
inside `routine-generation` (B) — no new stored data, no new cross-feature edge.

## Context

What already exists, reused as-is:

- **The list.** `routine-generation/ui/RoutineSummary.tsx` maps `routine.days` to
  `<li><Link href={/workout/${day.id}}>` rows: two-digit index, day name,
  exercise count, chevron. Rendered by `RoutineHomeScreen` only when a routine
  exists.
- **The sessions.** `db.completedSessions` rows carry `{ routineId, dayId,
  completedAt, … }`; `completedAt` is the table's secondary index.
- **Two invariants that decide this design:**
  1. `routineRepo.toRow` overwrites the routine id with the singleton
     `ACTIVE_ID = "active"`. So `routine.id` is **always `"active"`**, and so is
     every `CompletedSession.routineId`. **`routineId` cannot tell one routine's
     sessions from another's** (already documented in archived
     `routine-edit-history` design.md). `routine.createdAt` can: generation sets
     `Date.now()`, `assembleEditedRoutine` preserves it.
  2. **Dependency direction is fixed `A ← B ← D ← C`.** `workout-mode` (D)
     already imports `routine-generation` (B) in `logic/model.ts`,
     `logic/useWorkoutSession.ts`, `logic/useSessionSummary.ts`. Therefore
     **B must never import D** — dependency-cruiser `no-circular` is CI- and
     pre-commit-failing.
- **Two precedents for "feature X needs completed sessions":** `calendar` (C)
  reads `db.completedSessions` through its **own** `api/calendarRepo.ts`;
  `routine-edit-history` computes a string in D and threads it through
  `app/page.tsx` as a **prop** (`sessionSummary`, `weekStrip`).

## Goals / Non-Goals

**Goals.** One seam that hands the UI a ready-to-render, correctly ordered day
list with a state per card. The cycle rules live in one pure, unit-testable
function. No B→D edge. No firewall config change.

**Non-Goals.** No persisted cycle state, no new table, no migration. No change to
session recording, the week strip, or workout mode. No animation. No new
cross-feature barrel export.

---

## Decisions

### D1 — The cycle lives in B; B gets its own `cycleRepo` (calendar precedent)

`routine-generation/api/cycleRepo.ts` reads `db.completedSessions` **directly**,
exactly as `calendarRepo` does. Nothing imports `workout-mode`.

```
 routine-generation (B)                       shared/db
 ─────────────────────────                    ───────────────
 api/cycleRepo.ts ───────────────────────────▶ db.completedSessions
   getCompletedDayIdsSince(sinceMs)            (index: completedAt)
 api/routineRepo.ts ─────────────────────────▶ db.routines
        │
 logic/model.ts        buildDayCards(days, completedDayIds) → DayCard[]  (pure)
 logic/useDayCycle.ts  useActiveRoutine + useLiveQuery(cycleRepo) → model
        │  DayCard[]
 ui/RoutineHomeScreen ── days prop ──▶ ui/RoutineSummary
```

**Why not the composition-layer prop (D computes, `page.tsx` threads it in):**
also acyclic, also legal — rejected on ownership and cost. The rule to apply,
stated once so the next change doesn't re-litigate it:

> If the consumer needs D's **domain interpretation** of a session
> (`exerciseLogs`, `series`, ratings — i.e. D's `model.ts`), compute it in D and
> thread a primitive through `app/` (the `sessionSummary` precedent). If it needs
> only the **scalar coordinates** `dayId` + `completedAt`, read them through your
> own repo (the `calendarRepo` precedent).

The cycle needs `dayId` + `completedAt` only. The prop route would also put a
rule about *routine days* in the *workout* feature, add a public routine-shaped
type to D's barrel, and thread a prop through two components — more moving parts
for the same graph.

**Consequence accepted:** `completedSessions` now has three readers
(`sessionRepo`, `calendarRepo`, `cycleRepo`). The row shape is declared once in
`shared/db/schema.ts`, so a field rename breaks all three at typecheck. That is
the only coupling and it is type-checked, not conventional.

### D2 — The cycle is DERIVED on every read, never persisted

The rules are a fold over the session history in `completedAt` order, so there is
nothing to store:

```
finished: Set<dayId> = ∅ ;  last: dayId | null = null
for id of completedDayIds (oldest → newest):
    if id ∉ routine.days            → skip          (day removed by an edit)
    if id ∈ finished                → finished = {id}     (re-finish restart)
    else                              finished.add(id)
    last = id
    if finished.size === days.length → finished = ∅ ; last = null   (full reset)

nextIndex = last === null ? 0 : (indexOf(last) + 1) mod days.length
state(day) = day === days[nextIndex] ? "next"          // `next` wins
           : finished.has(day.id)    ? "finished"
           : "idle"
```

Every proposal scenario falls out of this, including the two awkward ones:
full-set reset lands on day 1 *even when the completing day is not the last*
(`last` is nulled, so the pointer is ignored), and the wrap-onto-a-finished-day
case yields `next` for a day that is also in `finished` (`next` wins, and the day
appears once — first).

**Session range read: `completedAt >= routine.createdAt`, no upper bound.**
Correct because a session cannot be completed before the routine that owns it was
created, and `createdAt` is minted fresh on generation (→ regenerating starts a
fresh cycle) and preserved on edit. **`routineId` is deliberately NOT used as a
filter** — it is the constant `"active"` for every row on the device and would
carry the previous routine's sessions into the new cycle. No upper bound: sessions
are never in the future, and an unbounded upper end is what keeps the live query
re-emitting after a completion (same reasoning as `useCalendar`).

**Regenerating resets the cycle; EDITING DOES NOT (decided — do not "fix" this
into a reset).** `assembleEditedRoutine` preserves `id`, `createdAt`, and the day
ids of name-matched days, so an edited routine keeps its cycle for every day that
survived the edit; days whose ids were reminted (renamed/added) fall out of the
fold via the `id ∉ routine.days` skip, and a wholesale re-split therefore clears
the cycle on its own. This is intentional: a user who tweaks one exercise keeps
their place in the split. Making edits reset would mean bumping `createdAt` in the
edit path — explicitly **not** wanted. Pinned by a spec scenario in
`routine-day-cycle` and by unit test 2.3.

**Rejected — persist a `cycle` record (finished day ids + pointer) written on
session completion:** needs a schema version + migration, needs `workout-mode` to
write it (a new D→B write coupling), and can drift out of sync with the session
log it duplicates. Derivation is strictly smaller and self-healing.
**Rejected — read *all* completed sessions and filter in the pure function:**
the pure function has no way to know which routine a session belonged to; the
time bound is the only discriminator available and it belongs in the query.

### D3 — The seam hands the UI a PRE-ORDERED list

`buildDayCards` returns `next` first, then the remaining days in routine order.
The UI does no sorting, no state derivation, no numbering math.

**Why pre-ordered:** "which day is next" and "next goes first" are one rule; if
the UI reorders, that rule is split across a layer that cannot be unit-tested with
the proposal's scenarios, and the two builders can disagree about it while working
in parallel. `position` on each card carries the **routine position** (`01`…`05`)
so reordering can never corrupt the number — the number is data, not list index.

**Given up:** the UI can't render an alternative order (e.g. natural order first,
then animate `next` to the top). The proposal explicitly rules out that animation,
so nothing is lost today; if it is ever wanted, the seam adds a
`routineOrder`-sorted view then.

### D4 — `next` takes the scaled-up `InstallBanner` treatment (DECIDED)

Binding, not a recommendation — the designer inherits this and executes it:

- `finished` = `bg-accent-wash` + day number in `text-accent-text` (proposal).
  **Never the raw `--color-accent` as text** — in light theme `accent-text` is
  olive `#667200`; the raw hue is 1.06:1 on light and unreadable.
- `next` = the shipped `InstallBanner` recipe scaled up: `bg-accent-wash` + a
  solid `border-accent-text` + a `text-micro` eyebrow in `accent-text` + a larger
  min-height/spacing step + first position.
- **Rejected — a full-saturation `bg-accent` / `text-on-accent` card.** Home
  already spends its sanctioned full accent fill on the week strip's worked cells
  (`WeekCell`: "the one sanctioned repeated use"). A second, much larger `bg-accent`
  block on the same screen is the design system's explicit no, and it would out-shout
  the strip it sits under. Given up: the loudest possible emphasis for `next` — the
  size step, the border, and first position carry it instead.
- **The cost of this decision: `next` and `finished` now share a background**
  (`accent-wash`). That is the one real risk it carries, so the separation is a
  **testable expectation, not taste**. Three non-colour signals MUST all be
  present, and each must be assertable in the `RoutineSummary` component test:
  1. **Border** — `next` carries a solid `accent-text` border; `finished` carries
     none (it keeps the default `border-border`).
  2. **Size** — `next` is a full spacing/min-height step taller than every other
     card; `idle` and `finished` are the same size as each other.
  3. **Label** — `next` carries a visible `text-micro` eyebrow; `finished` carries
     no eyebrow.
  A change that drops any one of the three is a regression, not a restyle. The
  state also needs a text equivalent for AT — new i18n keys in **both** `en.json`
  and `es.json` (`routine.summary.state.next` / `routine.summary.state.finished`
  or equivalent). Order is not an accessible state.

---

## The logic↔UI seam (the contract both builders code against)

**Types — `modules/routine-generation/types.ts`** (leaf; no barrel change):

```ts
/** How a day card renders on home. `next` wins over `finished` on the same day. */
export type DayState = "idle" | "next" | "finished";

/** One day row, ready to render. The UI does no math and no sorting. */
export interface DayCard {
  /** Routine day id — the `/workout/[dayId]` href. */
  id: string;
  name: string;
  /** 1-based ROUTINE position — renders as "01"…"05". NOT the list index. */
  position: number;
  exerciseCount: number;
  state: DayState;
}
```

**Pure rule — `modules/routine-generation/logic/model.ts`** (new file):

```ts
/**
 * The cycle rules (design.md §D2), pure and total.
 * @param days             the active routine's days, in routine order
 * @param completedDayIds  dayIds of the active routine's completed sessions,
 *                         OLDEST → NEWEST, already time-bounded by the caller
 * @returns one card per day: `next` FIRST, then the remaining days in routine
 *          order. `[]` when `days` is empty. Ids not in `days` are ignored.
 */
export function buildDayCards(
  days: RoutineDay[],
  completedDayIds: string[],
): DayCard[];
```

**Query — `modules/routine-generation/api/cycleRepo.ts`** (new file, imports
`@/shared/db` only):

```ts
/** dayIds of completed sessions with `completedAt >= sinceMs`, oldest → newest
 *  (the `completedAt` index order). No `routineId` filter — see §D2. */
export function getCompletedDayIdsSince(sinceMs: number): Promise<string[]>;
```

**Seam hook — `modules/routine-generation/logic/useDayCycle.ts`** (new file):

```ts
export interface DayCycleApi {
  /** Pre-ordered: `next` first, then routine order. `[]` ONLY when no routine is
   *  resolved. Whenever a routine is resolved but the session read has not
   *  emitted FOR THAT routine — or it errored — EVERY day in routine order, all
   *  `state: "idle"`: the list degrades, it never disappears, and it never shows
   *  a cycle it hasn't read. */
  days: DayCard[];
  /** true until BOTH the active-routine and the session live queries emit. */
  loading: boolean;
  error: Error | null;
}

export function useDayCycle(): DayCycleApi;
```

Zero arguments — it resolves the routine itself via `useActiveRoutine()` (its own
feature's logic) and `useLiveQuery`s `getCompletedDayIdsSince(routine.createdAt)`
keyed on `createdAt`, mirroring `useCalendar` / `useSessionSummary`. Live so that
returning home after a completed session re-renders with the advanced cycle
without a manual refetch.

| Situation | `days` | `loading` | `error` |
|---|---|---|---|
| no routine resolved yet | `[]` | `true` | `null` |
| no active routine | `[]` | `false` | `null` |
| routine resolved, session read not emitted **for this `createdAt`** | all days, routine order, all `idle` | `true` | `null` |
| routine, zero sessions in range | day 1 `next` first, rest `idle` | `false` | `null` |
| routine + sessions | full cycle, `next` first | `false` | `null` |
| session read throws | all days, routine order, all `idle` | `false` | the `Error` |

**Row 3 is load-bearing and cost a real bug.** `useLiveQuery` keeps returning the
PREVIOUS subscription's value after its deps change — `monitor.current.hasResult`
is a ref that is never reset (`dexie-react-hooks.mjs:40-67`). `useDayCycle` flips
`createdAt` from `null → T` on every cold load, so the `result === undefined`
guard does **not** fire: the no-routine result (`dayIds: []`) survives into the
frame where the routine has just resolved, and folding it **fabricates a cycle** —
day 1 as `next`, nothing finished — for a full paint plus an IndexedDB round trip.
A mid-cycle user watched "01 — NEXT" jump to "04 — NEXT". The fix stamps each
querier result with the `createdAt` it read and treats a result carrying any other
stamp as "not an answer to this query": degrade to all-idle, keep reporting
`loading`, never invent a cycle.

**UI side.** `RoutineHomeScreen` calls `useDayCycle()` (own-feature logic —
firewall rule 1 satisfied) and passes `days` down. `RoutineSummary` stays a pure
render function:

```ts
export interface RoutineSummaryProps {
  routine: Routine;               // unchanged — heading name + edit button
  days: DayCard[];                // NEW — render these, in this order
  onEdit: () => void;
  editButtonRef: RefObject<HTMLButtonElement | null>;
}
```

`RoutineSummary` **stops mapping `routine.days`** and maps `days` instead:
`href={/workout/${card.id}}`, number = `String(card.position).padStart(2,"0")`,
count = `card.exerciseCount`, styling switched on `card.state`. Every state stays
a `Link` to that day's workout screen (unchanged requirement). When
`days.length === 0` the `<ul>` is not rendered (heading + edit button still are) —
no skeleton, no spinner: it is one indexed range read and home already renders
progressively.

**No error UI — the list DEGRADES, it does not vanish.** The day list comes from
`routine.days`, which is already loaded and independent of the session read. So a
failed *or not-yet-emitted* session read returns every day in routine order, all
`idle` — exactly today's home. Collapsing to `[]` would turn a transient Dexie
error into a persistent blank list under a heading, and (per row 3 above) showing
a fabricated cycle instead would be worse still. `error` is on the seam so a later
change can surface it; the designer builds nothing for it now.

**No animation.** The `next` card does not animate into first position (proposal
non-goal). Keep the existing `anim-press` press feedback on the rows; add no
enter/reorder motion.

---

## Firewall check — no config change needed

| New/changed file | Imports | Rule |
|---|---|---|
| `B/api/cycleRepo.ts` | `@/shared/db` | `modules/*/api/**` override bans only upward `logic/`/`ui/` — `shared/db` is what every repo imports |
| `B/logic/model.ts` | `../types` | downward |
| `B/logic/useDayCycle.ts` | `../api/cycleRepo`, `./model`, `./useActiveRoutine` | downward, own feature |
| `B/ui/RoutineHomeScreen.tsx` | `../logic/useDayCycle` | rule 1 — own logic |
| `B/ui/RoutineSummary.tsx` | `../types` (already does) | rule 1 |

**No `biome.json` change, no `.dependency-cruiser.cjs` change, no new fixture.**
Reason: this change introduces **no new import direction**. It adds no
cross-feature import at all (so rule 3 and `no-circular` are untouched by
construction), nothing under `src/app/api/**` (rule 4 untouched), and
`api/ → @/shared/db` is the direction `routineRepo` already uses. The Biome
overrides are forbid-lists; nothing here is on any of the lists. Verification is
the standard `bun run biome check` + `depcruise src`, not a new rule.

---

## Risks / Trade-offs

- **[`next` and `finished` share a background]** → The cost of §D4. Mitigated by
  three mandatory non-colour signals (border / size step / eyebrow), each an
  assertion in the `RoutineSummary` component test — see §D4.
- **[An edit keeps the cycle for surviving days]** → Decided behaviour (§D2), not
  a gap: an edit preserves `createdAt` and name-matched day ids, so a small edit
  keeps the user's place and a re-split clears the cycle on its own. Do not
  "correct" this into a reset.
- **[Clock skew / ties]** → The fold order is the `completedAt` index order. Two
  sessions in the same millisecond is not humanly reachable; a backward system
  clock change can mis-order the fold (wrong `next` for one cycle) or push a
  session below `routine.createdAt` so it is ignored (cycle looks fresh). Both
  self-heal on the next completion. Not worth a monotonic counter.
- **[Three readers of `completedSessions`]** → A shape change to that table must
  visit `sessionRepo`, `calendarRepo`, `cycleRepo`. Mitigated by the single
  `CompletedSessionRow` declaration in `shared/db/schema.ts` — a rename fails
  typecheck in all three.
- **[Full-history scan — knowingly accepted, code left as-is]** → The original
  note ("bounded by one routine's lifetime, tens to low hundreds of rows") was
  wrong. `assembleEditedRoutine` preserves `createdAt`, so for a user who only
  ever *edits* and never regenerates, the window **never shrinks** — it is
  unbounded in practice. Worse, the read materializes full `CompletedSessionRow`s
  — including `exerciseLogs`, the largest field in the DB — purely to extract
  `dayId` strings, and it re-runs on every home mount and on every
  `completedSessions` write, including `sessionRepo.updateRatings` after each
  workout. Accepted for now: even a heavy year of training is a few hundred rows
  on an index, and it is all local. The honest fix is a compound
  `[completedAt+dayId]` index read as keys only — that needs a schema version +
  migration, which this change deliberately avoided. Revisit when a migration is
  being shipped for another reason.
- **[Cycle can paint before it is read]** → Fixed, not accepted; see the state
  table's row 3. The rule that replaces the original (wrong) "sub-frame empty
  flash" assumption: **a resolved routine with an unread cycle renders every day
  `idle`, never `[]` and never a fabricated day-1-`next`.**
- **[Two `useActiveRoutine` subscriptions feed one component]** → `RoutineHomeScreen`
  calls `useActiveRoutine()` and `useDayCycle()` calls it again, so `routine`
  (heading, edit button) and `days` (the rows) resolve from **separate live-query
  snapshots**. Regeneration is *not* a trigger — the build composer is hidden once
  a routine exists (`RoutineHomeScreen.tsx:215`), so the only `null → routine`
  transition is the first adopt, which has no stale rows to leave behind. **The
  live path is the EDIT flow:** `assembleEditedRoutine` remints day ids for
  renamed/added days, so for a frame the rows can carry a dead
  `/workout/<old-uuid>` href — tappable, navigating to a day that no longer
  exists. The `createdAt` stamp does **not** cover this: an edit preserves
  `createdAt`, so the stamp never changes and that guard never fires. The two
  problems are independent.
  **Verdict: accepted in this change, follow-up if it is ever observed.** The
  window is one frame between two emits of the same table, and both fixes cost
  the seam, which the designer already coded against blind. If it needs fixing,
  the follow-up is **`useDayCycle(routine: Routine | null)`** — one subscription,
  one snapshot, consistent by construction, and the call site already holds the
  routine. Rejected as the follow-up: adding `routine` to `DayCycleApi`, since
  `RoutineHomeScreen` needs `active` for four other things (composer visibility,
  motivation line, the adopt effect, the summary prop) — the seam would duplicate
  it, not replace it.

## E2E seeding contract (read before writing the Playwright specs)

Most criteria need 3–5 completed sessions; driving those through workout mode is
not viable. Seed IndexedDB directly with the `seed(page, { sessions })` helper
pattern from `e2e/consistency-calendar.spec.ts`.

**The trap, stated so nobody loses an afternoon to it:** `cycleRepo` filters
`completedAt >= routine.createdAt`, and that helper's `ROUTINE` const is declared
with `createdAt: Date.now()` at module load while its sessions are `nowMinus(…)`
— i.e. **older than the routine**. Copied as-is, every seeded session is filtered
out, the cycle reads empty, and home renders day 1 as `next`. The "fresh routine"
spec then **passes for the wrong reason** while every other spec fails.

**Contract: seed the routine with a `createdAt` strictly older than every seeded
session's `completedAt`** (e.g. a fixed `createdAt` well in the past, sessions at
`nowMinus(…)` after it). Regeneration is the one case that inverts this on
purpose: a routine whose `createdAt` is NEWER than the seeded sessions is exactly
how the "new routine starts a fresh cycle" criterion is set up.

**One criterion is excluded from the e2e set: "a week boundary does not reset
anything."** `buildDayCards` takes no clock, date, or week input — there is no
boundary to roll. The absence of a clock parameter is the proof; the unit tests in
group 2 cover it. Do not build clock mocking for a no-op. **"The cycle survives a
reload" stays in the e2e set** — that one exercises real persistence.

## Sequencing

Both builders start immediately; they meet at `DayCard`.

1. **[engineer]** `types.ts` (`DayState`, `DayCard`) — land first, unblocks both.
2. **[engineer]** `logic/model.ts` + unit tests (every proposal scenario).
3. **[engineer]** `api/cycleRepo.ts` + `logic/useDayCycle.ts` + integration tests.
4. **[designer]** `RoutineSummary` states + order + a11y + i18n keys, against
   fixture `DayCard[]` — no dependency on 2/3.
5. **[engineer]** wire `useDayCycle()` into `RoutineHomeScreen`.
6. **[engineer]** e2e seeding helper per the contract above, then Playwright specs
   from the acceptance criteria (written before Build).

## Open Questions

None. Both forks are settled: `next` takes the scaled-up `InstallBanner`
treatment, not a full accent fill (§D4), and an AI edit does **not** reset the
cycle (§D2) — the proposal's "regenerating or editing" wording is being corrected
to match.
