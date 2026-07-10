import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "workout-pal",
  description: "Plan and follow through on your workouts.",
};

/**
 * Inline no-flash theme resolution (design.md §5, design-system.md §2
 * "Theming"). Must run synchronously in <head>, before hydration, so the
 * first paint already has the right `data-theme` attribute. Resolution:
 * a persisted choice wins; otherwise `prefers-color-scheme` — explicit
 * `light` -> light; dark / no-preference / unavailable -> dark (tie-break).
 *
 * The storage key ("wp.theme") is duplicated as a literal in
 * shared/ui/theme/themeStore.ts (THEME_STORAGE_KEY) — this script can't
 * import a TS module, so keep the two in sync by hand if it ever changes.
 */
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('wp.theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

/**
 * Root layout — the static app shell (server component).
 *
 * Preloads the two hot self-hosted faces (Barlow 400, Anton 400 — design.md
 * §5) and runs the no-flash theme script before anything else in <head>.
 * `suppressHydrationWarning` on <html> is required because the script sets
 * `data-theme` outside of React's render output (the standard pattern for
 * flash-free theme toggles).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input — the no-flash theme resolver must run inline before hydration.
          dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }}
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/assets/fonts/Barlow-Regular.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/assets/fonts/Anton-Regular.woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
