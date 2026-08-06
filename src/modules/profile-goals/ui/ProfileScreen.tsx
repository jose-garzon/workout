"use client";

import Link from "next/link";
import { useTranslation } from "@/shared/i18n";
import { BackLink } from "@/shared/ui/components/BackLink";
import { GoalBadge } from "@/shared/ui/components/GoalBadge";
import { LanguageToggle } from "@/shared/ui/components/LanguageToggle";
import { ThemeToggle } from "@/shared/ui/components/ThemeToggle";
import { AppShell } from "@/shared/ui/layout/AppShell";

export interface ProfileScreenProps {
  displayName?: string;
  /** The user's training focus, for the goal badge (design.md D12). */
  focus?: string;
}

/**
 * A plain stroke chevron (design-system.md §2 "Iconography" — matches
 * `RoutineSummary`'s day-row chevron; replicated locally rather than
 * imported because `profile-goals/ui` may not import `routine-generation/ui`
 * (firewall rule 1, design.md D16)).
 */
function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      className="shrink-0 text-text-muted transition-colors group-hover:text-text"
    >
      <path
        d="M7.5 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * The edit-profile entry (design.md D16) — a local, non-exported card
 * replicating `RoutineSummary`'s day-row recipe (bordered, not accent-filled,
 * so the page keeps its one full-saturation accent budget for the goal
 * badge). Drops the day row's index numeral and caption line — there is no
 * second line to show for a single settings entry.
 */
function SectionCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="anim-press group flex min-h-[var(--control-height-lg)] items-center gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)] transition-colors hover:border-text hover:bg-elevated-surface"
    >
      <span className="text-body-strong flex-1 text-text">{label}</span>
      <ChevronIcon />
    </Link>
  );
}

/**
 * `/profile` (design.md D1, D6, D7, D11–D17) — the app's one
 * personal-settings home. Title row leads with a small eyebrow (the page's
 * real accessible heading), then the user's name as the page's hero content,
 * the goal badge, and an entry card to the edit form — all top-aligned. The
 * theme + language row stays pinned to the bottom.
 *
 * The name is deliberately a `<p>`, not a heading (D11): it is the most
 * prominent text on the page but it is content, not structure — the `<h2>`
 * above it stays the page's correct outline entry. `text-display`, not
 * `text-display-brand`: the brand face is uppercase Anton, which would
 * render "Jose" as "JOSE".
 */
export function ProfileScreen({ displayName, focus }: ProfileScreenProps) {
  const { t } = useTranslation();
  const name = displayName?.trim() || t("home.greeting.fallbackName");

  return (
    <AppShell title={t("profile.title")}>
      <div className="flex items-center gap-[var(--space-4)]">
        <BackLink href="/" />
        <h2 className="text-micro text-text-muted">{t("profile.title")}</h2>
      </div>

      <div className="flex flex-1 flex-col gap-[var(--space-7)]">
        <div className="flex  flex-col gap-[var(--space-3)]">
          <h2 className="text-title-1">{name}</h2>
          <GoalBadge focus={focus ?? "general"} />
        </div>
        <ul className="flex flex-col gap-[var(--space-3)]">
          <li>
            <SectionCard href="/profile/edit" label={t("profile.edit.cta")} />
          </li>
        </ul>
      </div>

      <div className="flex gap-[var(--control-gap-min)]">
        <div className="flex-1">
          <ThemeToggle fullWidth />
        </div>
        <div className="flex-1">
          <LanguageToggle fullWidth />
        </div>
      </div>
    </AppShell>
  );
}
