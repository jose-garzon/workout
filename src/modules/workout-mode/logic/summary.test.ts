import { describe, expect, it } from "vitest";
import type { CompletedSession, ExerciseLog } from "../types";
import { summarizeSessions } from "./summary";

/**
 * `summarizeSessions` is pure (design.md §Decision 2): given completed sessions
 * it returns a compact per-exercise trend string (or `null`), with no I/O.
 */

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

describe("summarizeSessions", () => {
  it("returns null for an empty window", () => {
    expect(summarizeSessions([])).toBeNull();
  });

  it("shows a single weight (no arrow) for a single-session exercise", () => {
    const summary = summarizeSessions([
      session("s1", 1000, [log("e1", "Bench Press", 60)]),
    ]);
    expect(summary).toContain("Bench Press: 1 session, 60 kg, ~8 reps");
    expect(summary).not.toContain("→");
  });

  it("shows a first→last arrow across multiple sessions (chronological)", () => {
    // Passed newest-first (as the repo yields) — the arrow must still read oldest→newest.
    const summary = summarizeSessions([
      session("s3", 3000, [log("e1", "Bench Press", 67.5)]),
      session("s2", 2000, [log("e1", "Bench Press", 65)]),
      session("s1", 1000, [log("e1", "Bench Press", 60)]),
    ]);
    expect(summary).toContain("Bench Press: 3 sessions, 60→67.5 kg, ~8 reps");
  });

  it("omits the ratings line when no session recorded difficulty or fatigue", () => {
    const summary = summarizeSessions([
      session("s1", 1000, [log("e1", "Bench Press", 60)]),
    ]);
    expect(summary).not.toContain("Session ratings");
  });

  it("averages ratings only over sessions that recorded them", () => {
    const summary = summarizeSessions([
      session("s1", 1000, [log("e1", "Bench Press", 60)], {
        difficulty: 4,
        fatigue: 3,
      }),
      session("s2", 2000, [log("e1", "Bench Press", 65)], { difficulty: 2 }),
      session("s3", 3000, [log("e1", "Bench Press", 70)]),
    ]);
    // difficulty over 2 rated (4,2 → 3); fatigue over 1 rated (3); 2 rated sessions.
    expect(summary).toContain(
      "Session ratings: avg difficulty 3/5, avg fatigue 3/5 (over 2 rated sessions).",
    );
  });

  it("skips a trailing weightKg<=0 set when picking the representative weight", () => {
    // Finishing set is bodyweight (0) → the representative weight is the prior 80.
    const summary = summarizeSessions([
      session("s1", 1000, [log("e1", "Bench Press", 75, 80, 0)]),
    ]);
    expect(summary).toContain("Bench Press: 1 session, 80 kg, ~8 reps");
  });
});
