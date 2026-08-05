"use client";

import { activeLanguage, type Language, t } from "./translate";

/**
 * THE UI seam (design §Decision 3): React components call this, pure modules
 * import `t` directly. `t` is a module-level function, so it is referentially
 * stable forever and safe in dependency arrays; `language` is fixed for the
 * page's lifetime, so there is nothing to subscribe to and no provider to mount.
 */
export function useTranslation(): { t: typeof t; language: Language } {
  return { t, language: activeLanguage() };
}
