## Context

Workout mode already reads session history for one thing: the "Last time" weight
caption. `sessionRepo.getPreviousWeight` returns the last **positive-weight** set;
`sessionRepo.getPreviousReps` returns the most recent log's **per-set reps array**,
which a seam effect uses to auto-default the reps field *per set index*.

This change makes history do two jobs instead of one:

| | source rule | destination |
|---|---|---|
| caption | last set with `weightKg > 0` (scans back through older sessions) | read-only reference |
| prefill | last set of the most recent log, `weightKg` may be 0 | committed into `session.enteredReps` / `enteredWeightKg` |

The proposal accepts that these two disagree when the last session ended on a
weight-0 set. The design must therefore keep both rules, and keep them visibly
separate.

Constraints unchanged: local-first (all reads hit Dexie in-browser), no new
network calls, `weightKg` is the canonical storage unit and the seam converts to
the display unit.

## Goals / Non-Goals

**Goals**
- One history read per exercise that answers both rules.
- Set 1 seeds reps **and** weight from the last set of the last session; sets 2+
  carry both from the previous set.
- A seam surface the designer can render without branching on domain rules.

**Non-Goals**
- Reconciling the caption and prefill rules (proposal: accepted divergence).
- Per-index history beyond set 1.
- Any change to what a completed session stores, or to the Dexie schema/indexes.

## Decisions

### D1 — One repo function returning both lookups

`api/sessionRepo.ts`: delete `getPreviousWeight` and `getPreviousReps`, add

```ts
export async function getExerciseHistory(
  exerciseId: string,
): Promise<ExerciseHistory | null>;
```

with the shape in `types.ts` (leaf — `api/` and `logic/` both import downward):

```ts
/** A logged set reduced to the two numbers history needs. */
export interface HistorySet {
  reps: number;
  /** Canonical kg. 0 is the unset/bodyweight sentinel. */
  weightKg: number;
}

export interface ExerciseHistory {
  /** Last set of the MOST RECENT completed session that logged this exercise.
   *  `weightKg` may be 0. This is the PREFILL seed. */
  lastSet: HistorySet;
  /** Last set with `weightKg > 0`, scanning sessions newest-first and
   *  continuing into OLDER sessions when a matching log has none.
   *  `null` when no session ever logged a positive weight for it.
   *  This is the CAPTION reference. */
  lastWeighted: HistorySet | null;
}
```

`null` return = the exercise has never been logged (AC2, AC4, AC8).

Scan, one pass over `completedSessions` ordered by `completedAt` descending:

```
for each session (newest first):
  for each exerciseLog matching exerciseId with series.length > 0:
    lastSet     ??= last element of series
    lastWeighted ??= last element of series with weightKg > 0   (may stay null)
    if lastWeighted: return { lastSet, lastWeighted }   // early exit
return lastSet ? { lastSet, lastWeighted: null } : null
```

Zero-weight handling is asymmetric on purpose: `lastSet` takes the tail set
whatever its weight; `lastWeighted` skips `weightKg <= 0`. Both rules read as
two lines of the same loop, so neither can be silently repurposed for the other.

*Rationale:* the two rules traverse the same rows in the same order. One
function = one full-table scan and one async state in the seam instead of two.
The divergence is documented by the type, not by a comment.

*Alternatives rejected:*
- **Two functions** (`getPreviousSet` + `getPreviousWeightedSet`) — duplicates the
  scan and the newest-first traversal, and forces the seam to sequence two
  in-flight promises per exercise. The only upside (either can be called alone)
  has no caller.
- **Keep `getPreviousReps` and add one more** — three lookups, three loading
  states, and the per-index reps array becomes dead weight the moment set 1 stops
  indexing by position.

*Perf:* worst case is unchanged from today — an exercise with no positive-weight
history still walks every completed session, exactly as `getPreviousWeight` does
now. No index change; local-first, sub-frame for realistic history sizes.

### D2 — Where the "carry vs. seed" logic moves

Two edits, in two different files, and they must both land or the behaviour is wrong.

**`logic/model.ts` — `tap`, `rest → ready`: drop `enteredReps: null`.**
The reducer currently clears reps on every new set so the seam can re-default per
set index. That is exactly the behaviour AC5/AC6 kill. After the edit the branch
carries reps the same way it already carries weight — nothing else in `tap`
changes. Update the `WorkoutSession.enteredReps` doc comment in `types.ts`: it is
no longer "reset per set".

`advanceExercise` is **unchanged** — it still clears both fields to `null`, and
that null is precisely what makes the new exercise re-seed (AC7, AC8).

**`logic/useWorkoutSession.ts` — the auto-default effect becomes a seed-once effect.**

| | before | after (as amended by D9) |
|---|---|---|
| runs on | every armed set | set 1 always; sets 2+ only when the exercise has **no** history |
| fills | `enteredReps` | `enteredReps` **and** `enteredWeightKg`, one store commit |
| source | `previousReps.reps[setIndex]` ?? plan reps at that index | `armedSetValues(...)` — history's `lastSet`, else the plan at that set index |
| guard key | `` `${exerciseId}:${setIndex}` `` | unchanged — `` `${exerciseId}:${setIndex}` `` |

`filledSetRef` survives verbatim, only its key shrinks. Its job is unchanged and
still load-bearing: `enteredReps === null` cannot be the trigger, because a user
clearing the field to retype also makes it null, and without the ref the effect
would stomp their edit back to the seed on the next render.

The "don't stomp a user edit" check becomes **per field**: fill `enteredReps` only
if it is currently `null`, fill `enteredWeightKg` only if it is currently `null`.
A user who typed reps before the async lookup landed keeps their reps and still
gets the weight seeded (AC11). The ref is stamped once when the write commits, so
nothing re-fires for that armed set afterwards. (D9 keeps this exactly as written
for set 1; sets 2+ of an unlogged exercise overwrite instead — see there for why
that is safe.)

The `phase !== "ready"` early return stays: a seed that resolves after the user
already started the set is dropped, and never applies to set 2+.

Three details the effect must not get wrong:

- **A resolved-but-stale result from the previous exercise must never seed.** The
  effect needs to distinguish three states, not two: pending, resolved-with-history,
  and resolved-with-no-history — because `history: null` is a *resolved* answer
  (no history → plan fallback), not a pending one. Get that wrong and the fields
  fill with the previous exercise's numbers. **D8 supersedes the mechanism here:**
  the history state is a `Record<exerciseId, ExerciseHistory | null>` and the test
  is `armedExerciseId in historyCache` — key presence means resolved, the value
  means which answer. Build the map from the start; there is no intermediate
  single-stamp version to write.
- **A seed that would change nothing commits nothing.** No history and no plan
  reps → both fields `null` → skip the store write and skip the stamp bump in D5,
  so there is no pointless remount.
- **Resume is already correct and must stay that way.** A session restored by
  `getInProgress` at set 1 carries its persisted `enteredReps`/`enteredWeightKg`;
  `filledSetRef` is fresh on the new mount, so the effect runs, finds both fields
  non-null, and the per-field guards make it a no-op. A resume at set 2+ needs one
  extra line under D9 — see there.

### D3 — Two pure helpers so the effect stays dumb

`logic/model.ts` (no React, no Dexie — unit-testable with `model.test.ts`):

```ts
// SUPERSEDED by D9's `armedSetValues`, which generalises it to any set index.
export function seedFromHistory(
  history: ExerciseHistory | null,
  planReps: number | null,
): { reps: number | null; weightKg: number | null };
// reps    = history?.lastSet.reps ?? planReps ?? null
// weightKg = history && history.lastSet.weightKg > 0 ? history.lastSet.weightKg : null

export function toPreviousSetView(
  history: ExerciseHistory | null,
  unit: MeasurementUnit,
): PreviousSetView | null;
// null            when history === null
// lastWeighted    → { reps: lastWeighted.reps, weight: kgToDisplay(lastWeighted.weightKg, unit) }
// otherwise       → { reps: lastSet.reps, weight: null }
```

Both branch rules live here as five testable lines; the effect and the render
derivation just call them. `seedFromHistory` returns **kg** — the seed is written
straight into `session.enteredWeightKg` with no conversion, and the existing
`weight = kgToDisplay(session.enteredWeightKg, unit)` derivation exposes it in the
display unit. `toPreviousSetView` converts because the caption is display-only.
That is AC10 for free: one conversion point, already tested.

### D4 — Logic↔UI seam contract

```
                 sessionRepo.getExerciseHistory(exerciseId)   [Dexie, browser]
                                   │
                                   ▼
              useWorkoutSession ── history state ──┬─ seedFromHistory ──▶ session.enteredReps
                                                   │                      session.enteredWeightKg
                                                   └─ toPreviousSetView ─▶ previousSet
                                   │
                                   ▼
                     ExerciseView: caption + fields
```

`WorkoutSessionApi` delta — this is the whole contract between engineer and designer:

```ts
// REMOVED
previousWeight: number | null;

// ADDED
/** The "Last time" reference in DISPLAY units, or null when the exercise has
 *  no history at all. Never blocks anything — read-only. */
previousSet: PreviousSetView | null;

/** Opaque. Changes ONLY when the seam commits new prefill values into the
 *  armed set (new exercise, or the async history seed landing). NEVER changes
 *  on a user edit. The UI uses it as the React `key` of any field that keeps
 *  local input state. See D5. */
seedKey: string;
```

```ts
// types.ts, alongside the other seam view-models
export interface PreviousSetView {
  reps: number;
  /** DISPLAY unit. `null` when the referenced set carried no weight
   *  (bodyweight) — render the reps-only caption. */
  weight: number | null;
}
```

`reps`, `setReps`, `weight`, `setWeight`, `missingSetFields`, `canStartSet` keep
their current signatures. `reps`' doc comment changes ("seeded on set 1 from the
last session's final set, carried from the previous set after that").
`PreviousSetView` is re-exported through `logic/useWorkoutSession.ts` and
`index.ts` next to `SeriesView`.

**What the UI renders**, exhaustively — no other branch exists:

| `previousSet` | caption |
|---|---|
| `null` | nothing rendered (AC2) |
| `{ reps, weight: 30 }` | `t("workout.exercise.lastTime", { reps, weight, unit })` → "Last time: 12 reps × 30 kg" (AC1) |
| `{ reps, weight: null }` | `t("workout.exercise.lastTimeReps", { reps })` → "Last time: 12 reps" (AC9) |

The UI does **no** zero-checking, no unit math, no history reasoning. `weight == null`
is the only test it makes.

### D5 — `seedKey`, and why the weight prefill is invisible without it

`WeightField` in `ExerciseView.tsx` holds its own text state
(`useState(weight != null ? String(weight) : "")`) and today re-seeds only via
`key={currentExercise.id}`. The history seed resolves **after** that mount, so a
seeded `weight` prop would never reach the input — the field would sit empty
while `session.enteredWeightKg` held the seeded value. AC3/AC7 fail silently and
`canStartSet` would be true against a field that looks blank.

Fix: the seam owns the remount signal.

```ts
const [seedStamp, setSeedStamp] = useState(0);   // bumped inside the seed effect,
                                                 // right after store.setSession(next)
const seedKey = `${armedExerciseId ?? ""}:${seedStamp}`;
```

Designer changes `key={currentExercise.id}` → `key={seedKey}` on `WeightField`.
Exactly one extra remount per seeded exercise. It cannot fire on a keystroke
because the stamp is bumped by the seed commit only, never by `setWeight`.

`RepsField` is fully controlled and needs nothing.

*Alternative rejected:* make `WeightField` controlled off `weight`. It was
deliberately left uncontrolled so a `value={String(weight)}` binding can't fight
the user mid-decimal ("37." round-tripping to "37"). Not worth reopening for this.

### D6 — Start the history lookup during `overview`

`armedExerciseId` (today `currentExerciseId`) resolves only when
`status === "in-progress"`. That means the lookup starts on the frame the
exercise view first paints, so set 1 flashes empty and a fast tapper can trip the
"field required" error against fields that were about to be filled.

Widen it to `status === "overview" || status === "in-progress"`, so the read runs
while the user is still on the overview and set 1 is seeded before the exercise
view mounts. One condition, one line. The existing
`if (store.status === "in-progress") void saveInProgress(next)` guard already
keeps the overview-time seed store-only; `start()` persists it.

*Trade-off:* the store's overview session is now mutated before Start. Nothing
renders those fields in overview, and no persistence happens, so the only cost is
tests that snapshot overview session state.

The same flash exists on `nextExercise()` (AC7), for the same reason at a different
moment. That one is closed by **D8**, which reads the next exercise's history while
the user is still working the current one.

### D7 — i18n

`workout.exercise.lastTime` gains a `{reps}` placeholder and a sibling key is
added. Both locales, same commit — a missing key renders the raw key string.

```
en  "workout.exercise.lastTime":     "Last time: {reps} reps × {weight} {unit}"
en  "workout.exercise.lastTimeReps": "Last time: {reps} reps"
es  "workout.exercise.lastTime":     "Última vez: {reps} reps × {weight} {unit}"
es  "workout.exercise.lastTimeReps": "Última vez: {reps} reps"
```

Keys are flat and alphabetically sorted; `lastTimeReps` sits directly after
`lastTime`. `×` is U+00D7, not the letter x.

**The Spanish short form `reps` is deliberate and approved — do not "fix" it to
match `setCell`'s `repeticiones`.** This is a one-line caption under two side-by-side
fields at the 375px floor; `repeticiones` wraps it. `setCell` is a screen-reader
label with no width budget, so the two legitimately differ.

### D8 — Prefetch the next exercise's history

D6 removed the empty-field flash on the *first* exercise. `nextExercise()` still
has it: exercise 2's history can only start loading once exercise 2 is current,
so the fields paint empty for the length of an IndexedDB read. Close it by
reading exercise 2's history while the user is still working exercise 1.

**One cache, one effect.** D2's history state is already this map — D8 adds only the
second id it is asked to fill:

```ts
const [historyCache, setHistoryCache] =
  useState<Record<string, ExerciseHistory | null>>({});
const inFlightRef = useRef(new Set<string>());

const nextExerciseId = day?.exercises[(session?.currentExerciseIndex ?? 0) + 1]?.id ?? null;
```

The lookup effect ensures an entry for **both** `armedExerciseId` and
`nextExerciseId`: for each non-null id that is neither a key of `historyCache` nor
in `inFlightRef`, call `getExerciseHistory` and merge the result in. Deps
`[armedExerciseId, nextExerciseId, historyCache]`; it converges because a merged
key is skipped on the re-run. `inFlightRef` exists only to stop the re-run from
re-issuing a read that is still pending.

Prefetch fires as soon as the exercise is armed — not on `exercise-complete`. Two
IDB reads instead of one, issued together, with no phase trigger to get wrong.

**The seed effect changes by one line.** Its resolved-vs-pending test moves from
"the stamp matches `armedExerciseId`" to `armedExerciseId in historyCache`; it then
reads `historyCache[armedExerciseId]` and calls `seedFromHistory` exactly as
before. `toPreviousSetView` reads the same entry. **A cache miss is not an error
case** — the id is simply not a key yet, the effect waits, and the in-flight read
merges it a moment later. Prefetch is latency, never correctness: delete the
`nextExerciseId` half and every AC still passes, just slower.

**Staleness: there is nothing to invalidate, and one invariant makes that true.**
`getExerciseHistory` reads `completedSessions` only, and a session writes exactly
one `completedSessions` row, in `tap`'s `finishedExercise` branch, when the day's
**last** exercise completes — after which `status` becomes `success` and no set is
ever seeded again. So for the whole life of a session the table this cache mirrors
is immutable, including for an exercise that appears twice in one day. The cache
is cleared only where session identity changes: alongside the existing
`store.setSession(...)` calls in the mount/resume effect, which already re-runs on
`initKey`. If a future change ever writes a completed session mid-session, this
cache must be dropped with it — that is the one thing that breaks it.

**The `seedKey` contract does not change.** Still `${armedExerciseId}:${seedStamp}`,
still bumped only by a seed commit. **Designer task 5.3 is unaffected** — the same
one-line `key={seedKey}` swap, no new prop, no new branch.

**Edges.** Last exercise of the day: `nextExerciseId` is `null`, nothing is
prefetched, no special case. User advances faster than the prefetch: the key is
absent, the in-flight read merges and the seed fires — identical to the
no-prefetch path.

*Accepted residual:* even on a cache hit the seed commits in a `useEffect`, so
there is one post-paint frame where the fields are empty. That is ~16ms, versus
the tens of ms of IDB latency this removes. `useLayoutEffect` would close it, at
the cost of an SSR warning on a `'use client'` tree — not worth it unless the
no-flash test in tasks 4.6 actually catches it.

*Alternative rejected:* a dedicated prefetch effect + a separate `nextHistory`
state (on top of D2's single-exercise state). Two states holding the same kind of value, plus a hand-off when the user
advances, plus a third code path for "the value I prefetched is now the value I
need". The map collapses all of that into key presence.

### D9 — No history: the plan's reps, per set index (scope amendment)

Surfaced by the build, not by an AC. Plan 12/10/8, exercise never logged: D2's
unconditional carry means set 2 arms holding set 1's **12**, and the plan's
prescribed **10** is gone. The rule becomes conditional on history.

| | set 1 reps | sets 2+ reps | set 1 weight | sets 2+ weight |
|---|---|---|---|---|
| **has history** | `lastSet.reps` | carried | `lastSet.weightKg` if > 0, else empty | carried |
| **no history** | `planReps[0]` | `planReps[setIndex]` | empty | carried |

**The condition does not go in `tap`.** It is a pure reducer over
`(session, day, now)`; giving it an `ExerciseHistory` parameter would put an
async-sourced, persistence-shaped concept inside a synchronous transition and
force every caller and every `model.test.ts` case to construct history to test
timer behaviour. `tap` keeps carrying reps unconditionally — D2 stands as written.

**It goes in the seam effect**, which already holds `historyCache`. The effect
stops being seed-*once-per-exercise* and becomes **apply-once-per-armed-set** —
which is what the original code did, and what `filledSetRef` was built for.
Its key returns to `` `${exerciseId}:${setIndex}` ``, literally its pre-change
form: inert in the has-history branch (only index 0 is ever eligible), and the
thing that caps each armed set at one write in the no-history branch. The
"don't stomp a user edit" guarantee is therefore unchanged, verbatim — a user
clearing the field to retype still cannot trigger a refill, because the trigger
was never `enteredReps === null`, it is the ref.

**Write semantics differ by set index, and that is the whole subtlety.**

- **Set 1: fill-if-null, per field** (D2, unchanged). There is a real async window
  — the history read — in which the user can type ahead, and AC11 says their
  typing survives.
- **Sets 2+ (no-history branch only): overwrite.** There is no async window: the
  plan is in `day` and history is already resolved, so the value is known the
  instant the set arms and there is no user-typed value to protect. Overwrite is
  also *required* — the carried 12 must become 10. `filledSetRef` still caps it at
  one write, so every edit the user makes after the set is armed is untouched.

**Resume needs one line.** A session restored at set index > 0 of an unlogged
exercise would otherwise get its persisted `enteredReps` overwritten by the plan,
throwing away what the user typed before the reload. Fix: the mount/resume effect
stamps `filledSetRef.current = ` `` `${exerciseId}:${setIndex}` `` when the restored
`setIndex > 0` — a resumed set is already armed, so its one write has already
happened. Set 1 needs no stamp; its fill-if-null guard already protects restored
values.

**`seedFromHistory` is superseded by one generalised helper** in `logic/model.ts`:

```ts
export function armedSetValues(params: {
  history: ExerciseHistory | null;
  planReps: number[];              // exercise.sets.map((s) => s.reps)
  setIndex: number;
  carriedWeightKg: number | null;  // session.enteredWeightKg as the reducer left it
}): { reps: number | null; weightKg: number | null } | null;
```

`null` means "apply nothing, the carry is already right" — the has-history,
`setIndex > 0` case, and the only case the effect skips. Otherwise:

| branch | returns |
|---|---|
| `history && setIndex === 0` | `{ reps: lastSet.reps, weightKg: lastSet.weightKg > 0 ? lastSet.weightKg : null }` |
| `!history && setIndex === 0` | `{ reps: planReps[0] ?? null, weightKg: null }` |
| `!history && setIndex > 0` | `{ reps: planReps[setIndex] ?? null, weightKg: carriedWeightKg }` |

Four lines, every branch of the amended rule visible side by side, still pure and
still unit-tested without React.

**`seedStamp` gets one condition**: bump only when the applied `weightKg` differs
from the session's current value. In the no-history sets-2+ case the weight *is*
the carried value, so nothing changes, no stamp bump, no `WeightField` remount.
**The designer contract does not change** — `seedKey` and task 5.3 are untouched.

**The fork, and how to flip it.** No history, plan 12/10/8, user edits set 1 to 15:
does set 2 show 10 or 15? **Implemented: 10** — the `!history && setIndex > 0` row
above. With no history the plan is the only signal there is, and this amendment
exists precisely to stop set 1's number leaking into set 2; set 1's edit is still
fully honoured where it counts, since 15 is what set 1 records. If the PO settles
on carry-wins, exactly one row changes:

```ts
// carry-wins variant — honour a diverged previous set, else the plan
prevRecordedReps !== planReps[setIndex - 1] ? prevRecordedReps : planReps[setIndex]
```

with `prevRecordedReps = session.currentSeries[setIndex - 1].reps` added as a
parameter. One extra argument, one ternary, nothing else moves. *Technical view:*
plan-wins is cheaper and more predictable — carry-wins needs a "did the user
diverge?" comparison the user cannot see, and it re-creates the leak the amendment
removes.

## Open Questions

- **No-history reps after a user edit** (D9's fork). The design implements
  plan-wins and the delta spec's "Later sets of an unlogged exercise follow the
  plan" scenario states it. If the product-owner's parallel proposal amendment
  picks carry-wins, flip the one row in `armedSetValues` and rewrite that one
  scenario — nothing else in this change is affected.

## Testing strategy

Level per AC. Vitest + RTL + fake-indexeddb for everything below the browser;
Playwright for the two ACs that only exist end-to-end.

| Level | File | Covers |
|---|---|---|
| repo unit | `api/sessionRepo.test.ts` | `getExerciseHistory`: no history → `null`; positive-weight tail → both fields equal; tail at weight 0 with an earlier positive set → `lastSet.weightKg === 0` **and** `lastWeighted` from the earlier set (the divergence); only-zero-weight history → `lastWeighted === null`; positive weight found in an **older** session than the most recent log; empty `series` skipped. Replaces the `getPreviousWeight` / `getPreviousReps` describes. |
| pure unit | `logic/model.test.ts` | `armedSetValues`: all four branches of D9's table, including plan 12/10/8 with no history at `setIndex` 1 → 10. |
| pure unit | `logic/model.test.ts` | `seedFromHistory` (history → last set; no history → plan reps + null weight; weight 0 → null weight); `toPreviousSetView` (three branches, metric + imperial); `tap` on `rest → ready` **keeps** `enteredReps` (the D2 regression pin). |
| seam | `logic/useWorkoutSession.test.tsx` | seed fires once per exercise; does not fire for set 2+; does not stomp a field the user already filled; re-seeds after `nextExercise`; `previousSet` and `seedKey` values; the next exercise's history is read before the user advances (D8). |
| integration | `workoutSession.integration.test.tsx` | AC3, AC4, AC5, AC6, AC7, AC8, AC11, AC12 — real Dexie via fake-indexeddb, real seam, real `ExerciseView`. History reps **must** differ from plan reps (history 9, plan 10) or the assertions prove nothing. Assert the **rendered input values**, not the seam's `reps`/`weight`, so D5 is actually covered. The AC7 case doubles as the D8 no-flash pin: read the fields with a synchronous `getBy*` right after the advance, never `findBy*`. |
| UI unit | `ui/workoutMode.test.tsx` | AC1, AC2, AC9 — the three caption branches off a stubbed `previousSet` (`null`, `{reps, weight}`, `{reps, weight: null}`). Existing `previousWeight` stubs at ~130/~326/~337 and the assertion at ~344 update to `previousSet`. |
| e2e | `e2e/prefill-sets-from-last-session.spec.ts` (new) | AC3 + AC1 together on a real browser (seed `completedSessions` via the `page.evaluate` IDB pattern already used in `e2e/consistency-calendar.spec.ts`), and AC10 with an imperial profile. |
| e2e regression | `e2e/workout-mode.spec.ts`, `e2e/clock-button-empty-field-error.spec.ts` | must stay green — the no-history path still blocks an empty field, and prefilled sets must not break the error flow. |

The e2e specs and the §2 integration cases are written **before** the
implementation and are the definition of done. Not every AC needs a browser —
the table above assigns each one the cheapest level that can actually fail for
the right reason; e2e is reserved for the ACs that depend on real IndexedDB plus
real input elements.

## Risks / Trade-offs

**[The existing reps prefill is reported broken — do not assume the path works]**
The user reports seeing the plan's reps, not last session's. There is no seam- or
integration-level test for it anywhere; `sessionRepo.test.ts` covers
`getPreviousReps` in isolation and nothing covers the effect that consumes it.
Two candidate causes, both plausible: (a) `previousReps.reps?.[index]` is
`undefined` whenever the last session logged fewer sets than the current index,
silently falling through to the plan — visible from set 2 onward; (b) the last
session's reps were themselves plan-defaulted, making the two indistinguishable.
→ Mitigation: the engineer writes the failing integration test **first**, with
history reps deliberately different from plan reps (history 9, plan 10). The new
design removes cause (a) structurally — set 1 reads `lastSet`, never an index —
and the test is the proof, not the reasoning above.

**[Seeded weight never reaches the input]** → D5. Covered by an integration test
that asserts the *rendered input value*, not just the seam's `weight`.

**[Caption and prefill disagree]** Accepted by the proposal. The `ExerciseHistory`
type makes the divergence explicit rather than emergent, and `model.test.ts` pins
the exact case: a log ending on `weight 0` after a positive-weight set → caption
shows the positive one, prefill shows the 0 (weight field empty).

**[A seed landing after a blocked tap leaves a stale error]** The user taps the
stopwatch before the seed resolves, gets the "field required" error, and then the
seed fills the field — `shownErrors` is stamped by `setKey`
(`${exerciseId}:${timer.currentSeries}`) and only clears on a user *edit*, so a
filled field can sit there marked red. D6 makes this a narrow race (the seed
normally lands before the exercise view paints) and it is not a regression — the
same window exists today. → **Decided, not deferred:** fold `seedKey` into
`ExerciseView`'s `setKey` (task 5.3), giving
`` `${seedKey}:${timer.currentSeries}` ``. Errors then clear on exactly three
events — new exercise, new set, seed committed — and `seedStamp` never moves on a
user edit, so nothing else changes. Chosen over adding a test for the race: the
test would be timing-dependent, and it would pin behaviour we would then delete
this very line to fix. One deterministic line beats a flaky guard.

**[Full-table scan]** `getExerciseHistory` walks every completed session when the
exercise has no positive-weight history. Identical to today's cost; not worsened,
not fixed. If session counts ever make this bite, the fix is an index on
`exerciseId`, which is a schema migration and out of scope here.

**[Deleting `getPreviousReps` / `getPreviousWeight`]** `logic/summary.ts:61` only
*references* `getPreviousWeight` in a comment describing matching semantics —
update the comment, no code depends on it. No other importer exists.
