/**
 * The public surface of the i18n slice (design §Decision 3). Nothing outside
 * `shared/i18n` imports the inner files.
 */

export {
  activeLanguage,
  type Language,
  resolveLanguage,
  setActiveLanguage,
  type TranslationKey,
  t,
} from "./translate";
export { useTranslation } from "./useTranslation";
