import { describe, expect, it } from "vitest";
import type { Goals, Profile } from "../types";
import {
  ALL_FIELD_NAMES,
  canAdvanceStep,
  cmToIn,
  convertDraftUnits,
  draftToRecords,
  getStepFields,
  initialDraft,
  inToCm,
  kgToLb,
  lbToKg,
  type OnboardingDraft,
  recordsToDraft,
  STEP_COUNT,
  validateAll,
  validateField,
  validateStep,
} from "./model";

/** A fully valid metric draft, overridable per test. */
function validDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    displayName: "Alex",
    gender: "male",
    age: "28",
    unit: "metric",
    bodyweight: "80",
    height: "180",
    focus: "strength",
    daysPerWeek: "4",
    ...overrides,
  };
}

const NO_ERRORS = {
  displayName: null,
  gender: null,
  age: null,
  unit: null,
  bodyweight: null,
  height: null,
  focus: null,
  daysPerWeek: null,
};

describe("step layout", () => {
  it("has exactly 4 steps", () => {
    expect(STEP_COUNT).toBe(4);
  });

  it("presents at most two fields on every step", () => {
    for (let i = 0; i < STEP_COUNT; i++) {
      const fields = getStepFields(i, initialDraft, NO_ERRORS);
      expect(fields.length).toBeGreaterThanOrEqual(1);
      expect(fields.length).toBeLessThanOrEqual(2);
    }
  });

  it("collects all eight locked fields across the four steps", () => {
    const seen = new Set<string>();
    for (let i = 0; i < STEP_COUNT; i++) {
      for (const f of getStepFields(i, initialDraft, NO_ERRORS))
        seen.add(f.name);
    }
    expect(seen).toEqual(
      new Set([
        "displayName",
        "gender",
        "age",
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
  const errs = NO_ERRORS;

  it("labels body inputs in kg/cm for metric", () => {
    const [bodyweight, height] = getStepFields(2, validDraft(), errs);
    expect(bodyweight.label).toContain("kg");
    expect(bodyweight.suffix).toBe("kg");
    expect(height.label).toContain("cm");
    expect(height.suffix).toBe("cm");
  });

  it("relabels body inputs in lb/in for imperial", () => {
    const [bodyweight, height] = getStepFields(
      2,
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

  it("lets the body step advance with a blank height when bodyweight is valid", () => {
    expect(canAdvanceStep(2, validDraft({ height: "" }))).toBe(true);
  });
});

describe("validation — gender (one of male/female/other)", () => {
  it("rejects blank and out-of-set values", () => {
    expect(validateField("gender", validDraft({ gender: "" }))).not.toBeNull();
    expect(
      validateField("gender", validDraft({ gender: "robot" })),
    ).not.toBeNull();
  });

  it("accepts each allowed option", () => {
    for (const g of ["male", "female", "other"]) {
      expect(validateField("gender", validDraft({ gender: g }))).toBeNull();
    }
  });
});

describe("validation — age (integer 13–120)", () => {
  it("accepts the boundary integers 13 and 120", () => {
    expect(validateField("age", validDraft({ age: "13" }))).toBeNull();
    expect(validateField("age", validDraft({ age: "120" }))).toBeNull();
  });

  it("rejects blank, non-numeric, out-of-range, and non-integers", () => {
    expect(validateField("age", validDraft({ age: "" }))).not.toBeNull();
    expect(validateField("age", validDraft({ age: "abc" }))).not.toBeNull();
    expect(validateField("age", validDraft({ age: "12" }))).not.toBeNull();
    expect(validateField("age", validDraft({ age: "121" }))).not.toBeNull();
    expect(validateField("age", validDraft({ age: "28.5" }))).not.toBeNull();
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
    expect(errors.gender).toBeNull();
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
      gender: "male",
      age: 28,
      unit: "metric",
      bodyweightKg: 80,
      heightCm: 180,
    });
    expect(goals).toEqual({ id: "me", focus: "strength", daysPerWeek: 4 });
  });

  it("carries gender and age (parsed to a number) onto the profile", () => {
    const { profile } = draftToRecords(
      validDraft({ gender: "female", age: "35" }),
    );
    expect(profile.gender).toBe("female");
    expect(profile.age).toBe(35);
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

describe("inverse unit conversion (edit-profile D4)", () => {
  it("converts kilograms to whole pounds", () => {
    expect(kgToLb(79.8)).toBe(176); // 79.8 kg ≈ 175.9 lb → 176
    expect(kgToLb(0)).toBe(0);
  });

  it("converts centimetres to whole inches", () => {
    expect(cmToIn(177.8)).toBe(70); // 177.8 cm = 70 in
    expect(cmToIn(2.5)).toBe(1); // 2.5 cm ≈ 0.98 in → 1
  });
});

describe("recordsToDraft — seeding the edit draft", () => {
  const metricProfile: Profile = {
    id: "me",
    displayName: "Alex",
    gender: "male",
    age: 28,
    unit: "metric",
    bodyweightKg: 80,
    heightCm: 180,
  };
  const goals: Goals = { id: "me", focus: "strength", daysPerWeek: 4 };

  it("passes metric bodyweight/height through as strings", () => {
    expect(recordsToDraft(metricProfile, goals)).toEqual({
      displayName: "Alex",
      gender: "male",
      age: "28",
      unit: "metric",
      bodyweight: "80",
      height: "180",
      focus: "strength",
      daysPerWeek: "4",
    });
  });

  it("converts imperial bodyweight/height back to whole lb/in", () => {
    const draft = recordsToDraft(
      {
        ...metricProfile,
        unit: "imperial",
        bodyweightKg: 79.8,
        heightCm: 177.8,
      },
      goals,
    );
    expect(draft.unit).toBe("imperial");
    expect(draft.bodyweight).toBe("176");
    expect(draft.height).toBe("70");
  });

  it("seeds undefined displayName / heightCm / gender / age as ''", () => {
    const sparse = {
      id: "me",
      unit: "metric",
      bodyweightKg: 80,
    } as unknown as Profile; // pre-2026-07-10 row: no gender/age/name/height
    const draft = recordsToDraft(sparse, null);
    expect(draft.displayName).toBe("");
    expect(draft.gender).toBe("");
    expect(draft.age).toBe("");
    expect(draft.height).toBe("");
  });

  it("seeds focus / daysPerWeek as '' when goals is null", () => {
    const draft = recordsToDraft(metricProfile, null);
    expect(draft.focus).toBe("");
    expect(draft.daysPerWeek).toBe("");
  });
});

describe("convertDraftUnits — re-express body values on a unit toggle", () => {
  it("converts metric → imperial (kg→lb, cm→in) and relabels the unit", () => {
    const next = convertDraftUnits(
      validDraft({ unit: "metric", bodyweight: "80", height: "180" }),
      "imperial",
    );
    expect(next.unit).toBe("imperial");
    expect(next.bodyweight).toBe("176"); // 80 kg → whole lb
    expect(next.height).toBe("71"); // 180 cm → whole in
  });

  it("converts imperial → metric (lb→kg, in→cm)", () => {
    const next = convertDraftUnits(
      validDraft({ unit: "imperial", bodyweight: "176", height: "70" }),
      "metric",
    );
    expect(next.unit).toBe("metric");
    expect(next.bodyweight).toBe("79.8"); // 176 lb → 0.1 kg
    expect(next.height).toBe("177.8"); // 70 in → 0.1 cm
  });

  it("leaves blank values blank and passes other fields through", () => {
    const next = convertDraftUnits(
      validDraft({
        unit: "metric",
        bodyweight: "80",
        height: "",
        displayName: "Alex",
      }),
      "imperial",
    );
    expect(next.height).toBe(""); // blank stays blank
    expect(next.displayName).toBe("Alex"); // unrelated field untouched
  });

  it("is a no-op (only relabels) when the unit does not change", () => {
    const draft = validDraft({ unit: "metric", bodyweight: "80" });
    expect(convertDraftUnits(draft, "metric")).toEqual(draft);
  });

  it("round-trips within one rounding step (lossy, accepted)", () => {
    const start = validDraft({
      unit: "metric",
      bodyweight: "80",
      height: "180",
    });
    const back = convertDraftUnits(
      convertDraftUnits(start, "imperial"),
      "metric",
    );
    expect(Number(back.bodyweight)).toBeCloseTo(80, 0); // 80 → 176 → 79.8
    expect(Number(back.height)).toBeCloseTo(180, 0); // 180 → 71 → 180.3
  });
});

describe("ALL_FIELD_NAMES / validateAll", () => {
  it("lists all 8 fields in onboarding order", () => {
    expect(ALL_FIELD_NAMES).toEqual([
      "displayName",
      "gender",
      "age",
      "unit",
      "bodyweight",
      "height",
      "focus",
      "daysPerWeek",
    ]);
  });

  it("reports no errors for a fully valid draft", () => {
    expect(validateAll(validDraft())).toEqual(NO_ERRORS);
  });

  it("reports every invalid field at once", () => {
    const errors = validateAll(
      validDraft({ displayName: "", age: "5", bodyweight: "" }),
    );
    expect(errors.displayName).not.toBeNull();
    expect(errors.age).not.toBeNull();
    expect(errors.bodyweight).not.toBeNull();
    expect(errors.gender).toBeNull();
    expect(errors.height).toBeNull(); // optional, blank
  });
});
