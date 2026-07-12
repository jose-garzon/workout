"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { YearGridDay } from "../types";
import { YearGrid } from "./YearGrid";

/**
 * The tap-to-open year overview (design.md §6, proposal AC2.1–2.6). Backdrop
 * + panel, with three dismiss paths (backdrop tap, close control, Esc) and
 * an animated enter/exit.
 *
 * **Mobile drawer vs. desktop modal (fixes brief, item 2):** below `sm` the
 * panel is a true full-screen surface (`inset-0`, no backdrop gap, no
 * border) that SLIDES IN FROM THE RIGHT (`.anim-slide` / `.anim-slide-exit`)
 * — a drawer, not a dialog rising into place; the year grid also needs every
 * pixel of the viewport to stay scroll-free (see `YearGrid`). From `sm` up
 * there's room to spare, so it reverts to a centered, bounded modal
 * (max-width 520px, hairline border, backdrop margin) that RISES into place
 * (`.anim-rise` / `.anim-rise-exit`), matching the rest of the app's dialog
 * shape (e.g. `RoutineHomeScreen`'s `awaitingReplace` modal). Which pair of
 * classes applies is decided once per open/close transition by
 * `isDesktopViewport()` — a plain `matchMedia` read against the design
 * system's `sm` breakpoint (480px, `--breakpoint-sm`), the same pattern as
 * `prefersReducedMotion()` below. (Tailwind's `sm:` variant can't be used
 * directly on these classes: they're plain selectors in `globals.css`, not
 * utilities registered with Tailwind's `@utility`, so it never generates a
 * `sm:anim-rise` rule for them — the JS check is the reliable equivalent.)
 * At any viewport the e2e's required entrance-class hook still lands: at
 * `sm` and up the dialog carries literal `anim-rise`, matching the
 * `/anim-(rise|fade)/` regex.
 *
 * **Mount lifecycle — why `open` isn't just "render or don't":** AC2.5 needs
 * a real exit animation, which means the dialog must stay mounted for one
 * more frame after `onClose` fires so the exit class can play, then unmount
 * itself on `onAnimationEnd` — never synchronously. `mounted` tracks "is
 * this in the DOM at all" (flips true the instant `open` does, flips false
 * only once the exit animation reports it finished); `closing` picks which
 * animation class the panel wears. Under `prefers-reduced-motion` the CSS
 * drops both exit presets to `animation: none`, which never fires
 * `animationend` — so reduced motion is also checked in JS to skip the wait
 * and unmount immediately instead of hanging open forever.
 */
export interface ActivityDrawerProps {
  open: boolean;
  yearGrid: YearGridDay[];
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** design-system.md §3.7 / `--breakpoint-sm` — desktop-modal cutoff. */
function isDesktopViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 480px)").matches
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
    >
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function ActivityDrawer({
  open,
  yearGrid,
  onClose,
}: ActivityDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      if (prefersReducedMotion()) {
        setMounted(false);
      } else {
        setClosing(true);
      }
    }
  }, [open, mounted]);

  // Move focus into the dialog the moment it actually mounts.
  useEffect(() => {
    if (mounted && !closing) {
      closeButtonRef.current?.focus();
    }
  }, [mounted, closing]);

  // Esc dismisses; Tab is trapped on the one focusable descendant (the close
  // button — the year grid is intentionally non-interactive, Key decision 4,
  // so there is nothing else to cycle through).
  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  const year = new Date().getFullYear();

  // A click only dismisses when the scrim itself was hit, not a bubbled
  // click from the panel — avoids needing `stopPropagation` on the panel
  // (which would itself trip the same "click needs a key equivalent" a11y
  // lint for no real interactive purpose).
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  const desktop = isDesktopViewport();
  const animClass = closing
    ? desktop
      ? "anim-rise-exit"
      : "anim-slide-exit"
    : desktop
      ? "anim-rise"
      : "anim-slide";

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: decorative dismiss-on-tap scrim, not a focusable control — keyboard users already have two equivalent dismiss paths (Esc, the close button below), so this element itself needs no key handler.
    // biome-ignore lint/a11y/noStaticElementInteractions: same scrim — click-to-dismiss is pointer-only by design; making it a real interactive/focusable element would add a confusing extra Tab stop in front of the close button for a full-screen no-op-until-clicked region.
    <div
      data-testid="drawer-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[var(--z-modal)] flex justify-center bg-[rgba(0,0,0,0.6)] sm:items-center sm:p-[var(--space-5)]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-drawer-title"
        aria-describedby="activity-drawer-description"
        onAnimationEnd={() => {
          if (closing) {
            setMounted(false);
            setClosing(false);
          }
        }}
        className={`${animClass} flex h-dvh w-full flex-col gap-[var(--space-5)] bg-elevated-surface p-[var(--space-6)] sm:h-auto sm:max-h-[85dvh] sm:w-[min(92vw,860px)] sm:max-w-none sm:border sm:border-border`}
      >
        <div className="flex shrink-0 items-center justify-between gap-[var(--space-4)]">
          <h2 id="activity-drawer-title" className="text-title-2">
            Activity tracker
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close activity tracker"
            className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>
        <p
          id="activity-drawer-description"
          className="shrink-0 text-caption text-text-muted"
        >
          Every filled square is a day you trained in {year}.
        </p>
        <div className="min-h-0 flex-1">
          <YearGrid days={yearGrid} />
        </div>
      </div>
    </div>
  );
}
