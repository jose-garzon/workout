"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/shared/i18n";

/**
 * A plain stroke user glyph (design-system.md §2 "Iconography" — the head is
 * the one place a genuinely circular mark is appropriate; the shoulders stay
 * mitered/butt-capped to match the rest of the icon set).
 */
function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
    >
      <circle
        cx="10"
        cy="6.5"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 17c0-3.6 3.13-6 7-6s7 2.4 7 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * The header's navigation entry to `/profile` (design.md D6) — replaces the
 * theme toggle that used to live in `AppShell`'s header. Feature-agnostic
 * chrome: it targets a URL string, never an import of `profile-goals`, so it
 * carries no new firewall edge.
 *
 * Bordered (design.md D13) — the same `border-border`/`bg-transparent`/
 * `hover:bg-surface` recipe as `Button variant="secondary"`, so it reads as a
 * real control rather than decoration. Hides itself on its own destination
 * (design.md D14): no navigating to the page you're already on.
 */
export function ProfileLink() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname === "/profile" || pathname?.startsWith("/profile/")) {
    return null;
  }

  return (
    <Link
      href="/profile"
      aria-label={t("common.profile.open")}
      className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center border border-border bg-transparent text-text hover:bg-surface"
    >
      <UserIcon />
    </Link>
  );
}
