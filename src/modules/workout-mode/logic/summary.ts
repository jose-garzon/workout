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
 */

import type { CompletedSession, ExerciseLog, SeriesLog } from "../types";

/**
 * The recent-window cap (design.md §Decision 3): the 20 most-recent completed
 * sessions bound the summarization work + payload regardless of training
 * frequency. Co-located with the summarizer; consumed by `useSessionSummary`.
 */
export const RECENT_SESSION_LIMIT = 20;

/**
 * "What you finished on" for one exercise log: the last `SeriesLog` with
 * `weightKg > 0` (a `weightKg <= 0` set is the unset/bodyweight sentinel and is
 * skipped), matching `getPreviousWeight` semantics. `null` when no set carried a
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

interface Trend {
  name: string;
  sessionCount: number;
  /** Representative positive weights, chronological — first→last is the arrow. */
  weights: number[];
  lastReps: number | null;
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
  const plural = ratedCount === 1 ? "" : "s";
  return `Session ratings: ${parts.join(", ")} (over ${ratedCount} rated session${plural}).`;
}

/**
 * A compact trend summary of the recent completed sessions, or `null` when the
 * window is empty. Per exercise (grouped by `exerciseId`, chronological): session
 * count, first→last representative weight (one weight, not an arrow, when it never
 * changed or only one session recorded it), and representative reps. A ratings
 * line follows only when at least one session recorded difficulty/fatigue.
 */
export function summarizeSessions(sessions: CompletedSession[]): string | null {
  if (sessions.length === 0) return null;

  // The repo yields newest-first; summarize chronologically so first→last reads
  // oldest→most-recent.
  const chronological = [...sessions].sort(
    (a, b) => a.completedAt - b.completedAt,
  );

  const trends = new Map<string, Trend>();
  for (const session of chronological) {
    for (const log of session.exerciseLogs) {
      let trend = trends.get(log.exerciseId);
      if (trend === undefined) {
        trend = {
          name: log.name,
          sessionCount: 0,
          weights: [],
          lastReps: null,
        };
        trends.set(log.exerciseId, trend);
      }
      trend.name = log.name; // most-recent name wins
      trend.sessionCount += 1;
      const rep = repSeries(log);
      if (rep !== null) {
        trend.weights.push(rep.weightKg);
        trend.lastReps = rep.reps;
      } else if (log.series.length > 0) {
        trend.lastReps = log.series[log.series.length - 1].reps;
      }
    }
  }

  const lines: string[] = [
    `Recent history (last ${sessions.length} sessions):`,
  ];
  for (const trend of trends.values()) {
    const plural = trend.sessionCount === 1 ? "" : "s";
    const segments: string[] = [`${trend.sessionCount} session${plural}`];
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
    lines.push(`- ${trend.name}: ${segments.join(", ")}`);
  }

  const ratingsLine = summarizeRatings(sessions);
  if (ratingsLine !== null) lines.push(ratingsLine);

  return lines.join("\n");
}
