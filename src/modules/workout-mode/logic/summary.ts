/**
 * Session-history summarizer (routine-edit-history design.md §Decision 2). Pure:
 * no I/O, no React — unit-testable in isolation. Turns the recent completed
 * sessions for a routine into a compact per-exercise trend string fed to the AI
 * edit as prompt CONTEXT (not user display), so weights stay in canonical kg
 * with no unit conversion. Returns `null` for an empty window.
 *
 * DELIBERATELY NOT TRANSLATED (i18n-spanish-support task 7.2). Every string here
 * ("Recent history", "sessions", "avg difficulty", …) is read by the model, not
 * by the user — it never reaches the screen. Routing it through `t` would change
 * what the model reads depending on the browser's language, for no user-visible
 * benefit. Exercise NAMES inside the summary are the user's own routine data and
 * are already in whatever language it was generated in.
 *
 * Widened by evidence-based-routine-prompts (§D4-§D9): the edit prompt now
 * carries diagnostic rules, so the summary carries the data those rules read —
 * adherence, per-exercise exposures + trend, never-logged prescriptions, and
 * training time. All of it is derived from what workout-mode already stores plus
 * the `SummaryContext` the seam hands in; no new capture, no new stored field.
 */

import type { CompletedSession, ExerciseLog, SeriesLog } from "../types";

/**
 * The recent-window cap (design.md §Decision 3): the 20 most-recent completed
 * sessions bound the summarization work + payload regardless of training
 * frequency. Co-located with the summarizer; consumed by `useSessionSummary`.
 */
export const RECENT_SESSION_LIMIT = 20;

const DAY_MS = 86_400_000;

/**
 * Length bound (§D9). 20 covers any realistic split (5 days × 6 exercises = 30
 * distinct, cut to the 20 most-trained — the omitted ones are the least
 * informative), holding the whole summary near ~2.5 kB.
 */
const EXERCISE_LINE_LIMIT = 20;

/** Named skipped exercises before the summary switches to a count (§D7). */
const SKIPPED_NAME_LIMIT = 8;

/**
 * What the summarizer cannot read for itself (§D4). The cross-feature join
 * happens in `useSessionSummary`, not here, so this file stays pure and its
 * tests need no routine-generation or profile-goals fixtures. Declared as a
 * minimal local shape for the same reason `PromptContext` is.
 */
export interface SummaryContext {
  /** Prescribed exercises across the active routine's days, in routine order. */
  prescribed: { id: string; name: string }[];
  /** Number of days in the split — the "one full rotation" guard for skips. */
  dayCount: number;
  /** Weekly session target from goals; null when goals are unsaved. */
  daysPerWeek: number | null;
}

/**
 * "What you finished on" for one exercise log: the last `SeriesLog` with
 * `weightKg > 0` (a `weightKg <= 0` set is the unset/bodyweight sentinel and is
 * skipped), matching `getExerciseHistory`'s `lastWeighted` semantics. `null` when no set carried a
 * positive weight.
 */
function repSeries(log: ExerciseLog): SeriesLog | null {
  for (let i = log.series.length - 1; i >= 0; i--) {
    const set = log.series[i];
    if (set && set.weightKg > 0) return set;
  }
  return null;
}

/** Weight with at most one decimal, no trailing-zero noise (60, 67.5). */
function fmtWeight(kg: number): string {
  return String(Math.round(kg * 10) / 10);
}

/** Average with at most one decimal. */
function fmtAvg(total: number, count: number): string {
  return String(Math.round((total / count) * 10) / 10);
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}

function mean(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

interface Trend {
  name: string;
  /** One exposure = one session that logged this exercise. */
  exposures: number;
  /** Representative positive weights, chronological — first→last is the arrow. */
  weights: number[];
  /** `weightKg × reps` of each USABLE representative set, chronological (§D6). */
  metrics: number[];
  lastReps: number | null;
  /** `completedAt` of the most recent exposure — the cap's tie-breaker (§D9). */
  lastExposureAt: number;
}

/**
 * Progression direction over the last 4 usable exposures (§D6): first vs last of
 * `weight × reps`, with a ±2 % dead band. Fewer than 3 usable points declares
 * nothing — two points are not a trend, and a bodyweight-only exercise never
 * produces any. 2 % sits below the smallest deliberate progression (a 2.5 kg
 * plate on 60 kg ≈ 4 %) and above logging noise, so `flat` means flat.
 */
function trendDirection(metrics: number[]): string | null {
  if (metrics.length < 3) return null;
  const window = metrics.slice(-4);
  const first = window[0];
  const delta = (window[window.length - 1] - first) / first;
  if (delta > 0.02) return "trending up";
  if (delta < -0.02) return "trending down";
  return "flat";
}

/** Inclusive day span of the window — 20 days apart is a 21-day span (§D5). */
function windowDays(chronological: CompletedSession[]): number {
  const first = chronological[0].completedAt;
  const last = chronological[chronological.length - 1].completedAt;
  return Math.floor((last - first) / DAY_MS) + 1;
}

/**
 * Sessions completed against what the saved weekly target implies over the
 * observed span (§D5). No clock is read: the window is bounded by the sessions
 * themselves, so a routine started mid-window is measured from its own first
 * session. Omitted entirely without a target — a guessed one would be worse than
 * silence — and left unrated under a week, where "started Friday" and "missed
 * three sessions" are indistinguishable.
 */
function adherenceLine(
  completed: number,
  days: number,
  daysPerWeek: number | null,
): string | null {
  if (daysPerWeek === null) return null;
  if (days < 7) {
    return [
      `Adherence: ${completed} session${plural(completed)} over`,
      `${days} day${plural(days)}, target ${daysPerWeek}/week`,
      "(window under one week — not rated).",
    ].join(" ");
  }
  const expected = Math.max(1, Math.round((days / 7) * daysPerWeek));
  const percent = Math.round((completed / expected) * 100);
  return `Adherence: ${completed} of ~${expected} expected sessions (${percent}%), target ${daysPerWeek}/week.`;
}

/**
 * Prescribed exercises with zero exposures across the whole window (§D7). Gated
 * on one full rotation of the split: below that, "never logged" only means "that
 * day has not come round yet". Phrased as scoped to the window because a
 * genuinely new exercise has no history either — `EDIT_DIAGNOSTICS` carries the
 * matching "do not remove it unless asked" rule. A logged exercise that is no
 * longer prescribed is real history, so it keeps its trend line and is never
 * reported here.
 */
function skippedLine(
  trends: Map<string, Trend>,
  ctx: SummaryContext,
  sessionCount: number,
): string | null {
  if (sessionCount < ctx.dayCount) return null;
  const names = ctx.prescribed
    .filter((exercise) => !trends.has(exercise.id))
    .map((exercise) => exercise.name);
  if (names.length === 0) return null;

  const shown = names.slice(0, SKIPPED_NAME_LIMIT).join(", ");
  const omitted = names.length - SKIPPED_NAME_LIMIT;
  const more = omitted > 0 ? ` (+${omitted} more)` : "";
  return `Prescribed but never logged in this window: ${shown}${more}.`;
}

/** Logged work + logged rest for one session, seconds — no wall clock (§D8). */
function sessionSeconds(session: CompletedSession): number {
  let total = 0;
  for (const log of session.exerciseLogs) {
    for (const set of log.series) total += set.workSeconds;
    total += log.restSeconds;
  }
  return total;
}

/**
 * Average session length and its direction (§D8). Halves rather than
 * first-vs-last because a split's days differ wildly in length (Push vs Legs),
 * so two single sessions would mostly measure which day they were; ±10 % rather
 * than the trend rule's 2 % for the same reason. Under 4 sessions the halves are
 * too thin to compare, so only the average is reported.
 */
function trainingTimeLine(chronological: CompletedSession[]): string {
  const seconds = chronological.map(sessionSeconds);
  const minutes = Math.round(mean(seconds) / 60);
  if (seconds.length < 4) return `Training time: ~${minutes} min/session avg.`;

  const half = Math.floor(seconds.length / 2);
  const earlier = mean(seconds.slice(0, half));
  const later = mean(seconds.slice(-half));
  const delta = earlier > 0 ? (later - earlier) / earlier : 0;
  let direction = "steady";
  if (delta > 0.1) direction = "rising";
  if (delta < -0.1) direction = "falling";
  return `Training time: ~${minutes} min/session avg, ${direction} across the window.`;
}

function summarizeRatings(sessions: CompletedSession[]): string | null {
  let diffTotal = 0;
  let diffCount = 0;
  let fatTotal = 0;
  let fatCount = 0;
  let ratedCount = 0;
  for (const session of sessions) {
    let rated = false;
    if (session.difficulty !== undefined) {
      diffTotal += session.difficulty;
      diffCount += 1;
      rated = true;
    }
    if (session.fatigue !== undefined) {
      fatTotal += session.fatigue;
      fatCount += 1;
      rated = true;
    }
    if (rated) ratedCount += 1;
  }
  if (diffCount === 0 && fatCount === 0) return null;

  const parts: string[] = [];
  if (diffCount > 0) {
    parts.push(`avg difficulty ${fmtAvg(diffTotal, diffCount)}/5`);
  }
  if (fatCount > 0) parts.push(`avg fatigue ${fmtAvg(fatTotal, fatCount)}/5`);
  return `Session ratings: ${parts.join(", ")} (over ${ratedCount} rated session${plural(ratedCount)}).`;
}

/** Group the window by `exerciseId`, chronologically. Most-recent name wins. */
function collectTrends(chronological: CompletedSession[]): Map<string, Trend> {
  const trends = new Map<string, Trend>();
  for (const session of chronological) {
    for (const log of session.exerciseLogs) {
      let trend = trends.get(log.exerciseId);
      if (trend === undefined) {
        trend = {
          name: log.name,
          exposures: 0,
          weights: [],
          metrics: [],
          lastReps: null,
          lastExposureAt: session.completedAt,
        };
        trends.set(log.exerciseId, trend);
      }
      trend.name = log.name;
      trend.exposures += 1;
      trend.lastExposureAt = session.completedAt;
      const rep = repSeries(log);
      if (rep !== null) {
        trend.weights.push(rep.weightKg);
        trend.lastReps = rep.reps;
        // A bodyweight-sentinel-only (or zero-metric) exposure still counts
        // toward `exposures` but contributes no metric point (§D6).
        const metric = rep.weightKg * rep.reps;
        if (metric > 0) trend.metrics.push(metric);
      } else if (log.series.length > 0) {
        trend.lastReps = log.series[log.series.length - 1].reps;
      }
    }
  }
  return trends;
}

/**
 * A compact summary of the recent completed sessions, or `null` when the window
 * is empty. Lines in the source's audit order (§D9): header, adherence, skipped
 * prescriptions, per-exercise progression, training time, subjective ratings.
 * Per exercise: exposure count, first→last representative weight (one weight,
 * not an arrow, when it never changed or only one exposure recorded it),
 * representative reps, and a trend direction once three exposures carry usable
 * load. A ratings line follows only when at least one session recorded
 * difficulty/fatigue.
 */
export function summarizeSessions(
  sessions: CompletedSession[],
  ctx: SummaryContext,
): string | null {
  if (sessions.length === 0) return null;

  // The repo yields newest-first; summarize chronologically so first→last reads
  // oldest→most-recent.
  const chronological = [...sessions].sort(
    (a, b) => a.completedAt - b.completedAt,
  );

  const trends = collectTrends(chronological);
  const days = windowDays(chronological);
  const weeks = (days / 7).toFixed(1);

  const lines: string[] = [
    `Recent history (last ${sessions.length} sessions, ~${weeks} weeks):`,
  ];

  const adherence = adherenceLine(sessions.length, days, ctx.daysPerWeek);
  if (adherence !== null) lines.push(adherence);

  const skipped = skippedLine(trends, ctx, sessions.length);
  if (skipped !== null) lines.push(skipped);

  // Most-trained first, so a truncated window keeps the informative lines.
  const ranked = [...trends.values()].sort(
    (a, b) => b.exposures - a.exposures || b.lastExposureAt - a.lastExposureAt,
  );
  for (const trend of ranked.slice(0, EXERCISE_LINE_LIMIT)) {
    const segments: string[] = [
      `${trend.exposures} exposure${plural(trend.exposures)}`,
    ];
    if (trend.weights.length > 0) {
      const first = trend.weights[0];
      const last = trend.weights[trend.weights.length - 1];
      segments.push(
        first === last
          ? `${fmtWeight(last)} kg`
          : `${fmtWeight(first)}→${fmtWeight(last)} kg`,
      );
    }
    if (trend.lastReps !== null) segments.push(`~${trend.lastReps} reps`);
    const direction = trendDirection(trend.metrics);
    if (direction !== null) segments.push(direction);
    lines.push(`- ${trend.name}: ${segments.join(", ")}`);
  }
  if (ranked.length > EXERCISE_LINE_LIMIT) {
    const omitted = ranked.length - EXERCISE_LINE_LIMIT;
    lines.push(`(+${omitted} more exercises omitted)`);
  }

  lines.push(trainingTimeLine(chronological));

  const ratingsLine = summarizeRatings(sessions);
  if (ratingsLine !== null) lines.push(ratingsLine);

  return lines.join("\n");
}
