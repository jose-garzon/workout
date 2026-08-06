/**
 * The coaching frame both AI prompts carry (evidence-based-routine-prompts
 * design.md §D1). Content only — `prompt.ts` keeps message ASSEMBLY. The two
 * change at different rates: the coaching frame is tuned as the output is
 * reviewed; assembly is stable.
 *
 * IMPORTS NOTHING, deliberately. This module rides into the server graph via
 * `prompt.ts` ← `openrouter.ts` ← the proxy route, so keeping it a pure leaf of
 * string constants and pure functions is what keeps the route's import firewall
 * (rule 4) unaffected — discipline, not a tool-enforced rule (§D1).
 *
 * Everything here is expressed through the FIVE levers `schema.ts` actually
 * carries: exercise selection, exercise order, set count, reps, rest seconds.
 * Source material that needs prose to land (RIR, mesocycles, deloads, warm-ups,
 * nutrition, medical advice) is dropped, not softened — `REASONING_IS_INTERNAL`
 * turns each dropped "state your reasoning" instruction into a prohibition.
 */

/**
 * Volume dose, per-session cap, frequency, selection and ordering — the rules
 * that hold for every focus and every age (proposal, tension 2). The
 * concrete-integer directive at the end is a schema guard, not style advice:
 * every band stated further down is a RANGE, and `routineSchema` has one integer
 * `reps` and one integer `restSeconds` per set with no range field, so without
 * this line the bands invite `"reps": "8-12"` and the response fails to parse.
 */
export const PROGRAMMING_FRAME = [
  "Programming frame — apply all of it to every routine you design:",
  "- Volume: 10-20 hard sets per muscle group per WEEK. Open in the lower half of",
  "  that range so there is room to add work later.",
  "- Per session, cap each muscle group at 6-8 hard sets. Past that the extra sets",
  "  stop paying: SPLIT a muscle's weekly volume across training days rather than",
  "  exceed the cap on one day.",
  "- Frequency DISTRIBUTES volume, it is not an extra stimulus. With weekly volume",
  "  equated, training a muscle more often adds nothing by itself — use the days",
  "  available to keep each session under the per-session cap, landing most muscle",
  "  groups around twice a week.",
  "- Selection, per muscle group per week: 1-2 compound (multi-joint) movements",
  "  plus 1-2 isolation movements. Favour exercises that load the muscle in a",
  "  LENGTHENED position (incline press, deep squat, Romanian deadlift, overhead",
  "  triceps extension, seated hamstring curl). Cover every function of each muscle",
  "  you train: quads from both flexed and extended hip positions, back through",
  "  both vertical and horizontal pulling, hamstrings through both knee flexion and",
  "  hip hinge.",
  "- Order the exercises inside a day from MOST to LEAST technically demanding and",
  "  systemically fatiguing.",
  "- Assume a standard commercial gym with full equipment unless the request says",
  "  otherwise.",
  '- Every "reps" and every "restSeconds" you emit is a CONCRETE WHOLE NUMBER',
  '  picked from inside the bands below — never a range ("8-12"), never a "+",',
  "  never a proximity-to-failure value. The bands are for your reasoning; the JSON",
  "  carries one integer per set.",
].join("\n");

/**
 * The bridge from "how to think" to "what to emit" (§D3, block 7). The source
 * material repeatedly asks the coach to explain itself; every one of those
 * instructions is inverted here, because prose breaks JSON parsing and the
 * schema has nowhere to put a rationale.
 */
export const REASONING_IS_INTERNAL = [
  "Everything above governs your INTERNAL reasoning only. None of it appears in",
  "the response: do not explain, do not justify, do not report weekly or",
  "per-session set totals, and do not add any note, comment, or field the schema",
  "does not define. Never name a coaching concept — proximity to failure, RIR,",
  "mesocycles, deloads, calibration weeks, warm-ups, nutrition, or the reason",
  'behind any adjustment you made — in the routine "name", the "subtitle", a day',
  '"name", or an exercise "name"; those are plain training labels ("Push",',
  '"Upper", "Bench Press") and nothing more. If the request asks for something',
  "this frame does not support, design the closest safe alternative and emit it",
  "silently: never ask the user anything, never flag the deviation, never return",
  "anything but the one JSON object.",
].join(" ");

/**
 * The edit-time audit rules (§D3, edit order). Every rule here tells the model
 * how to READ the history summary; none tells it what to CHANGE. The source's
 * prescriptive rules ("stalled + low ratings → add stimulus", "→ remove
 * fatigue", "one variable at a time") are deliberately NOT carried: the locked
 * strict-edit contract forbids any revision the instruction did not ask for, and
 * "add stimulus" is the instruction closest to authorizing exactly that.
 */
export const EDIT_DIAGNOSTICS = [
  "When recent workout history is provided, read it with these rules. They tell",
  "you how to SHAPE the change you were asked for — they never authorize a change",
  "of their own.",
  "- Read adherence first. If sessions are being missed, the routine's fit is the",
  "  problem: shape the requested change around the sessions actually being done",
  "  rather than piling on more work.",
  "- Two data points are not a trend. Require at least three exposures of an",
  "  exercise before treating it as stalled.",
  "- Objective load × reps progression outweighs the subjective difficulty and",
  "  fatigue ratings whenever the two disagree.",
  "- When session time is the constraint, cut exercises — never rest seconds.",
  "- Keep exercise continuity: progressive overload needs comparable exposures",
  "  over time, so swap an exercise only for a reason the instruction states,",
  "  never for variety.",
  "- An exercise the history never logged may simply have been added recently. Do",
  "  not remove it unless the instruction asks you to.",
].join("\n");

/** One split-guidance block, so every row of the table reads identically. */
function splitLine(label: string, shape: string): string {
  return [
    `Split guidance for a ${label} week: ${shape}.`,
    "Spread each muscle group's weekly sets across those days.",
  ].join(" ");
}

/**
 * Split guidance for the requested training frequency (§D2).
 *
 * NORMALIZE, THEN CLAMP — the normalize step is load-bearing, not padding. This
 * value arrives off the wire: `parseBuildBody` checks only
 * `typeof daysPerWeek === "number"`, so `NaN` and `3.5` both genuinely reach
 * here, and a raw comparison chain drops both (every comparison against `NaN` is
 * false; `3.5` falls between the 3 and 4 rows). After rounding, `<= 2` and
 * `>= 6` absorb every remaining integer, so the chain has no hole. Non-finite
 * falls back to 3 — the modal frequency, whose full-body guidance is the most
 * broadly safe when the real value is unknown. Never empty, never throws.
 */
export function splitGuidance(daysPerWeek: number): string {
  const n = Number.isFinite(daysPerWeek) ? Math.round(daysPerWeek) : 3;
  if (n <= 2) return splitLine("2-or-fewer-day", "full body every session");
  if (n === 3) {
    return splitLine(
      "3-day",
      "full body three times, or upper / lower / full body",
    );
  }
  if (n === 4) return splitLine("4-day", "upper / lower, run twice");
  if (n === 5) {
    return splitLine("5-day", "upper / lower / push / pull / legs");
  }
  return splitLine("6-or-more-day", "push / pull / legs, run twice");
}

/** Header + the three tiers, shared by every focus so the labels never drift. */
function bandBlock(
  heavy: string,
  secondary: string,
  isolation: string,
): string {
  return [
    "Rep and rest bands by exercise tier — pick one whole number inside each:",
    `- Heavy compounds (squat, hinge, barbell presses): ${heavy}.`,
    `- Secondary compounds and multi-joint machine work: ${secondary}.`,
    `- Isolation and single-joint work: ${isolation}.`,
  ].join("\n");
}

const DEFAULT_BANDS = bandBlock(
  "5-10 reps, 120-180 s rest",
  "8-15 reps, 90-120 s rest",
  "10-20 reps, 60-90 s rest",
);

const STRENGTH_BANDS = bandBlock(
  "3-6 reps, 180-300 s rest",
  "5-8 reps, 150-180 s rest",
  "8-12 reps, 90-120 s rest",
);

/**
 * The one place the source's "never rest under 60 s" rule is deliberately
 * relaxed (proposal, tension 2): short rest IS the endurance stimulus.
 */
const ENDURANCE_BANDS = bandBlock(
  "12-20 reps, 60 s rest",
  "15-25 reps, 45 s rest",
  "15-30 reps, 30-45 s rest",
);

const BALANCED_COVERAGE = [
  "Balance the week across every major muscle group — chest, back, shoulders,",
  "arms, quads, hamstrings, glutes, calves and core each get direct work.",
].join(" ");

/**
 * Rep/rest bands for the user's training focus (§D2). `focus` arrives off the
 * wire as a bare string, so an unrecognized value falls back to the default
 * (hypertrophy) table rather than dropping the block. `general` is the default
 * table PLUS balanced coverage, not a bare alias.
 */
export function focusBands(focus: string): string {
  if (focus === "strength") return STRENGTH_BANDS;
  if (focus === "endurance") return ENDURANCE_BANDS;
  if (focus === "general") return `${DEFAULT_BANDS}\n${BALANCED_COVERAGE}`;
  return DEFAULT_BANDS;
}

/**
 * Reachable because onboarding admits minors: `validateField("age", …)` in
 * `profile-goals/logic/model.ts` accepts 13-120.
 *
 * DAY COUNT ALWAYS WINS (§D2). The source attaches a "2-3 days/week" cap to this
 * band; that half is dropped and only the composition half survives, because
 * `days.length` feeds the calendar's weekly target — a day-count mismatch is a
 * user-visible data bug. Hence the opening restatement. Nothing about technique
 * or proximity to failure is emitted either: neither is expressible under the
 * schema, and beginner form guidance is a locked non-goal.
 */
const YOUTH_ADJUSTMENT = [
  "Age adjustment — keep the requested day count exactly as instructed above;",
  "adjust only how each day is composed.",
  "- Compose every training day to cover the whole body rather than isolating one",
  "  body part.",
  "- No working set goes below 8 reps. Where a band above allows fewer, this",
  "  narrows that band to a floor of 8.",
  "- Avoid near-maximal loading on any movement.",
].join("\n");

const MID_ADJUSTMENT = [
  "Age adjustment: bias the highest-load movements toward machines and cables,",
  "and take rest at the TOP of each band above.",
].join(" ");

const SENIOR_ADJUSTMENT = [
  "Age adjustment: keep weekly volume at the LOW end of the range, 8-12 hard sets",
  "per muscle group per week. Bias the highest-load movements toward machines and",
  "cables, take rest at the TOP of each band above, and include one loaded carry",
  "or single-leg balance movement where it fits.",
].join(" ");

/**
 * The age band's modifier block, or `null` for 18-39 (§D2). Written as four
 * explicit RANGE checks rather than an if/else chain so a non-finite `age` off
 * the wire falls through to `null` instead of landing in the youth branch.
 * Boundaries: 18 → none, 40 → mid, 60 → senior.
 */
export function ageAdjustment(age: number): string | null {
  if (age < 18) return YOUTH_ADJUSTMENT;
  if (age >= 18 && age < 40) return null;
  if (age >= 40 && age < 60) return MID_ADJUSTMENT;
  if (age >= 60) return SENIOR_ADJUSTMENT;
  return null;
}
