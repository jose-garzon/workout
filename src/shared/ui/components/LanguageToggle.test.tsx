import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LANGUAGE_STORAGE_KEY, setActiveLanguage } from "@/shared/i18n";
import { LanguageToggle } from "./LanguageToggle";

/**
 * `LanguageToggle` (tasks.md 9.7, design.md D15) against the real language
 * store (the `useTranslation.test.tsx` convention) — shows the active
 * language, one activation flips it and switches rendered copy, and the
 * accessible name states the target language.
 */

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  setActiveLanguage(null);
});

describe("LanguageToggle", () => {
  it("shows the language currently in effect", () => {
    setActiveLanguage("en");
    render(<LanguageToggle />);
    expect(
      screen.getByRole("button", { name: "Switch to Spanish" }),
    ).toHaveTextContent("English");
  });

  it("activating it flips the language and switches rendered copy, with no reload", () => {
    setActiveLanguage("en");
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to Spanish" }));

    // The whole UI is now Spanish, including this control's own label.
    expect(
      screen.getByRole("button", { name: "Cambiar a inglés" }),
    ).toHaveTextContent("Español");
  });

  it('has no role="switch" (deliberate deviation from ThemeToggle, design.md D15)', () => {
    render(<LanguageToggle />);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
