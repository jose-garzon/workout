import { create } from "zustand";

/**
 * Language store — the single source of truth for WHICH language is active
 * (profile-page design.md §D3). The theme store's twin: same shape, same
 * storage class (a device preference, not user data), same no-flash contract.
 *
 * Persistence key MUST stay `"wp.lang"` — it is duplicated (unavoidably, as a
 * literal) in the no-flash inline <script> in app/layout.tsx, which resolves
 * `<html lang>` before hydration and cannot import a TS module. Keep both in
 * sync if this ever changes.
 *
 * Resolution: a stored choice wins; otherwise the browser's preferred language
 * through `resolveLanguage`. A store rather than a React context because
 * `t()`, every pure `model.ts`, and `api/ai/client.ts` read the active language
 * OUTSIDE React and could not read a context.
 */

export type Language = "en" | "es";

export const LANGUAGE_STORAGE_KEY = "wp.lang";

/**
 * `es-*` (any casing) -> "es"; everything else, including `undefined` -> "en".
 *
 * This `es`-prefix rule is DUPLICATED as a literal in the inline <head> script
 * in `src/app/layout.tsx` — keep the two in sync by hand.
 */
export function resolveLanguage(tag: string | undefined): Language {
  return tag?.toLowerCase().startsWith("es") ? "es" : "en";
}

function storedLanguage(): Language | null {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : null;
}

/**
 * Server -> "en"; browser -> the stored choice, else browser detection. This is
 * the same answer the previous lazy resolution gave, so SSR is unchanged and an
 * install with no stored choice keeps behaving exactly as before.
 */
function initialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return storedLanguage() ?? resolveLanguage(navigator.language);
}

interface LanguageState {
  language: Language;
  /** Persists to localStorage, sets `<html lang>`, then updates the store. */
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
    set({ language });
  },
}));

/** Non-React read, for `t()` and for `api/ai/client.ts`. */
export function activeLanguage(): Language {
  return useLanguageStore.getState().language;
}

/**
 * Test-only: force the language in memory (no persistence), or `null` to
 * re-resolve from storage/browser. Never called in app code.
 */
export function setActiveLanguage(language: Language | null): void {
  useLanguageStore.setState({ language: language ?? initialLanguage() });
}
