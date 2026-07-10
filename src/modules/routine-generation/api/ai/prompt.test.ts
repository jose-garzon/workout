import { describe, expect, it } from "vitest";
import { buildRoutinePrompt, type PromptContext } from "./prompt";

/**
 * buildRoutinePrompt is pure and server-safe (design.md §D2): the user's
 * profile/goals fold into the messages, output is deterministic, and there is
 * no Dexie/network reach.
 */

const ctx: PromptContext = {
  focus: "hypertrophy",
  daysPerWeek: 5,
  bodyweightKg: 80,
  unit: "metric",
};

describe("buildRoutinePrompt", () => {
  it("emits a system message and a single user message", () => {
    const messages = buildRoutinePrompt("push/pull/legs", ctx);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("folds the goal, training days, and prompt into the user message", () => {
    const [, user] = buildRoutinePrompt("chest priority", ctx);
    expect(user.content).toContain("hypertrophy");
    expect(user.content).toContain("5");
    expect(user.content).toContain("chest priority");
  });

  it("instructs the model to author a subtitle", () => {
    const [system] = buildRoutinePrompt("anything", ctx);
    expect(system.content).toContain("subtitle");
  });

  it("renders bodyweight in the user's units", () => {
    const metric = buildRoutinePrompt("x", ctx)[1].content;
    expect(metric).toContain("80 kg");

    const imperial = buildRoutinePrompt("x", { ...ctx, unit: "imperial" })[1]
      .content;
    expect(imperial).toContain("176 lb");
  });

  it("omits the bodyweight line when none is provided", () => {
    const { bodyweightKg: _omit, ...noWeight } = ctx;
    const user = buildRoutinePrompt("x", noWeight)[1].content;
    expect(user).not.toContain("Bodyweight");
  });

  it("is deterministic and side-effect-free", () => {
    expect(buildRoutinePrompt("same", ctx)).toEqual(
      buildRoutinePrompt("same", ctx),
    );
  });
});
