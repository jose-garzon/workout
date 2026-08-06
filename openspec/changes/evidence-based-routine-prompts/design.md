# Design — evidence-based routine prompts

## Context

Motivation is in `proposal.md`. Three files change, all engineer-owned:

- `src/modules/routine-generation/api/ai/prompt.ts` — both system prompts.
- `src/modules/workout-mode/logic/summary.ts` — the summarizer.
- `src/modules/workout-mode/logic/useSessionSummary.ts` — the seam that feeds it.

Source material: `reference/coaching-context.md` (verbatim, user-supplied). It is written for a
general-population coach who *talks*. Our model emits JSON only, one shot, under a fixed schema. The
design's job is to land the parts that are expressible as **exercise selection, exercise order, set
count, reps, rest seconds** and drop the rest.

## Goals / Non-Goals

**Goals**

- Make the create prompt's programming decisions rule-driven and conditional on `focus` + `age`.
- Give the edit prompt diagnostic rules, and give those rules data to read.
- Keep `prompt.ts` a pure, server-safe dependency leaf (firewall rule 4).
- Keep `summarizeSessions` pure and unit-testable.

**Non-Goals** — as in `proposal.md`. Binding here: `schema.ts` byte-identical, no Dexie migration,
no new stored/profile field, no UI change, no new network call, no prose in the response.

---

## Decisions

### D1 — Coaching content lives in one new sibling, `api/ai/coaching.ts`

`prompt.ts` keeps message *assembly*; `coaching.ts` holds the coaching *content* — the block
constants plus three selectors:

```ts
// modules/routine-generation/api/ai/coaching.ts — pure, no imports
export const PROGRAMMING_FRAME: string;        // volume dose, per-session cap, frequency, selection, ordering
export const REASONING_IS_INTERNAL: string;    // the no-prose bridge
export const EDIT_DIAGNOSTICS: string;         // the edit-time audit rules
export function splitGuidance(daysPerWeek: number): string;
export function focusBands(focus: string): string;
export function ageAdjustment(age: number): string | null;
```

**Rationale.** Two different rates of change: content churns as the coaching frame is tuned;
assembly is stable. Keeping them together pushes `prompt.ts` past ~450 lines of mixed concern.
The selectors are directly unit-testable without building a whole message.

**Firewall check — no config change needed.** Biome rule 4 is a per-file forbid-list scoped to
`src/app/api/**/route.ts`; it lists forbidden *patterns* (`@/shared/db`, `**/*Repo`,
`**/api/ai/client`), not an allow-list. `route.ts` imports `openrouter.ts`, which imports
`./prompt`, which will import `./coaching`. Nothing in that chain is forbidden, and dependency-cruiser
rule 3 is cross-*feature* only, so an intra-feature sibling is invisible to it. `coaching.ts` must
import nothing (pure string constants + pure functions) — that is what keeps the server graph clean,
and it is discipline, not a new rule. **No new firewall fixture is required** (see D9).

**Alternatives rejected.** (a) Everything inside `prompt.ts` — one fewer file, but a ~450-line file
mixing "what the coach knows" with "how a request is shaped"; rejected on readability. (b) A
`shared/coaching` slice — needs no new Biome rule either, but adds a shared-layer dependency to the
server graph for content only one feature will ever use.

### D2 — Fixed lookups, with defaults for out-of-band wire values

`focus` and `daysPerWeek` reach `buildRoutinePrompt` as a bare `string`/`number` (see
`openrouter.ts` `parseBuildBody` — it only checks `typeof`). Neither selector may throw or return
empty.

`splitGuidance(daysPerWeek)` — **normalize, then clamp**, so the chain is total:

```
n = Number.isFinite(daysPerWeek) ? Math.round(daysPerWeek) : 3
```

| `n` | split |
| --- | --- |
| ≤ 2 | full body |
| 3 | full body ×3, or upper / lower / full |
| 4 | upper / lower ×2 |
| 5 | upper / lower / push / pull / legs |
| ≥ 6 | push / pull / legs ×2 |

The normalize step is load-bearing, not defensive padding: a raw comparison chain silently drops
**`NaN`** (every comparison against it is false) and **`3.5`** (between the `3` and `4` cases), and
both reach the selector — `parseBuildBody` (`openrouter.ts:69`) checks only
`typeof daysPerWeek === "number"`. After rounding, `≤2` and `≥6` absorb every remaining integer, so
the chain has no hole. Non-finite falls back to `3` — the modal training frequency, and the row whose
guidance (full body) is the most broadly safe when the real value is unknown. This mirrors the
fallbacks the other two selectors already have (`focusBands`: unknown string → hypertrophy;
`ageAdjustment`: non-finite → `null`).

`focusBands(focus)` — reps and rest per exercise tier. Unknown string ⇒ the `hypertrophy` table.

| focus | heavy compound | secondary compound | isolation |
| --- | --- | --- | --- |
| `hypertrophy`, `general`, unknown | 5–10 reps / 120–180 s | 8–15 reps / 90–120 s | 10–20 reps / 60–90 s |
| `strength` | 3–6 reps / 180–300 s | 5–8 reps / 150–180 s | 8–12 reps / 90–120 s |
| `endurance` | 12–20 reps / 60 s | 15–25 reps / 45 s | 15–30 reps / 30–45 s |

`general` additionally asks for balanced coverage of every major muscle group. `endurance` is the one
place the source's "never rest under 60 s" is deliberately relaxed (proposal, tension 2).

`ageAdjustment(age)` — **three bands**, implemented as four explicit range checks (not an
`if/else` chain), so a non-finite `age` from the wire falls through to `null` rather than into the
youth branch:

| check | result |
| --- | --- |
| `age < 18` | youth block |
| `age >= 18 && age < 40` | `null` — no block emitted |
| `age >= 40 && age < 60` | mid block |
| `age >= 60` | senior block |

Boundaries: 18 falls in the `null` band, 40 in the mid band, 60 in the senior band.

- **youth (`< 18`)**: compose each training day to cover the whole body rather than isolate one body
  part; keep every set at moderate reps (no working set below 8 reps, even on heavy compounds); avoid
  near-maximal loading.
- **mid (`40–59`)**: bias the highest-load movements to machines and cables; rest at the top of each
  band.
- **senior (`≥ 60`)**: low end of the weekly volume range (8–12 sets/muscle); machine and cable bias;
  rest at the top of each band; include a loaded-carry or single-leg balance movement where it fits.

The youth band is included because onboarding genuinely admits minors: `validateField("age", …)` in
`profile-goals/logic/model.ts` accepts any integer **13–120**. Only the schema-expressible parts of
the source's `<18` rule land — day composition, rep ranges, load ceiling. Its "technique-first" and
"3+ RIR" clauses are **excluded**: neither is emittable under the schema, and beginner form guidance
is a locked non-goal.

**Precedence — settled: day count wins.** `daysPerWeek` always determines the number of day entries.
`ageAdjustment` is a *modifier*, never a structural override: it may narrow rep/rest bands and bias
exercise selection and day composition, but it **emits no text that changes, caps, or comments on the
number of training days**. The day count feeds the calendar's weekly session target (`days.length`),
so a mismatch is a user-visible data bug.

The source's `<18` rule carries a "2–3 days/week" cap. That clause is **dropped**; only its
composition half survives — full-body-style days rather than a body-part split, at whatever count the
user asked for. The existing
`"Return EXACTLY as many day entries as the requested training-days count."` directive and
`splitGuidance(daysPerWeek)` are unaffected by any age band.

The youth block **opens** with a one-line restatement of this — keep the requested day count exactly
as instructed above; adjust only how each day is composed — before stating the composition, rep and
load guidance.

**Second-order collision, same resolution.** For `focus: "strength"` the heavy-compound band is 3–6
reps, which contradicts the youth band's "no working set below 8 reps". `ageAdjustment` is assembled
**after** `focusBands` (design §D3, step 6 follows step 5), so it reads as the later, narrowing
instruction; the youth block states explicitly that its rep floor overrides the band above it. This
narrows reps only — it never touches the day count.

The `REASONING_IS_INTERNAL` invariant applies to the youth band like every other block: no "because
you are young", no safety or form language, nothing about age in `name`, `subtitle`, a day name, or
an exercise name.

**Schema-shape guard (load-bearing).** The schema stores one integer `reps` and one integer
`restSeconds` per set — it has no range field. `PROGRAMMING_FRAME` must therefore state: *pick a
concrete integer inside the band for each set; never write a range, a "+", or an RIR into any field.*
Without this the bands invite `"reps": "8-12"`, which fails `routineSchema`.

### D3 — Block order: coaching first, JSON contract last

The system prompt roughly triples, so placement matters more than it did. Weak/free models already
need the contract restated because they ignore `response_format`; a long prompt makes burying it
worse. **Order (create):**

1. Role — intermediate lifter, full gym, structure only, subtitle *(existing, unchanged)*
2. `INTERPRET` *(existing)*
3. `PROGRAMMING_FRAME`
4. `splitGuidance(daysPerWeek)` — immediately followed by the existing
   "Return EXACTLY as many day entries as the requested training-days count." line
5. `focusBands(focus)`
6. `ageAdjustment(age)` — omitted entirely when `null`
7. `REASONING_IS_INTERNAL` — the bridge from "how to think" to "what to emit"
8. `OUTPUT_CONTRACT` → 9. `SCHEMA_SHAPE` → 10. `EXAMPLE` *(existing, unchanged)*
11. `languageDirective(language)` *(existing)*

**Edit:** existing rule paragraph (+ the anti-proactive sentence appended) → `EDIT_DIAGNOSTICS` →
`OUTPUT_CONTRACT` → `SCHEMA_SHAPE` → `EXAMPLE` → `languageDirective`.

**Rationale.** All new material sits *before* the format blocks, so the last thing the model reads
before the language directive is still the JSON contract and the worked example — the recency slot
that made those blocks work in the first place. The day-count guard stays adjacent to the split
guidance that could otherwise contradict it. `languageDirective` **stays last**, for its original
documented reason: it must follow `EXAMPLE`, whose English exercise names the model would otherwise
copy. The `REASONING_IS_INTERNAL` block is the hinge — it converts every dropped "state your
reasoning" instruction from the source into an explicit prohibition instead of silence.

**Trade-off.** Create system prompt goes from ~1.4 kB to ~5–6 kB, roughly +900 input tokens per
generate and +500 per edit. One call per generate/edit, so acceptable (proposal, Impact). Budget:
keep the coaching additions under ~3 kB total; if a block cannot earn its bytes, cut it rather than
tuning wording.

### D4 — The cross-feature join happens in the seam hook, not the summarizer

**`summarizeSessions` stays pure; its parameter list widens.** The caller supplies the routine facts
and the weekly target:

```ts
// modules/workout-mode/logic/summary.ts
export interface SummaryContext {
  /** Prescribed exercises across the active routine's days, in routine order. */
  prescribed: { id: string; name: string }[];
  /** Number of days in the split — the "one full rotation" guard for skip detection. */
  dayCount: number;
  /** Weekly session target from goals; null when goals are unsaved. */
  daysPerWeek: number | null;
}

export function summarizeSessions(
  sessions: CompletedSession[],
  ctx: SummaryContext,
): string | null;
```

`ctx` is **required, not optional** — the same convention as `language` in `buildRoutinePrompt`, so
`tsc` catches a missed call site instead of silently degrading the summary.

**The join lives in `useSessionSummary`**, which:

- already reads `useActiveRoutine()` and today throws away everything but `.id` → it now also
  flat-maps `routine.days` into `prescribed` and reads `routine.days.length` into `dayCount`;
- adds `useProfile()` from `@/modules/profile-goals` for `goals?.daysPerWeek ?? null`.

**Firewall / cycle check.** Cross-feature edges are barrel-only (rule 3) and the graph stays
A ← B ← D ← C: `profile-goals` and `routine-generation` import no other feature; `workout-mode/logic`
already imports **both** barrels (`useWorkoutSession.ts` imports `useProfile` *and*
`useActiveRoutine`; `model.ts` imports `MeasurementUnit` and `RoutineDay`). So the D→A edge is
precedented, not new. There is **no cycle** with `routine-generation`: B never imports D — the summary
reaches the edit as a plain `string` through the composition layer (`src/app/page.tsx` →
`RoutineHomeScreen` → `useRoutineEdit.submit`). Nothing about that path changes.

`prescribed` is a locally-declared minimal `{ id, name }` shape rather than B's `Exercise`, for the
same reason `PromptContext` is minimal: `summary.ts` stays a leaf and its tests need no B fixtures.

**Call sites that change — exactly three, all in `workout-mode`:**

1. `logic/summary.ts` — the signature.
2. `logic/useSessionSummary.ts` — builds `ctx`, adds the `useProfile()` read.
3. `logic/summary.test.ts` — every `summarizeSessions(...)` call gains a `ctx`.

`src/app/page.tsx`, `RoutineHomeScreen.tsx`, `useRoutineEdit.ts`, `client.ts`, `openrouter.ts` and
every UI file are **untouched** — `useSessionSummary()` keeps its no-argument,
`string | null` contract.

**Alternatives rejected.** (a) *Move the summarizer into `routine-generation`* — it would then need
`CompletedSession` + `sessionRepo` from D, creating the B→D edge that is exactly the cycle rule 3
forbids. (b) *Pass `daysPerWeek` down from `app/page.tsx`* (it already has `goals` in hand) — zero new
imports, but it breaks the seam's documented "self-resolving, no-argument, composition layer needs
zero branching" property and makes correctness depend on the caller. (c) *Read the repos inside
`summarizeSessions`* — destroys purity and drags Dexie into a unit test.

### D5 — Adherence: span-based, no clock

Data available: `completedAt` per session (window = the ≤20 most recent for **this** routine) and
`Goals.daysPerWeek`. No prescription ledger, no `startedAt`.

```
completed  = sessions.length
firstAt    = min(completedAt), lastAt = max(completedAt)
spanDays   = floor((lastAt - firstAt) / 86_400_000) + 1     // inclusive
weeks      = spanDays / 7
expected   = max(1, round(weeks * daysPerWeek))
percent    = round(completed / expected * 100)
```

Worked example (the AC fixture): 8 sessions whose first and last `completedAt` are **20 days apart**
give `spanDays = 21`, `weeks = 3.0`, `expected = 12`, `67%`. Note the inclusive `+ 1` when writing
fixtures — 21 days apart would give `weeks = 3.14` and `expected = 13`.

Rules:

- `daysPerWeek === null` (goals unsaved) → **omit the adherence line entirely.** No guessed target.
- `spanDays < 7` → do not rate. Emit
  `Adherence: 3 sessions over 5 days, target 4/week (window under one week — not rated).`
  A sub-week window cannot distinguish "started Friday" from "missing three sessions".
- otherwise `Adherence: 8 of ~12 expected sessions (67%), target 4/week.`
- **Routine created mid-window is already handled**: `getCompletedForRoutine` filters by `routineId`,
  so the span starts at this routine's first logged session. No `createdAt` input needed.

- Pluralize `session`/`day` — a one-session window must read `1 session over 1 day`, matching the
  care the existing per-exercise and ratings lines already take.

**Known limitation, accepted.** The window is bounded by sessions at *both* ends, so idle stretches
before the first and after the last logged session are invisible: a user who stopped three weeks ago
still shows 100%. Fixing that needs `now` injected into a currently-deterministic pure
function, which would make `useLiveQuery` emit a different string on every re-render and force clock
control in tests — for a signal the edit prompt cannot act on anyway, since the user is in the app
right now submitting an edit. **Mitigation:** the header states the window explicitly
(`last 12 sessions, ~3.0 weeks`) so the model reads adherence *within* the observed window, not as an
all-time claim.

### D6 — Trend: representative-set load × reps, first vs last of the last 4, ±2 %

One **exposure** = one session containing an `ExerciseLog` for that `exerciseId`.

- Exposure metric = `rep.weightKg * rep.reps`, where `rep` is the existing `repSeries(log)` — the last
  set with `weightKg > 0` ("what you finished on"). Reusing it keeps *one* notion of "representative
  set" in the file and matches `getPreviousWeight` semantics.
- `weightKg <= 0` is the unset/bodyweight sentinel: an exposure whose sets are all sentinel (or whose
  metric is `0`) still counts toward the **exposure count** but contributes **no metric point**.
- Fewer than **3 metric points** → **no trend declared**. The line ends after weights/reps.
- With ≥3: take the last 4 metric points, `delta = (last - first) / first`.
  - `delta > 0.02` → `trending up`
  - `delta < -0.02` → `trending down`
  - otherwise → `flat`

**Why ±2 %.** Strict equality would essentially never fire — reps vary set to set. 2 % sits below the
smallest deliberate progression (a 2.5 kg plate on a 60 kg lift ≈ 4 %; +1 rep on a set of 10 = 10 %)
and above logging noise (1.25 kg microplates, rounding). **Trade-off:** first-vs-last ignores shape,
so a V (down then back up) reads flat. Accepted — 3–4 points do not support a regression, and the
source's rule is literally "trending up, flat, or down over the last 3–4 exposures".

### D7 — Skipped = prescribed and never logged in the window, gated on one full rotation

- An exercise is **skipped** iff its `id` is in `ctx.prescribed` and it has **zero** exposures across
  the whole window.
- **Gate:** emit the line only when `sessions.length >= ctx.dayCount` — at least one full rotation of
  the split. Below that, "never logged" just means "that day has not come round yet".
- **Renames are safe for free.** Logs key on `exerciseId`, and the edit merge preserves ids for
  unchanged exercises (existing requirement, `session-aware-editing`). A rename therefore cannot
  produce a false skip.
- **Additions** can still produce one (a genuinely new exercise has no history). Mitigations: the
  line is phrased `Prescribed but never logged in this window: …`, and `EDIT_DIAGNOSTICS` carries
  *"an exercise never logged may have been added recently — do not remove it unless asked"*.
- A logged exercise **absent** from `prescribed` (removed by an earlier edit) still appears in the
  per-exercise trend lines — it is real history — and is never reported as skipped.
- Cap the named list at 8, then `(+N more)`.

### D8 — Training time: derived, per-session average, halves comparison

Per session: `sum over exerciseLogs of ( sum(series[].workSeconds) + log.restSeconds )`, reported in
minutes. Both fields already exist on `SeriesLog.workSeconds` and `ExerciseLog.restSeconds` —
**no Dexie migration, no new capture** (confirmed against `workout-mode/types.ts`).

- Always emit the average: `Training time: ~48 min/session avg.`
- Direction only when `sessions.length >= 4`: compare the mean of the chronologically **first half**
  against the mean of the **last half** (odd `n` drops the middle session).
  `> +10 %` → `rising`, `< -10 %` → `falling`, else `steady`.
  `Training time: ~48 min/session avg, rising across the window.`

**Why halves rather than first-vs-last.** Different days of a split have very different durations
(Push vs Legs); comparing two single sessions mostly measures which day they were. **Why ±10 %** and
not the trend rule's 2 %: session composition varies far more than a single lift's load.

### D9 — Summary format and hard bound

Model-facing only, never rendered — so it stays **untranslated** (the existing i18n exemption holds)
and weights stay in **canonical kg** with no unit conversion. Both existing decisions are preserved.

```
Recent history (last 12 sessions, ~3.0 weeks):
Adherence: 8 of ~12 expected sessions (67%), target 4/week.
Prescribed but never logged in this window: Leg Curl, Face Pull.
- Bench Press: 6 exposures, 60→70 kg, ~8 reps, trending up
- Back Squat: 5 exposures, 100 kg, ~5 reps, flat
- Lat Pulldown: 2 exposures, 55→57.5 kg, ~10 reps
Training time: ~48 min/session avg, rising across the window.
Session ratings: avg difficulty 3.2/5, avg fatigue 2.8/5 (over 9 rated sessions).
```

Order follows the source's audit order: adherence → skips → progression → time → subjective. Existing
per-exercise segments (`first→last kg`, single weight when unchanged, `~N reps`) are unchanged; only
`N session(s)` becomes `N exposures` and an optional trend segment is appended.

**Bound.** Per-exercise lines are capped at **20**, ordered by exposure count descending (ties: most
recent exposure first), with `(+N more exercises omitted)` when truncated. 20 covers any realistic
split (5 days × 6 exercises = 30 distinct, cut to the 20 most-trained — the omitted ones are the
least informative). Ceiling: 1 header + ≤20 exercise lines + ≤4 aggregate lines ≈ **2.5 kB**, against
a routine JSON of 2–4 kB in the same message. This changes today's first-appearance ordering; the
existing tests assert with `toContain`, so no ordering assertion breaks.

### D10 — No new firewall fixture

Checked against `biome.json` and `.dependency-cruiser.cjs`:

- `coaching.ts` is a new *intra-feature* sibling under `api/ai/`; the `src/modules/*/api/**` Biome
  override only forbids upward `logic/`/`ui/` imports, which it has none of. Rule 4 is scoped to
  `route.ts` files and is a forbid-list — unaffected.
- The D→A barrel import in `useSessionSummary` is already exercised by `useWorkoutSession.ts`.
- No new cycle, no new deep import.

The four Biome fixtures + two depcruise fixtures in `test/firewall-fixtures/` already cover every
rule this change touches. **No fixture added.**

### D11 — Backward-compatibility invariants

Two promises from the proposal, each already guarded by an existing test that must stay green:

1. **Empty window still returns `null`.** `summarizeSessions([], ctx)` short-circuits before any new
   arithmetic — the `sessions.length === 0` guard stays the first statement in the function, so no
   adherence, skip, or time line can be emitted for an empty window regardless of `ctx`. Guarded by
   `summary.test.ts` "returns null for an empty window" (the call gains a `ctx`, the assertion does
   not change).
2. **A `buildEditPrompt` call with no `sessionSummary` produces a byte-identical *user* message.**
   Every edit-side addition (`EDIT_DIAGNOSTICS`, the anti-proactive sentence) is **system-side**; the
   `lines` array in `buildEditPrompt` is untouched. Guarded by `prompt.test.ts` "is byte-identical to
   a history-less edit when the summary is absent or empty", which compares `undefined` and `"   "`
   against the no-summary baseline and asserts the absence of `"Recent workout history:"`.

Note the scope: the **system** message intentionally changes on every edit. The invariant is about the
user message only, and both are spec'd that way in the `session-aware-editing` delta.

Also unchanged and asserted by existing tests: the create prompt's user message (goal / days / gender
/ age / bodyweight / height / notes lines and their unit formatting), `useSessionSummary`'s
`string | null` signature, and the ratings-line behaviour.

---

## Risks / Trade-offs

- **[Tripled system prompt makes weak models drift into prose or truncate]** → All coaching sits
  before the format blocks (D3); `OUTPUT_CONTRACT` + `SCHEMA_SHAPE` + `EXAMPLE` keep the recency slot;
  a spec'd ordering invariant is asserted in tests; `REASONING_IS_INTERNAL` explicitly forbids the
  explanation the source keeps asking for. Client-side Zod validation is still the backstop.
- **[Rep/rest *bands* invite a range string into an integer field]** → An explicit "pick a concrete
  integer, never a range" line in `PROGRAMMING_FRAME` (D2), plus the unchanged `SCHEMA_SHAPE` and
  `EXAMPLE`, which show integers only.
- **[Span-based adherence flatters an inactive user]** → Accepted (D5); the header names the window
  so the model never reads it as an all-time figure.
- **[A newly added exercise reads as skipped]** → One-full-rotation gate, "in this window" phrasing,
  and an explicit "do not remove it unless asked" diagnostic (D7).
- **[Richer summary inflates the edit payload]** → 20-line cap with exposure-descending priority,
  ~2.5 kB ceiling (D9).
- **[Diagnostics tempt the model into unrequested revisions]** → `EDIT_DIAGNOSTICS` is framed
  throughout as *how to shape the requested change*, and the edit rule paragraph gains an explicit
  anti-proactive sentence (D3); spec'd as its own requirement.
- **[Coaching frame drifts from `schema.ts`]** → Only the five schema-expressible levers are stated;
  RIR, mesocycles, deloads, warm-ups and nutrition are named in `REASONING_IS_INTERNAL` as things
  never to emit.

## Migration Plan

No data migration — Dexie schema, stored rows and the proxy contract are untouched.

One **signature** migration, contained inside `workout-mode`: `summarizeSessions(sessions)` becomes
`summarizeSessions(sessions, ctx)`. Two production call sites (`useSessionSummary`) and one test file.
Made required rather than optional so `tsc` fails loudly on any missed call site. The public seam
(`useSessionSummary(): string | null`) and every consumer of it are unchanged.

One **vocabulary** change in the summary string: `N session(s)` → `N exposures` per exercise line,
which updates three existing assertions in `summary.test.ts`. Chosen to match the coaching vocabulary
the edit prompt now uses ("at least three exposures before calling a plateau").

## Open Questions

- The ±2 % trend tolerance, the ±10 % time tolerance and the 20-line cap are first estimates. Confirm
  against real data during the proposal's manual verification pass; tune in a follow-up if they
  misfire.
- Whether the `40–59` age block earns its tokens. It is the weakest of the three bands (a machine
  bias and longer rest). Drop it if the manual pass shows no difference in output.
- Whether the youth band's precedence statement holds in practice — the manual pass must include a
  `< 18` profile at a high `daysPerWeek` and confirm the returned day count still matches the request
  (design §D2). If the model caps days anyway, the fix is a stronger day-count directive, not a
  weaker youth band.
