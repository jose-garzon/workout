"use client";

import Link from "next/link";
import { useTranslation } from "@/shared/i18n";

/**
 * A plain stroke chevron pointing left (design-system.md §2 "Iconography" —
 * mitered/butt-capped to match `RoutineSummary`'s chevron, just mirrored).
 */
function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
    >
      <path
        d="M12.5 4l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export interface BackLinkProps {
  href: string;
}

/**
 * Leads the title row on both new profile pages (design.md D9) — a `next/link`
 * so it's a real navigation, not a JS `router.back()` (deterministic even when
 * the page is deep-linked). One generic "Back" label rather than a
 * per-destination one: the destination is obvious from where you are.
 *
 * Bordered (design.md D13) — the same `Button variant="secondary"` recipe as
 * `ProfileLink`, so it reads as a visible affordance rather than decoration.
 */
export function BackLink({ href }: BackLinkProps) {
  const { t } = useTranslation();

  return (
    <Link
      href={href}
      aria-label={t("common.back")}
      className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center border border-border bg-transparent text-text hover:bg-surface"
    >
      <ChevronLeftIcon />
    </Link>
  );
}
