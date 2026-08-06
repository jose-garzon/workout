# Evidence-based routine prompts

## Why

The create prompt tells the model to be "a strength-training coach" and nothing more: no volume dose,
no per-session cap, no rep/rest bands, no exercise-selection rules. Routines come back plausible but
arbitrary — the user cannot tell a good one from a bad one, and neither can we. The edit prompt sees
session history but has no rules for reading it, so "make legs harder" gets a guess instead of a
diagnosis. This change puts the current hypertrophy/strength research consensus (user-supplied,
`reference/coaching-context.md`) inside both prompts as the model's reasoning frame, so the same JSON
comes back better designed.

## What Changes

**Create prompt** — gains an evidence-based programming frame, expressed only through the five levers
the schema already has (exercise selection, exercise order, set count, reps, rest seconds):

- Weekly volume dose per muscle group, and a per-session cap that forces volume to be split across
  days rather than piled into one.
- Split selection driven by `daysPerWeek`, with each muscle distributed across days — frequency as a
  distribution tool, never as an extra stimulus, and never more days than the user asked for.
- Rep and rest bands per exercise tier (heavy compound / secondary compound / isolation).
- Exercise-selection rules: lengthened-position bias, full function coverage per muscle, most- to
  least-demanding ordering within a session.
- Age-conditioned adjustments, using the `age` field we already collect.
- `focus`-conditioned parameter bands (see below) so the frame also serves non-hypertrophy goals.

**Edit prompt** — gains diagnostic rules for reading the session summary, scoped as *interpretation of
the change the user asked for* (adherence first, three-exposure minimum before calling a plateau,
objective load x reps over subjective ratings, cut exercises before cutting rest, keep exercise
continuity). The existing strict contract is unchanged and gets an explicit anti-proactive directive.

**Session summary** (`summarizeSessions`) — enriched so those diagnostics have data: adherence against
the user's `daysPerWeek` target, per-exercise exposure count and up/flat/down trend over the last 3-4
exposures, prescribed-but-never-logged exercises, and a training-time trend derived from existing
`workSeconds` + `restSeconds` (no wall-clock duration — `CompletedSession` has no `startedAt` and a
Dexie migration is out of scope). Pure logic, no new capture.

**Not BREAKING.** `schema.ts` stays byte-identical; the emitted routine shape, the proxy contract, and
every UI screen are untouched.

### Two tensions, resolved here

1. **The source material is written for the general population; our user is an intermediate gym-goer
   with full-gym access.** Resolution: the prompt assumes an intermediate lifter and a standard
   commercial gym as the default, and keeps today's "no beginner form or safety guidance" line.
   Training age, equipment, injuries, session length and priority muscles are not structured fields —
   the model honours them only when the user's free text supplies them, and otherwise assumes the
   default and proceeds. **Age is a real field, so age adjustments stay** (they change selection, sets,
   reps and rest — all schema-expressible). Everything in the source that requires *talking* to the
   user — medical-clearance advice, "consult a professional", refusing a request, naming a concern —
   is dropped: the response is JSON only, so safety is expressed structurally (design the closest safe
   alternative and emit it) or not at all. A UI-level disclaimer is a separate change.
2. **`focus` can be `strength`, `endurance` or `general`; the source is a hypertrophy coach.**
   Resolution: the structural rules (volume caps, per-session cap, split mapping, ordering,
   lengthened-position, function coverage) apply to **all four** focuses. Only the rep/rest bands and
   selection emphasis shift: `hypertrophy` uses the source defaults; `strength` biases to heavier,
   lower-rep compounds with longer rest; `endurance` uses high reps and short rest — the one place the
   source's "never rest under 60s" rule is deliberately relaxed; `general` uses hypertrophy defaults
   with balanced full-body coverage.

### Non-goals

- **No output-schema change.** No RIR field, no rep-range field, no rationale/coach-note field, no
  mesocycle/warm-up/nutrition field. `schema.ts` is untouched.
- **No prose in the response.** Every source instruction to "state your reasoning", "briefly explain
  why you deviated", "report weekly sets per muscle", or "say so explicitly" is dropped — prose breaks
  JSON parsing. The principles govern internal reasoning only and must not be smuggled into `name`,
  `subtitle`, or a day/exercise name.
- **No clarifying questions.** One-shot stateless call: every "ask the user for the missing field" is
  re-expressed as "infer a sensible default and proceed".
- **No warm-up protocol, deload week, mesocycle plan, calibration week, logging lecture, or nutrition
  guidance in the emitted routine** — unrepresentable under the schema.
- **No proactive revision on edit.** No unrequested volume changes, deloads, or exercise swaps, however
  strongly the data suggests them.
- **No Dexie migration**, no new stored field, no wall-clock session duration.
- **No new profile fields.** Equipment, training age, session length and priority muscles are *not*
  being added to onboarding here. Adding them would materially improve output quality — propose as a
  follow-up change, not scope creep into this one.
- **No UI change**, no new network call, no data leaving the device beyond the existing proxy request.
- **Not asserting routine quality by eyeball.** Whether a generated routine is *good* is verified
  manually (see below), never as an automated acceptance criterion.

### Priority

1. Create prompt (every new user hits it).
2. Summarizer enrichment (the edit diagnostics are useless without it).
3. Edit prompt diagnostics.

## Acceptance Criteria

**Create prompt** (assertions against the messages `buildRoutinePrompt` returns)

- **GIVEN** any profile and prompt **WHEN** the messages are built **THEN** the system prompt states a
  weekly per-muscle volume range and a per-session per-muscle cap, and instructs splitting volume
  across days rather than exceeding the cap.
- **GIVEN** `daysPerWeek: 4` **WHEN** the messages are built **THEN** they carry split guidance for a
  4-day week, and the existing "return exactly as many days as requested" directive is still present.
- **GIVEN** any profile **WHEN** the messages are built **THEN** the system prompt states rep and rest
  bands distinguishing heavy compounds, secondary compounds and isolation.
- **GIVEN** any profile **WHEN** the messages are built **THEN** the system prompt states the
  exercise-selection rules: lengthened-position bias, per-muscle function coverage, and
  most-to-least-demanding ordering.
- **GIVEN** `focus: "endurance"` **WHEN** the messages are built **THEN** they state a high-rep,
  short-rest band; **GIVEN** `focus: "strength"` **THEN** they state a low-rep, long-rest band.
- **GIVEN** `age: 63` **WHEN** the messages are built **THEN** they carry the 60+ adjustment
  (low-end volume, machine/cable bias); **GIVEN** `age: 28` **THEN** they do not.
- **GIVEN** any profile **WHEN** the messages are built **THEN** the output contract, schema
  restatement, example, generous-interpretation and never-ask-for-clarification directives are all
  still present, and the language directive is still the last block of the system prompt.
- **GIVEN** any profile **WHEN** the messages are built **THEN** no directive asks the model to explain,
  justify, report volume totals, or emit anything outside the one JSON object.

**Edit prompt** (assertions against the messages `buildEditPrompt` returns)

- **GIVEN** any instruction **WHEN** the messages are built **THEN** the system prompt still requires
  applying only the requested change and leaving everything unmentioned identical, and additionally
  forbids revising anything the instruction did not reference.
- **GIVEN** any instruction **WHEN** the messages are built **THEN** the system prompt states the
  diagnostic rules as guidance for *shaping the requested change* — adherence before volume, at least
  three exposures before treating a lift as stalled, objective load x reps over subjective ratings, cut
  exercises before cutting rest, no exercise swap without a stated reason.
- **GIVEN** no `sessionSummary` **WHEN** the messages are built **THEN** the user message is
  byte-identical to today's history-less edit message (routine + instruction, no history block).
- **GIVEN** a `sessionSummary` **WHEN** the messages are built **THEN** it appears as the same distinct
  "Recent workout history" block as today.

**Session summary** (assertions against `summarizeSessions`)

- **GIVEN** an empty session window **WHEN** summarized **THEN** the result is `null` and the edit
  request carries no history block (unchanged).
- **GIVEN** 8 completed sessions over a routine whose owner targets 4 days/week across 3 weeks
  **WHEN** summarized **THEN** the summary reports sessions completed against the expected target.
- **GIVEN** an exercise logged 4 times with strictly increasing weight x reps **WHEN** summarized
  **THEN** that exercise is reported with 4 exposures and an upward trend; **GIVEN** the same weight and
  reps 4 times **THEN** a flat trend; **GIVEN** decreasing **THEN** a downward trend.
- **GIVEN** an exercise logged only twice **WHEN** summarized **THEN** no trend is declared for it
  (three-exposure minimum).
- **GIVEN** a routine of 12 prescribed exercises and 12 sessions in which 4 of them were never logged
  **WHEN** summarized **THEN** the summary names those 4 as skipped.
- **GIVEN** sessions whose logs carry `workSeconds` and `restSeconds` **WHEN** summarized **THEN** the
  summary reports a training-time figure equal to their sum per session and its direction across the
  window.
- **GIVEN** sessions with no `difficulty`/`fatigue` values **WHEN** summarized **THEN** no ratings line
  is emitted (unchanged).

**Manual verification** (not automated): generate 3 routines across `focus` values and 2 edits with
history, and confirm the volume caps, day count and rest bands hold in the returned JSON and that no
prose leaks into any string field.

## Capabilities

### New Capabilities

- `evidence-based-programming`: the coaching frame both AI prompts carry — weekly and per-session
  volume dose, split-by-frequency mapping, rep/rest bands per exercise tier and per `focus`,
  exercise-selection and ordering rules, age adjustments, the edit-time diagnostic rules, and the
  invariants that keep all of it out of the emitted JSON (no prose, no schema change, no clarifying
  questions, no proactive revision).

### Modified Capabilities

- `session-aware-editing`: the history summary requirement widens. Today it is defined as per-exercise
  logged weights/reps, sessions completed, and difficulty/fatigue. It must additionally report
  adherence against the user's weekly target, per-exercise exposure count and trend direction,
  prescribed-but-never-logged exercises, and a training-time trend — all still derived from data
  workout-mode already stores plus the active routine and the saved weekly target, with no new capture
  and no new stored field.

## Impact

- `src/modules/routine-generation/api/ai/prompt.ts` — both system prompts; the create prompt becomes
  `focus`- and `age`-aware. Must stay a pure, server-safe dependency leaf (firewall rule 4).
- `src/modules/workout-mode/logic/summary.ts` — enriched summarizer; it now needs the active routine's
  prescribed exercises and the user's weekly target as inputs. How those reach it (seam hook, caller,
  cross-feature barrel) is the architect's call.
- Unit tests for both, in the style above.
- **Untouched:** `schema.ts`, the proxy route contract, the Dexie schema, every UI component, and the
  set of fields collected at onboarding.
- Prompts get longer, so each request costs more tokens. Acceptable — one call per generate/edit.
