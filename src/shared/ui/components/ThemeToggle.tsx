"use client";

import { useTranslation } from "@/shared/i18n";
import { useTheme } from "@/shared/ui/theme/useTheme";

export interface ThemeToggleProps {
  /**
   * Stretches to fill its container, mirroring `Button`'s `fullWidth` — used
   * by the profile page's 50/50 settings row (design.md D7), which sits it
   * beside `LanguageToggle` at the same `--control-height-md`. Behaviour is
   * unchanged either way.
   */
  fullWidth?: boolean;
}

/**
 * The persistent light/dark toggle (design-system.md §2 "Theming"). Feature
 * screens compose this rather than calling `useTheme` themselves for the
 * common case — one shared control, one place to keep it accessible.
 */
export function ThemeToggle({ fullWidth = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t("common.theme.toLight") : t("common.theme.toDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "text-micro anim-press inline-flex items-center justify-center gap-2 border border-border bg-transparent px-[var(--space-4)] text-text hover:bg-surface",
        fullWidth
          ? "h-[var(--control-height-md)] w-full"
          : "h-[var(--control-height-sm)]",
      ].join(" ")}
    >
      {isDark ? t("common.theme.dark") : t("common.theme.light")}
    </button>
  );
}
