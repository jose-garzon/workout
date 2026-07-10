"use client";

import { useEffect } from "react";
import { type Theme, useThemeStore } from "./themeStore";

/**
 * The app-wide theme seam (design.md §4 — signature is load-bearing, shared
 * by every feature's `ui/` via the `shared/ui` allowance in firewall rule 1).
 *
 *   function useTheme(): { theme: Theme; setTheme: (t: Theme) => void }
 */
export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const hydrate = useThemeStore((state) => state.hydrate);

  // The no-flash inline script (app/layout.tsx <head>) already resolved and
  // applied the real theme to `document.documentElement.dataset.theme`
  // before hydration. Read it back once on mount so this store's state
  // matches the pixels already on screen instead of racing/overwriting them.
  useEffect(() => {
    const applied = document.documentElement.dataset.theme;
    if (applied === "light" || applied === "dark") {
      hydrate(applied);
    }
  }, [hydrate]);

  return { theme, setTheme };
}

export type { Theme };
