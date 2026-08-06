# Tasks — evidence-based routine prompts

**This change is engineer-only.** There is no designer work: no component, screen, token, or copy
string changes. `useSessionSummary()` keeps its `string | null` contract, so `src/app/page.tsx` and
`RoutineHomeScreen.tsx` are untouched, and the summary string is model-facing and never rendered.

Order follows the proposal's priority: create prompt → summarizer → edit prompt.

## 1. Coaching content module

- [x] 1.1 [engineer] Create `src/modules/routine-generation/api/ai/coaching.ts`. Pure — **imports
      nothing**. Exports `PROGRAMMING_FRAME`, `REASONING_IS_INTERNAL`, `EDIT_DIAGNOSTICS`,
      `splitGuidance(daysPerWeek)`, `focusBands(focus)`, `ageAdjustment(age)` (design §D1).
- [x] 1.2 [engineer] `PROGRAMMING_FRAME`: weekly per-muscle set range, per-session per-muscle cap,
      split-volume-across-days, frequency-distributes-not-stimulates, selection rules
      (lengthened-position bias, function coverage, 1–2 compounds + 1–2 isolations per muscle),
      most-to-least-demanding ordering, standard-commercial-gym default. Include the **concrete
      integer, never a range** directive (design §D2) — without it the bands invite `"reps": "8-12"`,
      which fails `routineSchema`.
- [x] 1.3 [engineer] `splitGuidance`: **normalize then clamp** per design §D2 —
      `n = Number.isFinite(daysPerWeek) ? Math.round(daysPerWeek) : 3`, then the ≤2 / 3 / 4 / 5 / ≥6
      table. The normalize step is required: a raw comparison chain drops `NaN` and `3.5`, and both
      reach the selector (`openrouter.ts:69` checks only `typeof`). Never returns empty, never throws.
- [x] 1.4 [engineer] `focusBands`: the four-focus × three-tier rep/rest table in design §D2. Unknown
      focus string falls back to the hypertrophy row. `general` additionally asks for balanced
      coverage of every major muscle group (design §D2) — it is the hypertrophy row plus that clause,
      not a bare alias.
- [x] 1.5 [engineer] `ageAdjustment`: three bands per design §D2, as four explicit range checks (not
      an `if/else` chain) so a non-finite `age` returns `null` — `age < 18` youth; `>=18 && <40`
      `null`; `>=40 && <60` mid; `>=60` senior. Onboarding accepts ages from 13
      (`profile-goals/logic/model.ts` validates 13–120), so the youth band is reachable.
- [x] 1.5b [engineer] Youth block content: **opens** with "keep the requested day count exactly as
      instructed above; adjust only how each day is composed", then whole-body day composition
      (not a body-part split), no working set below 8 reps — stated as narrowing the focus bands
      above it — and avoid near-maximal loading. It must emit **no** weekly frequency, day cap, or
      day count (design §D2, settled: day count always wins), and no technique or
      proximity-to-failure text (unemittable; beginner form guidance is a locked non-goal).
- [x] 1.6 [engineer] `REASONING_IS_INTERNAL`: principles are internal reasoning only; never explain,
      justify, or report totals; never name RIR, mesocycles, deloads, warm-ups or nutrition in
      `name`, `subtitle`, a day name, or an exercise name; unsupported requests get the closest safe
      alternative, silently, with no question asked.

## 2. Create prompt

- [x] 2.1 [engineer] In `prompt.ts`, make the create system prompt a function of `ctx` (it is a
      module constant today). Assemble in the order fixed by design §D3: role → `INTERPRET` →
      `PROGRAMMING_FRAME` → `splitGuidance` → the existing exact-day-count line → `focusBands` →
      `ageAdjustment` (skipped when `null`) → `REASONING_IS_INTERNAL` → `OUTPUT_CONTRACT` →
      `SCHEMA_SHAPE` → `EXAMPLE` → `languageDirective`.
- [x] 2.2 [engineer] Leave `OUTPUT_CONTRACT`, `SCHEMA_SHAPE`, `EXAMPLE`, `INTERPRET` and
      `languageDirective` byte-identical. `buildRoutinePrompt`'s signature and the user message do
      not change.

## 3. Edit prompt

- [x] 3.1 [engineer] Append the anti-proactive sentence to the existing edit rule paragraph: never
      revise, add, remove, or rebalance anything the instruction did not reference, however strongly
      the history suggests it. Keep the existing "If recent workout history is provided…" sentence.
- [x] 3.2 [engineer] Insert `EDIT_DIAGNOSTICS` between that paragraph and `OUTPUT_CONTRACT`:
      adherence first; three-exposure minimum before calling a plateau; objective load × reps over
      subjective ratings; cut exercises before cutting rest; keep exercise continuity (swap only for
      a stated reason); a never-logged exercise may be newly added — do not remove it unless asked.
      Frame the whole block as *how to shape the requested change*.
      **Exactly these six rules — no more.** The source's prescriptive rules ("stalled + low ratings
      → add stimulus", "→ remove fatigue", "one variable at a time") are deliberately NOT carried:
      the approved proposal enumerates only the six interpretive rules above, and "add stimulus" is
      the instruction closest to authorizing the unrequested volume change the locked strict-edit
      decision forbids. Every rule here tells the model how to *read* history, never what to *change*.
- [x] 3.3 [engineer] `buildEditPrompt`'s signature and **user message are unchanged** — all new text
      is system-side (design §D11 invariant 2). Do not touch the `lines` array.

## 4. Summarizer

- [x] 4.1 [engineer] In `logic/summary.ts`, add the `SummaryContext` interface and widen
      `summarizeSessions(sessions, ctx)`. `ctx` is **required**, not optional, so `tsc` catches a
      missed call site (design §D4). Keep the file pure and untranslated; keep weights in canonical
      kg. The `sessions.length === 0 → null` guard stays the first statement in the function
      (design §D11 invariant 1).
- [x] 4.2 [engineer] Adherence line — the span arithmetic in design §D5, including the sub-week
      "not rated" form and the omit-entirely case when `daysPerWeek` is `null`. Pluralize
      `session`/`day`. Extend the header to `Recent history (last N sessions, ~W.W weeks):`.
- [x] 4.3 [engineer] Per-exercise exposures + trend — design §D6. Rename the `N session(s)` segment
      to `N exposures`; reuse the existing `repSeries` for the representative set; metric =
      `weightKg × reps`; ≥3 usable points required; last 4 points, first vs last, ±2 % band →
      `trending up` / `flat` / `trending down`.
- [x] 4.4 [engineer] Skipped line — design §D7. Prescribed ids with zero exposures, gated on
      `sessions.length >= ctx.dayCount`, phrased "Prescribed but never logged in this window:",
      capped at 8 names + `(+N more)`.
- [x] 4.5 [engineer] Training-time line — design §D8. Per session `Σ series.workSeconds +
      Σ log.restSeconds`, reported as a per-session average in minutes; direction only at ≥4
      sessions, first-half mean vs last-half mean, ±10 % → `rising` / `steady` / `falling`.
- [x] 4.6 [engineer] Length bound — design §D9. Cap the per-exercise section at 20 lines ordered by
      exposure count descending (ties: most recent exposure first), append
      `(+N more exercises omitted)` when truncated. Emit lines in the design §D9 order.

## 5. Seam wiring

- [x] 5.1 [engineer] In `logic/useSessionSummary.ts`, keep the full `useActiveRoutine()` result
      instead of only `.id`: flat-map `routine.days[].exercises` into `prescribed` ({ id, name }, in
      routine order) and read `routine.days.length` into `dayCount`.
- [x] 5.2 [engineer] Add `useProfile()` from `@/modules/profile-goals` for
      `goals?.daysPerWeek ?? null`. This is a legal D→A barrel import, already precedented by
      `useWorkoutSession.ts` and `model.ts`; no cycle (design §D4). Include the target in the
      `useLiveQuery` dependency list so the summary re-emits when goals change.
- [x] 5.3 [engineer] The hook's public signature stays `useSessionSummary(): string | null`. Do not
      touch `src/app/page.tsx`, `RoutineHomeScreen.tsx`, `useRoutineEdit.ts`, `client.ts`, or
      `openrouter.ts`.

## 6. Tests

- [x] 6.1 [engineer] `prompt.test.ts` — create prompt: volume dose + per-session cap present; 4-day
      split guidance + exact-day-count directive both present; tiered rep/rest bands present;
      `endurance` high-rep/short-rest and `strength` low-rep/long-rest; `general` carries the
      balanced-coverage clause on top of the default bands; selection + ordering rules
      present; concrete-integer directive present; unknown focus and out-of-range `daysPerWeek`
      (1, 9) still produce non-empty guidance without throwing — **and so do `3.5` and `NaN`**, the
      two cases the normalize step exists for.
- [x] 6.1b [engineer] `prompt.test.ts` — age bands: age 63 carries the 60+ block; age 28 carries
      none; age 16 carries whole-body composition + rep floor + no-near-maximal-loading and carries
      no technique or proximity-to-failure text; boundaries land on the stated side (18 → none,
      40 → mid, 60 → senior); a non-finite age yields no block.
- [x] 6.1c [engineer] `prompt.test.ts` — day-count precedence: with age 16 and `daysPerWeek: 6` the
      exact-day-count directive is still present, the age block states no frequency/day cap of its
      own, and it appears after the focus bands in the system prompt.
- [x] 6.2 [engineer] `prompt.test.ts` — regression + ordering: `OUTPUT_CONTRACT`, `SCHEMA_SHAPE`,
      `EXAMPLE`, `INTERPRET` all still present; every coaching block's index is lower than the output
      contract's; the language directive is still last; `buildRoutinePrompt` still deterministic.
      Keep the existing user-message tests green unchanged.
- [x] 6.2b [engineer] `prompt.test.ts` — the negative assertion the proposal calls for: the create
      system prompt contains no directive asking the model to explain, justify, state its reasoning,
      or report weekly volume totals (assert against the phrasings carried over from
      `reference/coaching-context.md`), and it does state the internal-reasoning-only rule.
- [x] 6.3 [engineer] `prompt.test.ts` — edit prompt: diagnostic rules present and framed as shaping
      the requested change; anti-proactive directive present; the existing byte-identical
      history-less user-message test still passes; the "Recent workout history" block still appears
      when a summary is supplied.
- [x] 6.4 [engineer] `summary.test.ts` — add a `ctx` to every existing call and update the three
      `N session(s)` assertions to `N exposures`. Keep the empty-window `null`, the
      no-ratings-line, the `first→last` arrow, and the trailing-sentinel-set cases green.
- [x] 6.5 [engineer] `summary.test.ts` — new cases, one per spec scenario: adherence 8-of-~12 at
      4/week, with first and last `completedAt` **exactly 20 days apart** — the inclusive `+1` makes
      that `spanDays 21` = 3.0 weeks = expected 12. (21 days apart gives 3.14 weeks and expected 13,
      a red test — design §D5.) Then: sub-week not-rated; null target omits the line; up / flat /
      down trends over 4
      exposures; 2 exposures declare no trend; bodyweight-only exposures count but declare no trend;
      4 of 12 prescribed named as never logged; short window suppresses the skipped line; removed
      exercise not reported as skipped; training time = work + rest with a rising direction at ≥4
      sessions and none at 3; per-exercise cap truncates with an omitted count.
- [x] 6.6 [engineer] `sessionSummary.integration.test.tsx` — seed goals alongside the routine and
      assert the summary carries an adherence line; assert it still returns `null` with no routine
      and with a routine but zero sessions, and still re-emits when a session is logged mid-mount.

## 7. Verify

- [x] 7.1 [engineer] `bun run biome check` + `depcruise src` pass. **No firewall config change and no
      new fixture** (design §D10): `coaching.ts` is an intra-feature `api/ai/` sibling importing
      nothing, rule 4 is a forbid-list scoped to `route.ts`, and the D→A edge already exists.
- [x] 7.2 [engineer] `schema.ts` is byte-identical (`git diff --stat` shows no change), and no Dexie
      migration, stored field, profile field, UI file, or network call was added.
- [ ] 7.3 [engineer] Manual verification (per the proposal, not automated): generate 3 routines
      across `focus` values and run 2 edits with history. Confirm in the returned JSON that day count
      matches `daysPerWeek`, per-session per-muscle volume respects the cap, rest seconds land in the
      focus band, `reps`/`restSeconds` are integers, and no prose or coaching vocabulary leaks into
      `name`, `subtitle`, a day name, or an exercise name.
- [ ] 7.4 [engineer] Manual verification of the youth band: generate once with age 16 and
      `daysPerWeek: 6`. Confirm the response has exactly 6 days, each covering the whole body, no set
      below 8 reps, and no age, safety, or technique language in any string field. A day-count
      mismatch here means the day-count directive needs strengthening — not the youth band weakening
      (design §D2).
