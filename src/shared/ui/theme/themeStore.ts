import { create } from "zustand";

/**
 * Theme store — the persistence + DOM-flip half of the theme system.
 *
 * Persistence key MUST stay `"wp.theme"` — it is duplicated (unavoidably, as
 * a literal) in the no-flash inline <script> in app/layout.tsx, which has to
 * run before any JS module loads. Keep both in sync if this ever changes.
 *
 * Resolution algorithm (design-system.md §2 "Theming"): a persisted choice
 * wins; otherwise `prefers-color-scheme` — explicit `light` -> light;
 * dark / no-preference / unavailable -> dark (the tie-breaking default).
 * The inline script performs this same resolution synchronously before
 * first paint so there is no flash; this store's initial in-memory value
 * ("dark") only matters for the brief window before `useTheme`'s mount
 * effect reads back what the script already applied to the DOM.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "wp.theme";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Internal: sync the store to whatever the no-flash script already
   * applied to the DOM. Not part of the public `useTheme` contract. */
  hydrate: (theme: Theme) => void;
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyThemeToDocument(theme);
    }
    set({ theme });
  },
  hydrate: (theme) => set({ theme }),
}));
