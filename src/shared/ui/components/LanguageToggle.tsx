"use client";

import { useLanguage, useTranslation } from "@/shared/i18n";

export interface LanguageToggleProps {
  /**
   * Stretches to fill its container, mirroring `ThemeToggle`'s `fullWidth` —
   * used by the profile page's 50/50 settings row (design.md D7).
   */
  fullWidth?: boolean;
}

/**
 * The language picker (design.md D15) — `ThemeToggle`'s twin: same bordered
 * shell, same `--control-height-sm`/`-md` sizing, same `useLanguage()`
 * binding. Visible text is the ACTIVE language; activating it flips to the
 * other one.
 *
 * Deliberately not `role="switch"` (unlike `ThemeToggle`): "which of two
 * languages" isn't an on/off state, and `aria-checked` couldn't announce it
 * truthfully. Instead a plain button whose `aria-label` states the action —
 * "Switch to Spanish" / "Switch to English" — which is unambiguous to AT.
 */
export function LanguageToggle({ fullWidth = false }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const isEnglish = language === "en";

  return (
    <button
      type="button"
      aria-label={
        isEnglish
          ? t("common.language.toSpanish")
          : t("common.language.toEnglish")
      }
      onClick={() => setLanguage(isEnglish ? "es" : "en")}
      className={[
        "text-micro anim-press inline-flex items-center justify-center gap-2 border border-border bg-transparent px-[var(--space-4)] text-text hover:bg-surface",
        fullWidth
          ? "h-[var(--control-height-md)] w-full"
          : "h-[var(--control-height-sm)]",
      ].join(" ")}
    >
      {isEnglish ? t("common.language.en") : t("common.language.es")}
    </button>
  );
}
