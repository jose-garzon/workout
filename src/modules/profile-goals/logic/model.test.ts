import { describe, expect, it } from "vitest";
import {
  canAdvanceStep,
  draftToRecords,
  getStepFields,
  initialDraft,
  inToCm,
  lbToKg,
  type OnboardingDraft,
  STEP_COUNT,
  validateField,
  validateStep,
} from "./model";

/** A fully valid metric draft, overridable per test. */
function validDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    displayName: "Alex",
    unit: "metric",
    bodyweight: "80",
    height: "180",
    focus: "strength",
    daysPerWeek: "4",
    ...overrides,
  };
}

describe("step layout", () => {
  it("has exactly 3 steps", () => {
    expect(STEP_COUNT).toBe(3);
  });

  it("presents at most two fields on every step", () => {
    for (let i = 0; i < STEP_COUNT; i++) {
      const fields = getStepFields(i, initialDraft, {
        displayName: null,
        unit: null,
        bodyweight: null,
        height: null,
        focus: null,
        daysPerWeek: null,
      });
      expect(fields.length).toBeGreaterThanOrEqual(1);
      expect(fields.length).toBeLessThanOrEqual(2);
    }
  });

  it("collects all six locked fields across the three steps", () => {
    const seen = new Set<string>();
    const errs = {
      displayName: null,
      unit: null,
      bodyweight: null,
      height: null,
      focus: null,
      daysPerWeek: null,
    };
    for (let i = 0; i < STEP_COUNT; i++) {
      for (const f of getStepFields(i, initialDraft, errs)) seen.add(f.name);
    }
    expect(seen).toEqual(
      new Set([
        "displayName",
        "unit",
        "bodyweight",
        "height",
        "focus",
        "daysPerWeek",
      ]),
    );
  });

  it("defaults units to metric", () => {
    expect(initialDraft.unit).toBe("metric");
  });
});

describe("unit-aware labels", () => {
  const errs = {
    displayName: null,
    unit: null,
    bodyweight: null,
    height: null,
    focus: null,
    daysPerWeek: null,
  };

  it("labels body inputs in kg/cm for metric", () => {
    const [bodyweight, height] = getStepFields(1, validDraft(), errs);
    expect(bodyweight.label).toContain("kg");
    expect(bodyweight.suffix).toBe("kg");
    expect(height.label).toContain("cm");
    expect(height.suffix).toBe("cm");
  });

  it("relabels body inputs in lb/in for imperial", () => {
    const [bodyweight, height] = getStepFields(
      1,
      validDraft({ unit: "imperial" }),
      errs,
    );
    expect(bodyweight.label).toContain("lb");
    expect(bodyweight.suffix).toBe("lb");
    expect(height.label).toContain("in");
    expect(height.suffix).toBe("in");
  });
});

describe("validation — required fields", () => {
  it("rejects an empty / whitespace display name", () => {
    expect(
      validateField("displayName", validDraft({ displayName: "" })),
    ).not.toBeNull();
    expect(
      validateField("displayName", validDraft({ displayName: "   " })),
    ).not.toBeNull();
    expect(
      validateField("displayName", validDraft({ displayName: "Alex" })),
    ).toBeNull();
  });

  it("rejects a missing / non-metric-or-imperial unit", () => {
    expect(validateField("unit", validDraft({ unit: "" }))).not.toBeNull();
    expect(
      validateField("unit", validDraft({ unit: "stones" })),
    ).not.toBeNull();
    expect(validateField("unit", validDraft({ unit: "metric" }))).toBeNull();
    expect(validateField("unit", validDraft({ unit: "imperial" }))).toBeNull();
  });

  it("requires a focus from the allowed set", () => {
    expect(validateField("focus", validDraft({ focus: "" }))).not.toBeNull();
    expect(
      validateField("focus", validDraft({ focus: "cardio" })),
    ).not.toBeNull();
    expect(
      validateField("focus", validDraft({ focus: "hypertrophy" })),
    ).toBeNull();
  });
});

describe("validation — bodyweight (numeric > 0)", () => {
  it("rejects blank, non-numeric, zero, and negative", () => {
    expect(
      validateField("bodyweight", validDraft({ bodyweight: "" })),
    ).not.toBeNull();
    expect(
      validateField("bodyweight", validDraft({ bodyweight: "abc" })),
    ).not.toBeNull();
    expect(
      validateField("bodyweight", validDraft({ bodyweight: "0" })),
    ).not.toBeNull();
    expect(
      validateField("bodyweight", validDraft({ bodyweight: "-5" })),
    ).not.toBeNull();
  });

  it("accepts a positive number", () => {
    expect(
      validateField("bodyweight", validDraft({ bodyweight: "72.5" })),
    ).toBeNull();
  });
});

describe("validation — height (optional)", () => {
  it("does not block when blank", () => {
    expect(validateField("height", validDraft({ height: "" }))).toBeNull();
    expect(validateField("height", validDraft({ height: "   " }))).toBeNull();
  });

  it("rejects a present but invalid value", () => {
    expect(
      validateField("height", validDraft({ height: "abc" })),
    ).not.toBeNull();
    expect(validateField("height", validDraft({ height: "0" }))).not.toBeNull();
  });

  it("lets step 2 advance with a blank height when bodyweight is valid", () => {
    expect(canAdvanceStep(1, validDraft({ height: "" }))).toBe(true);
  });
});

describe("validation — daysPerWeek (integer 1–7, D7)", () => {
  it("accepts each integer 1 through 7", () => {
    for (let d = 1; d <= 7; d++) {
      expect(
        validateField("daysPerWeek", validDraft({ daysPerWeek: String(d) })),
      ).toBeNull();
    }
  });

  it("rejects 0, 8, blank, and non-integers", () => {
    expect(
      validateField("daysPerWeek", validDraft({ daysPerWeek: "0" })),
    ).not.toBeNull();
    expect(
      validateField("daysPerWeek", validDraft({ daysPerWeek: "8" })),
    ).not.toBeNull();
    expect(
      validateField("daysPerWeek", validDraft({ daysPerWeek: "" })),
    ).not.toBeNull();
    expect(
      validateField("daysPerWeek", validDraft({ daysPerWeek: "3.5" })),
    ).not.toBeNull();
  });
});

describe("canAdvance / validateStep", () => {
  it("blocks step 1 when the name is empty and reports the offending field", () => {
    const draft = validDraft({ displayName: "" });
    expect(canAdvanceStep(0, draft)).toBe(false);
    const errors = validateStep(0, draft);
    expect(errors.displayName).not.toBeNull();
    expect(errors.unit).toBeNull();
  });

  it("advances every step of a fully valid draft", () => {
    const draft = validDraft();
    for (let i = 0; i < STEP_COUNT; i++) {
      expect(canAdvanceStep(i, draft)).toBe(true);
    }
  });
});

describe("unit conversion", () => {
  it("converts pounds to kilograms with 0.1 rounding", () => {
    expect(lbToKg(100)).toBeCloseTo(45.4, 5); // 45.359237 → 45.4
    expect(lbToKg(0)).toBe(0);
  });

  it("converts inches to centimetres with 0.1 rounding", () => {
    expect(inToCm(70)).toBeCloseTo(177.8, 5); // 177.8
    expect(inToCm(1)).toBeCloseTo(2.5, 5); // 2.54 → 2.5
  });
});

describe("draftToRecords — canonicalization to SI", () => {
  it("passes metric values through as kg/cm", () => {
    const { profile, goals } = draftToRecords(
      validDraft({ bodyweight: "80", height: "180" }),
    );
    expect(profile).toMatchObject({
      id: "me",
      displayName: "Alex",
      unit: "metric",
      bodyweightKg: 80,
      heightCm: 180,
    });
    expect(goals).toEqual({ id: "me", focus: "strength", daysPerWeek: 4 });
  });

  it("converts imperial input to canonical kg/cm before persistence", () => {
    const { profile } = draftToRecords(
      validDraft({ unit: "imperial", bodyweight: "176", height: "70" }),
    );
    expect(profile.unit).toBe("imperial");
    expect(profile.bodyweightKg).toBeCloseTo(79.8, 5); // 176 lb
    expect(profile.heightCm).toBeCloseTo(177.8, 5); // 70 in
  });

  it("omits heightCm entirely when height is left blank", () => {
    const { profile } = draftToRecords(validDraft({ height: "" }));
    expect(profile.heightCm).toBeUndefined();
    expect("heightCm" in profile).toBe(false);
  });

  it("trims the display name", () => {
    const { profile } = draftToRecords(validDraft({ displayName: "  Sam  " }));
    expect(profile.displayName).toBe("Sam");
  });
});
