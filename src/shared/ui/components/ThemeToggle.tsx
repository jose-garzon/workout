"use client";

import { useTranslation } from "@/shared/i18n";
import { useTheme } from "@/shared/ui/theme/useTheme";

/**
 * The persistent light/dark toggle (design-system.md §2 "Theming"). Feature
 * screens compose this rather than calling `useTheme` themselves for the
 * common case — one shared control, one place to keep it accessible.
 */
export function ThemeToggle() {
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
      className="text-micro anim-press inline-flex h-[var(--control-height-sm)] items-center gap-2 border border-border bg-transparent px-[var(--space-4)] text-text hover:bg-surface"
    >
      {isDark ? t("common.theme.dark") : t("common.theme.light")}
    </button>
  );
}
