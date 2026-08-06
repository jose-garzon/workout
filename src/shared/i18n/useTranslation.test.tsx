import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";
import { LANGUAGE_STORAGE_KEY, setActiveLanguage } from "./languageStore";
import { useLanguage, useTranslation } from "./useTranslation";

/**
 * The re-render path (profile-page design.md §D4): `useTranslation` subscribes
 * to the language store, so choosing a language flips every component that
 * renders copy — with no reload. Asserted on values read from the dictionaries
 * rather than on wording, so a copy edit never breaks this test.
 */

afterEach(() => {
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  setActiveLanguage(null);
});

function Copy() {
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();
  return (
    <button type="button" lang={language} onClick={() => setLanguage("es")}>
      {t("common.theme.dark")}
    </button>
  );
}

it("re-renders translated copy in the new language, with no reload", async () => {
  render(<Copy />);

  const button = screen.getByRole("button");
  expect(button).toHaveTextContent(en["common.theme.dark"]);
  expect(button).toHaveAttribute("lang", "en");

  await act(async () => {
    button.click();
  });

  expect(button).toHaveTextContent(es["common.theme.dark"]);
  expect(button).toHaveAttribute("lang", "es");
});
