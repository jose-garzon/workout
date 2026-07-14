import { describe, expect, it } from "vitest";
import {
  buildEditPrompt,
  buildRoutinePrompt,
  type PromptContext,
} from "./prompt";

/**
 * buildRoutinePrompt is pure and server-safe (design.md §D2): the user's
 * profile/goals fold into the messages, output is deterministic, and there is
 * no Dexie/network reach.
 */

const ctx: PromptContext = {
  focus: "hypertrophy",
  daysPerWeek: 5,
  gender: "female",
  age: 34,
  bodyweightKg: 80,
  heightCm: 180,
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

  it("folds gender and age into the user message", () => {
    const [, user] = buildRoutinePrompt("anything", ctx);
    expect(user.content).toContain("Gender: female.");
    expect(user.content).toContain("Age: 34.");
  });

  it("renders height in the user's units, and omits it when absent", () => {
    const metric = buildRoutinePrompt("x", ctx)[1].content;
    expect(metric).toContain("180 cm");

    const imperial = buildRoutinePrompt("x", { ...ctx, unit: "imperial" })[1]
      .content;
    // 180cm ≈ 70.9in → 5 ft 11 in.
    expect(imperial).toContain("5 ft 11 in");

    const { heightCm: _omit, ...noHeight } = ctx;
    expect(buildRoutinePrompt("x", noHeight)[1].content).not.toContain(
      "Height",
    );
  });

  it("folds goal notes when present, and omits the line when blank", () => {
    const withNotes = buildRoutinePrompt("x", {
      ...ctx,
      notes: "recovering from a shoulder tweak",
    })[1].content;
    expect(withNotes).toContain(
      "Additional goal notes: recovering from a shoulder tweak.",
    );

    expect(
      buildRoutinePrompt("x", { ...ctx, notes: "  " })[1].content,
    ).not.toContain("Additional goal notes");
    expect(buildRoutinePrompt("x", ctx)[1].content).not.toContain(
      "Additional goal notes",
    );
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

describe("buildEditPrompt", () => {
  const routine = {
    name: "PPL",
    days: [{ name: "Push", exercises: [{ name: "Bench", sets: [] }] }],
  };

  it("emits a system message and a single user message", () => {
    const messages = buildEditPrompt("add a legs day", routine);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("instructs the model to apply only the requested change and keep the rest", () => {
    const [system] = buildEditPrompt("add a legs day", routine);
    expect(system.content).toContain("ONLY");
    expect(system.content.toLowerCase()).toContain("json schema");
  });

  it("folds the current routine JSON and the instruction into the user message", () => {
    const [, user] = buildEditPrompt("add a legs day", routine);
    expect(user.content).toContain(JSON.stringify(routine));
    expect(user.content).toContain("add a legs day");
  });

  it("is deterministic and side-effect-free", () => {
    expect(buildEditPrompt("x", routine)).toEqual(
      buildEditPrompt("x", routine),
    );
  });
});
