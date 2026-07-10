"use client";

import { useTheme } from "@/shared/ui/theme/useTheme";

/**
 * The persistent light/dark toggle (design-system.md §2 "Theming"). Feature
 * screens compose this rather than calling `useTheme` themselves for the
 * common case — one shared control, one place to keep it accessible.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-micro anim-press inline-flex h-[var(--control-height-sm)] items-center gap-2 border border-border bg-transparent px-[var(--space-4)] text-text hover:bg-surface"
    >
      {isDark ? "Dark" : "Light"}
    </button>
  );
}
