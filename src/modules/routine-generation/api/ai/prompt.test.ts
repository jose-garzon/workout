import { describe, expect, it } from "vitest";
import { ageAdjustment, focusBands, splitGuidance } from "./coaching";
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

/**
 * The coaching frame (evidence-based-routine-prompts §D2/§D3) — asserted through
 * `buildRoutinePrompt`, since the assembly is half of what is being specified.
 */
describe("create prompt — programming frame", () => {
  const systemFor = (overrides: Partial<PromptContext> = {}): string =>
    buildRoutinePrompt("x", { ...ctx, ...overrides }, "en")[0].content;

  it("states a weekly volume dose, a per-session cap, and splits across days", () => {
    const system = systemFor();
    expect(system).toContain("10-20 hard sets per muscle group per WEEK");
    expect(system).toContain("cap each muscle group at 6-8 hard sets");
    expect(system).toContain(
      "SPLIT a muscle's weekly volume across training days",
    );
    expect(system).toContain("Frequency DISTRIBUTES volume");
  });

  it("carries split guidance for the requested week alongside the day-count directive", () => {
    const system = systemFor({ daysPerWeek: 4 });
    expect(system).toContain("Split guidance for a 4-day week");
    expect(system).toContain("upper / lower, run twice");
    expect(system).toContain(
      "Return EXACTLY as many day entries as the requested training-days count.",
    );
  });

  it("still carries split guidance for out-of-range, fractional, and non-finite day counts", () => {
    // `parseBuildBody` checks only `typeof daysPerWeek === "number"`, so 3.5 and
    // NaN genuinely reach the selector — the normalize-then-clamp step exists
    // for exactly these two.
    for (const daysPerWeek of [1, 9, 3.5, Number.NaN]) {
      expect(() => systemFor({ daysPerWeek })).not.toThrow();
      expect(systemFor({ daysPerWeek })).toContain("Split guidance for a");
    }
    expect(splitGuidance(3.5)).toContain("4-day");
    expect(splitGuidance(Number.NaN)).toContain("3-day");
  });

  it("states rep and rest bands per exercise tier", () => {
    const system = systemFor();
    expect(system).toContain("Heavy compounds");
    expect(system).toContain("Secondary compounds");
    expect(system).toContain("Isolation and single-joint work");
  });

  it("gives endurance a high-rep, short-rest band", () => {
    const system = systemFor({ focus: "endurance" });
    expect(system).toContain("12-20 reps, 60 s rest");
    expect(system).toContain("15-30 reps, 30-45 s rest");
  });

  it("gives strength a low-rep, long-rest band", () => {
    const system = systemFor({ focus: "strength" });
    expect(system).toContain("3-6 reps, 180-300 s rest");
  });

  it("gives general the default bands plus balanced muscle-group coverage", () => {
    const system = systemFor({ focus: "general" });
    expect(system).toContain("5-10 reps, 120-180 s rest");
    expect(system).toContain(
      "Balance the week across every major muscle group",
    );
  });

  it("falls back to the default bands for an unrecognized focus", () => {
    expect(() => systemFor({ focus: "mobility" })).not.toThrow();
    expect(focusBands("mobility")).toBe(focusBands("hypertrophy"));
    expect(systemFor({ focus: "mobility" })).toContain(
      "5-10 reps, 120-180 s rest",
    );
  });

  it("states the selection and ordering rules", () => {
    const system = systemFor();
    expect(system).toContain("LENGTHENED position");
    expect(system).toContain("Cover every function of each muscle");
    expect(system).toContain("MOST to LEAST technically demanding");
  });

  it("forbids a range where the schema wants an integer", () => {
    const system = systemFor();
    expect(system).toContain("CONCRETE WHOLE NUMBER");
    expect(system).toContain('never a range ("8-12")');
  });
});

describe("create prompt — age adjustments", () => {
  const systemFor = (age: number): string =>
    buildRoutinePrompt("x", { ...ctx, age }, "en")[0].content;

  it("carries the 60+ block for a 63-year-old", () => {
    const system = systemFor(63);
    expect(system).toContain("keep weekly volume at the LOW end of the range");
    expect(system).toContain("machines and cables");
  });

  it("carries no age block for a 28-year-old", () => {
    expect(systemFor(28)).not.toContain("Age adjustment");
  });

  it("carries the under-18 block, and nothing the schema cannot hold", () => {
    const youth = ageAdjustment(16) ?? "";
    const system = systemFor(16);
    expect(system).toContain(youth);
    expect(youth).toContain("cover the whole body");
    expect(youth).toContain("No working set goes below 8 reps");
    expect(youth).toContain("Avoid near-maximal loading");
    // Beginner form guidance is a locked non-goal, and RIR has no schema field.
    expect(youth.toLowerCase()).not.toContain("technique");
    expect(youth.toLowerCase()).not.toContain("failure");
    expect(youth).not.toContain("RIR");
  });

  it("puts the band boundaries on the stated side", () => {
    expect(ageAdjustment(18)).toBeNull();
    expect(ageAdjustment(40)).toBe(ageAdjustment(45));
    expect(ageAdjustment(40)).toContain("machines and cables");
    expect(ageAdjustment(60)).toBe(ageAdjustment(63));
    expect(ageAdjustment(60)).toContain("LOW end of the range");
  });

  it("emits no block for a non-finite age", () => {
    expect(ageAdjustment(Number.NaN)).toBeNull();
  });
});

describe("create prompt — day count always wins", () => {
  it("keeps the day-count directive and states no frequency of its own", () => {
    const system = buildRoutinePrompt(
      "x",
      { ...ctx, age: 16, daysPerWeek: 6 },
      "en",
    )[0].content;
    const youth = ageAdjustment(16) ?? "";

    expect(system).toContain(
      "Return EXACTLY as many day entries as the requested training-days count.",
    );
    expect(youth).toContain(
      "keep the requested day count exactly as instructed",
    );
    expect(youth).not.toContain("per week");
    expect(youth).not.toContain("/week");
    expect(youth).not.toContain("days a week");
  });

  it("states the age block after the focus bands, so it reads as narrowing them", () => {
    const strength: PromptContext = { ...ctx, age: 16, focus: "strength" };
    const system = buildRoutinePrompt("x", strength, "en")[0].content;
    const youth = ageAdjustment(16) ?? "";

    expect(system.indexOf(youth)).toBeGreaterThan(
      system.indexOf(focusBands("strength")),
    );
    expect(youth).toContain("narrows that band to a floor of 8");
  });
});

describe("create prompt — the JSON contract survives", () => {
  const system = buildRoutinePrompt("x", ctx, "en")[0].content;

  it("still carries the interpret, contract, schema, and example blocks", () => {
    expect(system).toContain("Interpret the request generously");
    expect(system).toContain("Never ask the user to");
    expect(system).toContain("Respond with ONE JSON object and NOTHING else");
    expect(system).toContain(
      "The response is ONE JSON object matching this JSON schema:",
    );
    expect(system).toContain("Example of a well-formed response");
  });

  it("places every coaching block before the output contract, in order", () => {
    const contract = system.indexOf("Respond with ONE JSON object");
    for (const block of [
      "Programming frame",
      "Split guidance for a",
      "Rep and rest bands by exercise tier",
      "Everything above governs your INTERNAL reasoning only",
    ]) {
      expect(system.indexOf(block)).toBeGreaterThan(-1);
      expect(system.indexOf(block)).toBeLessThan(contract);
    }
    expect(contract).toBeLessThan(
      system.indexOf("The response is ONE JSON object"),
    );
    expect(system.indexOf("The response is ONE JSON object")).toBeLessThan(
      system.indexOf("Example of a well-formed response"),
    );
  });

  it("asks for no prose: the frame is internal reasoning only", () => {
    expect(system).toContain(
      "Everything above governs your INTERNAL reasoning only",
    );
    expect(system).toContain("never ask the user anything");
    expect(system).toContain("design the closest safe alternative");

    // The source material's prose-producing directives, none of which survived.
    const lower = system.toLowerCase();
    for (const dropped of [
      "state why you deviated",
      "state the reasoning",
      "explain why",
      "report both direct and effective",
      "say so explicitly",
      "say this explicitly",
    ]) {
      expect(lower).not.toContain(dropped);
    }
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
 * Edit-time diagnostics (evidence-based-routine-prompts §D3). Every rule tells
 * the model how to READ the history; none authorizes a change of its own, which
 * is why the anti-proactive directive is asserted alongside them.
 */
describe("edit prompt — diagnostics", () => {
  const routine = { name: "PPL", days: [] };
  const system = buildEditPrompt("make legs harder", routine, "en")[0].content;

  it("states the diagnostic rules", () => {
    expect(system).toContain("Read adherence first");
    expect(system).toContain("at least three exposures");
    expect(system).toContain("Objective load × reps progression outweighs");
    expect(system).toContain("cut exercises — never rest seconds");
    expect(system).toContain("Keep exercise continuity");
  });

  it("frames them as shaping the requested change, not authorizing one", () => {
    expect(system).toContain("how to SHAPE the change you were asked for");
    expect(system).toContain("never authorize a change");
  });

  it("protects a never-logged exercise from being read as removable", () => {
    expect(system).toContain("may simply have been added recently");
    expect(system).toContain("not remove it unless the instruction asks");
  });

  it("forbids proactive revision on top of the existing strict contract", () => {
    expect(system).toContain("ONLY the requested change");
    expect(system).toContain(
      "Never revise, add, remove, or rebalance anything the instruction did not reference",
    );
  });

  it("keeps the diagnostics before the output contract", () => {
    expect(system.indexOf("Read adherence first")).toBeLessThan(
      system.indexOf("Respond with ONE JSON object"),
    );
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
