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
    const messages = buildRoutinePrompt("push/pull/legs", ctx, "en");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("folds the goal, training days, and prompt into the user message", () => {
    const [, user] = buildRoutinePrompt("chest priority", ctx, "en");
    expect(user.content).toContain("hypertrophy");
    expect(user.content).toContain("5");
    expect(user.content).toContain("chest priority");
  });

  it("folds gender and age into the user message", () => {
    const [, user] = buildRoutinePrompt("anything", ctx, "en");
    expect(user.content).toContain("Gender: female.");
    expect(user.content).toContain("Age: 34.");
  });

  it("renders height in the user's units, and omits it when absent", () => {
    const metric = buildRoutinePrompt("x", ctx, "en")[1].content;
    expect(metric).toContain("180 cm");

    const imperial = buildRoutinePrompt(
      "x",
      { ...ctx, unit: "imperial" },
      "en",
    )[1].content;
    // 180cm ≈ 70.9in → 5 ft 11 in.
    expect(imperial).toContain("5 ft 11 in");

    const { heightCm: _omit, ...noHeight } = ctx;
    expect(buildRoutinePrompt("x", noHeight, "en")[1].content).not.toContain(
      "Height",
    );
  });

  it("folds goal notes when present, and omits the line when blank", () => {
    const withNotes = buildRoutinePrompt(
      "x",
      { ...ctx, notes: "recovering from a shoulder tweak" },
      "en",
    )[1].content;
    expect(withNotes).toContain(
      "Additional goal notes: recovering from a shoulder tweak.",
    );

    expect(
      buildRoutinePrompt("x", { ...ctx, notes: "  " }, "en")[1].content,
    ).not.toContain("Additional goal notes");
    expect(buildRoutinePrompt("x", ctx, "en")[1].content).not.toContain(
      "Additional goal notes",
    );
  });

  it("instructs the model to author a subtitle", () => {
    const [system] = buildRoutinePrompt("anything", ctx, "en");
    expect(system.content).toContain("subtitle");
  });

  it("renders bodyweight in the user's units", () => {
    const metric = buildRoutinePrompt("x", ctx, "en")[1].content;
    expect(metric).toContain("80 kg");

    const imperial = buildRoutinePrompt(
      "x",
      { ...ctx, unit: "imperial" },
      "en",
    )[1].content;
    expect(imperial).toContain("176 lb");
  });

  it("omits the bodyweight line when none is provided", () => {
    const { bodyweightKg: _omit, ...noWeight } = ctx;
    const user = buildRoutinePrompt("x", noWeight, "en")[1].content;
    expect(user).not.toContain("Bodyweight");
  });

  it("is deterministic and side-effect-free", () => {
    expect(buildRoutinePrompt("same", ctx, "en")).toEqual(
      buildRoutinePrompt("same", ctx, "en"),
    );
  });
});

describe("buildEditPrompt", () => {
  const routine = {
    name: "PPL",
    days: [{ name: "Push", exercises: [{ name: "Bench", sets: [] }] }],
  };

  it("emits a system message and a single user message", () => {
    const messages = buildEditPrompt("add a legs day", routine, "en");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("instructs the model to apply only the requested change and keep the rest", () => {
    const [system] = buildEditPrompt("add a legs day", routine, "en");
    expect(system.content).toContain("ONLY");
    expect(system.content.toLowerCase()).toContain("json schema");
  });

  it("folds the current routine JSON and the instruction into the user message", () => {
    const [, user] = buildEditPrompt("add a legs day", routine, "en");
    expect(user.content).toContain(JSON.stringify(routine));
    expect(user.content).toContain("add a legs day");
  });

  it("is deterministic and side-effect-free", () => {
    expect(buildEditPrompt("x", routine, "en")).toEqual(
      buildEditPrompt("x", routine, "en"),
    );
  });

  it("appends a recent-history block when a session summary is present (routine-edit-history)", () => {
    const summary = "Recent history (last 3 sessions):\n- Bench: 3 sessions";
    const [system, user] = buildEditPrompt(
      "lighten the bench",
      routine,
      "en",
      summary,
    );
    expect(user.content).toContain("Recent workout history:");
    expect(user.content).toContain(summary);
    // The system prompt now instructs the model to consider that history.
    expect(system.content.toLowerCase()).toContain("recent workout history");
  });

  it("is byte-identical to a history-less edit when the summary is absent or empty", () => {
    const base = buildEditPrompt("add a legs day", routine, "en");
    expect(buildEditPrompt("add a legs day", routine, "en", undefined)).toEqual(
      base,
    );
    expect(buildEditPrompt("add a legs day", routine, "en", "   ")).toEqual(
      base,
    );
    expect(base[1].content).not.toContain("Recent workout history:");
  });
});

/**
 * The language directive (i18n-spanish-support §Decision 5) — asserted on both
 * builders: it names the language, comes LAST (after the example, whose English
 * exercise names the model would otherwise copy), and pins the JSON keys to
 * English so a translated key can never fail `routineSchema`.
 */
describe("language directive", () => {
  const routine = { name: "PPL", days: [] };

  it("asks for Spanish values while pinning the JSON keys to English", () => {
    const [system] = buildRoutinePrompt("x", ctx, "es");
    expect(system.content).toContain("Spanish");
    expect(system.content).toContain("KEYS stay EXACTLY as specified above");
  });

  it("asks for English when English is active", () => {
    const [system] = buildRoutinePrompt("x", ctx, "en");
    expect(system.content).toContain("English");
    expect(system.content).not.toContain("Spanish");
  });

  it("comes last in the system prompt, after the example", () => {
    const [system] = buildRoutinePrompt("x", ctx, "es");
    expect(system.content.indexOf("Spanish")).toBeGreaterThan(
      system.content.indexOf("Example of a well-formed response"),
    );
  });

  it("rides on the edit prompt too, so an edit never half-translates a routine", () => {
    const [system] = buildEditPrompt("add a legs day", routine, "es");
    expect(system.content).toContain("Spanish");
    expect(system.content.indexOf("Spanish")).toBeGreaterThan(
      system.content.indexOf("Example of a well-formed response"),
    );
    expect(
      buildEditPrompt("add a legs day", routine, "en")[0].content,
    ).toContain("English");
  });

  it("changes only the system message — the user message is language-agnostic", () => {
    expect(buildRoutinePrompt("x", ctx, "es")[1]).toEqual(
      buildRoutinePrompt("x", ctx, "en")[1],
    );
  });
});
