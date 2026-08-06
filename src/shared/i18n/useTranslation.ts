"use client";

import { type Language, useLanguageStore } from "./languageStore";
import { t } from "./translate";

/**
 * THE UI seam (design §Decision 3): React components call this, pure modules
 * import `t` directly. `t` is a module-level function, so it is referentially
 * stable forever and safe in dependency arrays.
 *
 * It SUBSCRIBES to the language store (profile-page §D4), so a `setLanguage`
 * re-renders every component that renders copy — no reload, no provider.
 * Standing rule that follows from `t`'s stable identity: any `useMemo` whose
 * output CONTAINS a translated string must take `language` as a dependency.
 */
export function useTranslation(): { t: typeof t; language: Language } {
  const language = useLanguageStore((state) => state.language);
  return { t, language };
}

/**
 * The language-choice seam (profile-page §D4) — the theme system's `useTheme`
 * twin, for the one control that lets the user pick.
 */
export function useLanguage(): {
  language: Language;
  setLanguage: (language: Language) => void;
} {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return { language, setLanguage };
}
