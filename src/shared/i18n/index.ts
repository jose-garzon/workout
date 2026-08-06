/**
 * The public surface of the i18n slice (design §Decision 3). Nothing outside
 * `shared/i18n` imports the inner files.
 */

export {
  activeLanguage,
  LANGUAGE_STORAGE_KEY,
  type Language,
  resolveLanguage,
  setActiveLanguage,
} from "./languageStore";
export { type TranslationKey, t } from "./translate";
export { useLanguage, useTranslation } from "./useTranslation";
