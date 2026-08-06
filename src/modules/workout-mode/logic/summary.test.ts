import { describe, expect, it } from "vitest";
import type { CompletedSession, ExerciseLog } from "../types";
import { type SummaryContext, summarizeSessions } from "./summary";

/**
 * `summarizeSessions` is pure (design.md §Decision 2): given completed sessions
 * plus the routine facts the caller supplies, it returns a compact summary
 * string (or `null`), with no I/O.
 */

const DAY = 86_400_000;
/** An arbitrary fixed epoch — the summarizer reads no clock, only these deltas. */
const T0 = 1_700_000_000_000;

/**
 * Default context: no weekly target (so no adherence line), nothing prescribed
 * and a one-day split (so no skipped line). Tests opt into each feature.
 */
function ctx(overrides: Partial<SummaryContext> = {}): SummaryContext {
  return { prescribed: [], dayCount: 1, daysPerWeek: null, ...overrides };
}

function log(
  exerciseId: string,
  name: string,
  ...weightsKg: number[]
): ExerciseLog {
  return {
    exerciseId,
    name,
    series: weightsKg.map((weightKg) => ({
      reps: 8,
      weightKg,
      workSeconds: 30,
      volumeKg: weightKg * 8,
    })),
    restSeconds: 120,
  };
}

/** One exercise log worth exactly `workSeconds` of session time, no rest. */
function timedLog(workSeconds: number): ExerciseLog {
  return {
    exerciseId: "e1",
    name: "Bench Press",
    series: [{ reps: 8, weightKg: 60, workSeconds, volumeKg: 480 }],
    restSeconds: 0,
  };
}

function session(
  id: string,
  completedAt: number,
  logs: ExerciseLog[],
  ratings: { difficulty?: number; fatigue?: number } = {},
): CompletedSession {
  return {
    id,
    routineId: "active",
    dayId: "d1",
    completedAt,
    exerciseLogs: logs,
    ...ratings,
  };
}

/** One session per weight, one day apart, oldest first. */
function benchWindow(...weightsKg: number[]): CompletedSession[] {
  return weightsKg.map((weightKg, i) =>
    session(`s${i}`, T0 + i * DAY, [log("e1", "Bench Press", weightKg)]),
  );
}

describe("summarizeSessions", () => {
  it("returns null for an empty window", () => {
    expect(summarizeSessions([], ctx())).toBeNull();
  });

  it("shows a single weight (no arrow) for a single-exposure exercise", () => {
    const summary = summarizeSessions(
      [session("s1", 1000, [log("e1", "Bench Press", 60)])],
      ctx(),
    );
    expect(summary).toContain("Bench Press: 1 exposure, 60 kg, ~8 reps");
    expect(summary).not.toContain("→");
  });

  it("shows a first→last arrow across multiple sessions (chronological)", () => {
    // Passed newest-first (as the repo yields) — the arrow must still read oldest→newest.
    const summary = summarizeSessions(
      [
        session("s3", 3000, [log("e1", "Bench Press", 67.5)]),
        session("s2", 2000, [log("e1", "Bench Press", 65)]),
        session("s1", 1000, [log("e1", "Bench Press", 60)]),
      ],
      ctx(),
    );
    expect(summary).toContain("Bench Press: 3 exposures, 60→67.5 kg, ~8 reps");
  });

  it("omits the ratings line when no session recorded difficulty or fatigue", () => {
    const summary = summarizeSessions(
      [session("s1", 1000, [log("e1", "Bench Press", 60)])],
      ctx(),
    );
    expect(summary).not.toContain("Session ratings");
  });

  it("averages ratings only over sessions that recorded them", () => {
    const summary = summarizeSessions(
      [
        session("s1", 1000, [log("e1", "Bench Press", 60)], {
          difficulty: 4,
          fatigue: 3,
        }),
        session("s2", 2000, [log("e1", "Bench Press", 65)], { difficulty: 2 }),
        session("s3", 3000, [log("e1", "Bench Press", 70)]),
      ],
      ctx(),
    );
    // difficulty over 2 rated (4,2 → 3); fatigue over 1 rated (3); 2 rated sessions.
    expect(summary).toContain(
      "Session ratings: avg difficulty 3/5, avg fatigue 3/5 (over 2 rated sessions).",
    );
  });

  it("skips a trailing weightKg<=0 set when picking the representative weight", () => {
    // Finishing set is bodyweight (0) → the representative weight is the prior 80.
    const summary = summarizeSessions(
      [session("s1", 1000, [log("e1", "Bench Press", 75, 80, 0)])],
      ctx(),
    );
    expect(summary).toContain("Bench Press: 1 exposure, 80 kg, ~8 reps");
  });
});

/** Adherence (§D5) — span-based, inclusive, and never invented. */
describe("adherence", () => {
  it("rates sessions against the weekly target over the observed span", () => {
    // First and last are exactly 20 days apart → an inclusive span of 21 days
    // → 3.0 weeks → 3 × 4 = 12 expected. (21 days apart would give 3.14 weeks.)
    const offsets = [0, 2, 5, 7, 9, 12, 16, 20];
    const summary = summarizeSessions(
      offsets.map((d, i) =>
        session(`s${i}`, T0 + d * DAY, [log("e1", "Bench Press", 60)]),
      ),
      ctx({ daysPerWeek: 4 }),
    );
    expect(summary).toContain("Recent history (last 8 sessions, ~3.0 weeks):");
    expect(summary).toContain(
      "Adherence: 8 of ~12 expected sessions (67%), target 4/week.",
    );
  });

  it("reports but does not rate a window under one week", () => {
    const summary = summarizeSessions(
      [
        session("s1", T0, [log("e1", "Bench Press", 60)]),
        session("s2", T0 + 2 * DAY, [log("e1", "Bench Press", 60)]),
        session("s3", T0 + 4 * DAY, [log("e1", "Bench Press", 60)]),
      ],
      ctx({ daysPerWeek: 4 }),
    );
    expect(summary).toContain(
      "Adherence: 3 sessions over 5 days, target 4/week (window under one week — not rated).",
    );
  });

  it("omits the adherence line entirely when no weekly target is saved", () => {
    const summary = summarizeSessions(benchWindow(60, 62.5), ctx());
    expect(summary).not.toContain("Adherence");
  });
});

/** Per-exercise trend (§D6) — load × reps, first vs last of the last 4, ±2 %. */
describe("per-exercise trend", () => {
  it("declares an upward trend across four rising exposures", () => {
    const summary = summarizeSessions(benchWindow(60, 62.5, 65, 67.5), ctx());
    expect(summary).toContain(
      "Bench Press: 4 exposures, 60→67.5 kg, ~8 reps, trending up",
    );
  });

  it("declares a flat trend across four identical exposures", () => {
    const summary = summarizeSessions(benchWindow(60, 60, 60, 60), ctx());
    expect(summary).toContain("Bench Press: 4 exposures, 60 kg, ~8 reps, flat");
  });

  it("declares a downward trend across four falling exposures", () => {
    const summary = summarizeSessions(benchWindow(67.5, 65, 62.5, 60), ctx());
    expect(summary).toContain(
      "Bench Press: 4 exposures, 67.5→60 kg, ~8 reps, trending down",
    );
  });

  it("declares no trend from only two exposures", () => {
    const summary = summarizeSessions(benchWindow(60, 65), ctx());
    expect(summary).toContain("Bench Press: 2 exposures, 60→65 kg, ~8 reps");
    expect(summary).not.toContain("trending");
    expect(summary).not.toContain("flat");
  });

  it("counts bodyweight-only exposures but declares no trend from them", () => {
    // Every set carries the weightKg<=0 sentinel → exposures count, no metric.
    const summary = summarizeSessions(
      [0, 0, 0, 0].map((weightKg, i) =>
        session(`s${i}`, T0 + i * DAY, [log("e1", "Pull Up", weightKg)]),
      ),
      ctx(),
    );
    expect(summary).toContain("Pull Up: 4 exposures, ~8 reps");
    expect(summary).not.toContain("trending");
    expect(summary).not.toContain("flat");
  });
});

/** Never-logged prescriptions (§D7) — gated on one full rotation of the split. */
describe("skipped exercises", () => {
  const prescribed = Array.from({ length: 12 }, (_, i) => ({
    id: `e${i + 1}`,
    name: `Exercise ${i + 1}`,
  }));

  it("names prescribed exercises with zero exposures in the window", () => {
    // 12 sessions over a 4-day split; only e1–e8 were ever logged.
    const sessions = Array.from({ length: 12 }, (_, i) =>
      session(
        `s${i}`,
        T0 + i * DAY,
        prescribed
          .slice(0, 8)
          .map((exercise) => log(exercise.id, exercise.name, 60)),
      ),
    );
    const summary = summarizeSessions(
      sessions,
      ctx({ prescribed, dayCount: 4 }),
    );
    expect(summary).toContain(
      "Prescribed but never logged in this window: Exercise 9, Exercise 10, Exercise 11, Exercise 12.",
    );
  });

  it("suppresses the line until the window covers one full rotation", () => {
    const sessions = [
      session("s1", T0, [log("e1", "Exercise 1", 60)]),
      session("s2", T0 + DAY, [log("e1", "Exercise 1", 60)]),
    ];
    const summary = summarizeSessions(
      sessions,
      ctx({ prescribed, dayCount: 4 }),
    );
    expect(summary).not.toContain("never logged");
  });

  it("never reports a renamed exercise, since logs key on the exercise id", () => {
    const summary = summarizeSessions(
      [session("s1", T0, [log("e1", "Bench Press", 60)])],
      // An earlier edit renamed it; the id — and so the history — is preserved.
      ctx({ prescribed: [{ id: "e1", name: "Barbell Bench" }], dayCount: 1 }),
    );
    expect(summary).not.toContain("never logged");
  });

  it("never reports an exercise that is no longer prescribed", () => {
    // "Old Curl" was dropped by an earlier edit but still has real history.
    const summary = summarizeSessions(
      [
        session("s1", T0, [
          log("e1", "Exercise 1", 60),
          log("e-old", "Old Curl", 20),
        ]),
      ],
      ctx({ prescribed: [{ id: "e1", name: "Exercise 1" }], dayCount: 1 }),
    );
    expect(summary).toContain("Old Curl: 1 exposure");
    expect(summary).not.toContain("never logged");
  });
});

/** Training time (§D8) — logged work + logged rest, never a wall clock. */
describe("training time", () => {
  it("sums logged work seconds and logged rest seconds per session", () => {
    // Two sets × 30 s work + 120 s rest = 180 s = 3 min.
    const summary = summarizeSessions(
      [session("s1", T0, [log("e1", "Bench Press", 60, 60)])],
      ctx(),
    );
    expect(summary).toContain("Training time: ~3 min/session avg.");
  });

  it("reports a rising direction once the window holds four sessions", () => {
    const summary = summarizeSessions(
      [600, 600, 1200, 1200].map((seconds, i) =>
        session(`s${i}`, T0 + i * DAY, [timedLog(seconds)]),
      ),
      ctx(),
    );
    expect(summary).toContain(
      "Training time: ~15 min/session avg, rising across the window.",
    );
  });

  it("reports no direction from a three-session window", () => {
    const summary = summarizeSessions(
      [600, 600, 1200].map((seconds, i) =>
        session(`s${i}`, T0 + i * DAY, [timedLog(seconds)]),
      ),
      ctx(),
    );
    expect(summary).toContain("Training time: ~13 min/session avg.");
    expect(summary).not.toContain("across the window");
  });
});

/** Length bound (§D9) — 20 per-exercise lines, most-exposed kept. */
describe("length bound", () => {
  it("truncates the per-exercise section and states the omitted count", () => {
    const logs = Array.from({ length: 25 }, (_, i) =>
      log(`e${i}`, `Exercise ${i}`, 60),
    );
    const summary = summarizeSessions(
      [session("s1", T0, logs)],
      ctx(),
    ) as string;
    expect(summary).toContain("(+5 more exercises omitted)");
    expect(summary.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(
      20,
    );
  });

  it("keeps a full 20-session window across a large routine within a few kB", () => {
    const sessions = Array.from({ length: 20 }, (_, s) =>
      session(
        `s${s}`,
        T0 + s * DAY,
        Array.from({ length: 30 }, (_, e) =>
          log(`e${e}`, `Exercise Number ${e}`, 60 + s),
        ),
      ),
    );
    const summary = summarizeSessions(
      sessions,
      ctx({ daysPerWeek: 4 }),
    ) as string;
    expect(summary.length).toBeLessThan(3000);
  });
});
