"use client";

import type { ReactNode } from "react";
import { Logo } from "@/shared/ui/components/Logo";
import { ThemeToggle } from "@/shared/ui/components/ThemeToggle";

/**
 * The shared screen frame every feature's top-level screen renders inside:
 * single column, max-width 560px even on wider viewports (design-system.md
 * §2 "Layout & spacing rhythm" — workout mode never stretches into a wide
 * dashboard, and every other screen follows the same restraint), screen
 * padding 20px on phone / 32px from `sm` up, safe-area insets for notched
 * devices, and the persistent theme toggle in the header.
 *
 * The header shows only the `Logo` mark (left) and the theme toggle
 * (right) — nothing else is visible there. The screen's `title` still
 * renders as a real `<h1>`, it's just visually hidden (`sr-only`): it
 * remains the page's one accessible name for screen-reader/AT users and
 * the document outline, unchanged for every existing/future caller of
 * `title`, even though `Logo` itself is decorative/`aria-hidden` (Logo.tsx)
 * and can't carry that role. Screens whose title doubles as meaningful
 * on-page content (e.g. the onboarding form's step heading) are
 * responsible for also rendering their own *visible* heading in the body —
 * see `OnboardingForm.tsx`.
 */
export interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background pl-[max(env(safe-area-inset-left),var(--space-5))] pr-[max(env(safe-area-inset-right),var(--space-5))] sm:pl-[max(env(safe-area-inset-left),var(--space-7))] sm:pr-[max(env(safe-area-inset-right),var(--space-7))]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), var(--space-6))",
        paddingBottom: "max(env(safe-area-inset-bottom), var(--space-6))",
      }}
    >
      <header className="flex items-center justify-between gap-[var(--space-4)] pb-[var(--space-6)]">
        <Logo size="sm" />
        <h1 className="sr-only">{title}</h1>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col gap-[var(--space-6)]">
        {children}
      </main>
    </div>
  );
}
