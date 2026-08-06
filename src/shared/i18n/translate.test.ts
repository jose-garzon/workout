import { afterEach, describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";
import { setActiveLanguage } from "./languageStore";
import { DICTIONARIES, interpolate, t } from "./translate";

/**
 * The ONLY file that asserts on dictionary contents (design §Decision 7) — and
 * even here the assertions are about the machinery (resolution, interpolation,
 * fallback, parity), not about wording, so a copy edit never breaks a test.
 * jsdom reports `en-US`, so the default language under Vitest is `en`.
 */

afterEach(() => setActiveLanguage(null));

describe("interpolate", () => {
  it("replaces a single placeholder", () => {
    expect(interpolate("Hey {name}", { name: "Ana" })).toBe("Hey Ana");
  });

  it("replaces a repeated placeholder everywhere it appears", () => {
    expect(interpolate("{n} of {n}", { n: 3 })).toBe("3 of 3");
  });

  it("replaces multiple distinct placeholders", () => {
    expect(
      interpolate("Step {current} of {total}", { current: 2, total: 4 }),
    ).toBe("Step 2 of 4");
  });

  it("leaves an unprovided placeholder in place rather than blanking it", () => {
    expect(interpolate("Hey {name}", { other: "x" })).toBe("Hey {name}");
  });

  it("coerces numbers to strings", () => {
    expect(interpolate("{n}", { n: 0 })).toBe("0");
  });
});

describe("t", () => {
  it("returns the template untouched when no vars are given", () => {
    expect(t("home.greeting")).toBe(en["home.greeting"]);
  });

  it("interpolates runtime values, leaving no {token} visible", () => {
    const greeting = t("home.greeting", { name: "Ana" });
    expect(greeting).toContain("Ana");
    expect(greeting).not.toMatch(/[{}]/);

    const indicator = t("onboarding.step.indicator", { current: 2, total: 4 });
    expect(indicator).toContain("2");
    expect(indicator).toContain("4");
    expect(indicator).not.toMatch(/[{}]/);
  });

  it("reads the Spanish dictionary once Spanish is active", () => {
    setActiveLanguage("es");
    expect(t("home.greeting")).toBe(es["home.greeting"]);
  });

  it("falls back to the English string for a key missing from Spanish", () => {
    const spanish = DICTIONARIES.es;
    const removed = spanish["home.greeting"];
    delete spanish["home.greeting"];
    try {
      setActiveLanguage("es");
      const fallback = t("home.greeting", { name: "Ana" });
      expect(fallback).toBe(interpolate(en["home.greeting"], { name: "Ana" }));
      expect(fallback).not.toBe("");
      expect(fallback).not.toBe("home.greeting");
    } finally {
      spanish["home.greeting"] = removed;
    }
  });
});

describe("dictionary parity (the runtime half of KEY_PARITY)", () => {
  it("gives es.json exactly the keys of en.json", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it("has a non-empty string for every value in both dictionaries", () => {
    for (const dictionary of [en, es]) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value, key).toBe("string");
        expect(value.trim(), key).not.toBe("");
      }
    }
  });
});
