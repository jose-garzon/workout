/**
 * The i18n substrate (i18n-spanish-support design.md §Decision 1/2/4): two
 * bundled dictionaries, one memoised language resolution, one pure `t`. No
 * library, no context, no storage, no fetch — `en.json`/`es.json` are imported,
 * so they ship in the bundle and language is derived from the browser and
 * stored nowhere (local-first).
 *
 * A dependency LEAF: it imports nothing from the app, so `ui/`, `logic/` and
 * `api/` may all import it. React components use `useTranslation()`; pure
 * modules import `t` directly (design §Decision 3). Everything outside this
 * folder imports from `@/shared/i18n`, never from this file.
 */

import en from "./en.json";
import es from "./es.json";

export type Language = "en" | "es";

/** Every key of the reference dictionary — `t("typo.key")` is a tsc error. */
export type TranslationKey = keyof typeof en;

type KeyParity<A, B> = [Exclude<keyof A, keyof B>] extends [never]
  ? [Exclude<keyof B, keyof A>] extends [never]
    ? true
    : { "es.json has keys en.json does not": Exclude<keyof B, keyof A> }
  : { "es.json is missing keys": Exclude<keyof A, keyof B> };

/**
 * Compile-time proof that `es.json` has EXACTLY the keys of `en.json`. Adding a
 * key to one dictionary and not the other fails `bun run typecheck` (which the
 * pre-commit hook runs), naming the offending keys.
 */
export const KEY_PARITY: KeyParity<typeof en, typeof es> = true;

/**
 * INTERNAL — exported for `translate.test.ts` only, never on the barrel, so the
 * English-fallback path can be exercised with a key removed from `es`. Typed
 * `Partial` because that fallback is the point: a dictionary may be short a key
 * at runtime even though `KEY_PARITY` says otherwise at compile time.
 */
export const DICTIONARIES: Record<
  Language,
  Partial<Record<TranslationKey, string>>
> = { en, es };

let active: Language | null = null;

/**
 * `es-*` (any casing) -> "es"; everything else, including `undefined` -> "en".
 *
 * This `es`-prefix rule is DUPLICATED as a literal in the inline <head> script
 * in `src/app/layout.tsx`, which sets `<html lang>` before hydration and cannot
 * import a TS module — keep the two in sync by hand (the same accepted trade as
 * the "wp.theme" storage key).
 */
export function resolveLanguage(tag: string | undefined): Language {
  return tag?.toLowerCase().startsWith("es") ? "es" : "en";
}

/**
 * The page's language, resolved once from `navigator.language` and memoised for
 * the page's lifetime. Lazy: the first `t()` call always happens in the browser
 * (every translated string lives behind an `ssr:false` boundary), so there is no
 * boot step and no "not ready yet" state.
 */
export function activeLanguage(): Language {
  if (active === null) {
    active = resolveLanguage(
      typeof navigator === "undefined" ? undefined : navigator.language,
    );
  }
  return active;
}

/** Test-only: force the language, or `null` to re-resolve. Never called in app code. */
export function setActiveLanguage(language: Language | null): void {
  active = language;
}

/**
 * Replace every `{token}` with its value. An UNPROVIDED token is left in place
 * rather than blanked — a caller bug should be visible, not invisible.
 * INTERNAL: exported for `translate.test.ts`, not on the barrel.
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    name in vars ? String(vars[name]) : token,
  );
}

/**
 * Look up `key` in the active language, falling back to English and then to the
 * raw key (the last step is unreachable while `KEY_PARITY` compiles; it exists
 * so a hand-edited dictionary degrades to something diagnosable rather than
 * leaking `undefined` into the UI).
 */
export function t(
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[activeLanguage()][key] ?? en[key] ?? key;
  return vars === undefined ? template : interpolate(template, vars);
}
