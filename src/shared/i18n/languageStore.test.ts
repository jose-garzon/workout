import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  setActiveLanguage,
  useLanguageStore,
} from "./languageStore";

/**
 * The language store (profile-page design.md §D3): a stored choice beats browser
 * detection, and `setLanguage` has exactly three effects — localStorage,
 * `<html lang>`, store state.
 *
 * Resolution is exercised through `setActiveLanguage(null)`, which re-runs the
 * same code path the store's initial value uses; the store itself is a module
 * singleton and cannot be re-created per test.
 */

/** Pretend the browser prefers `tag` for the duration of one test. */
function browserLanguage(tag: string) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(tag);
}

afterEach(() => {
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  vi.restoreAllMocks();
  setActiveLanguage(null);
});

describe("resolveLanguage", () => {
  it("selects Spanish for any es-* tag, whatever the casing", () => {
    expect(resolveLanguage("es-ES")).toBe("es");
    expect(resolveLanguage("es")).toBe("es");
    expect(resolveLanguage("ES-es")).toBe("es");
    expect(resolveLanguage("es-419")).toBe("es");
  });

  it("falls back to English for other, unsupported, or missing tags", () => {
    expect(resolveLanguage("en-US")).toBe("en");
    expect(resolveLanguage("fr-FR")).toBe("en");
    expect(resolveLanguage("")).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
  });
});

describe("initial resolution", () => {
  it("prefers a stored choice over the browser language", () => {
    browserLanguage("en-US");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
    setActiveLanguage(null);
    expect(activeLanguage()).toBe("es");

    browserLanguage("es-ES");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    setActiveLanguage(null);
    expect(activeLanguage()).toBe("en");
  });

  it("falls back to the browser language when nothing is stored", () => {
    browserLanguage("es-419");
    setActiveLanguage(null);
    expect(activeLanguage()).toBe("es");

    browserLanguage("fr-FR");
    setActiveLanguage(null);
    expect(activeLanguage()).toBe("en");
  });

  it("ignores a stored value that is not a supported language", () => {
    browserLanguage("es-ES");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    setActiveLanguage(null);
    expect(activeLanguage()).toBe("es");
  });
});

describe("setLanguage", () => {
  it("persists the choice, sets <html lang>, and updates the store", () => {
    useLanguageStore.getState().setLanguage("es");

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(activeLanguage()).toBe("es");

    useLanguageStore.getState().setLanguage("en");

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(activeLanguage()).toBe("en");
  });
});

describe("setActiveLanguage (test-only)", () => {
  it("forces the value in memory without persisting it", () => {
    setActiveLanguage("es");
    expect(activeLanguage()).toBe("es");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});
