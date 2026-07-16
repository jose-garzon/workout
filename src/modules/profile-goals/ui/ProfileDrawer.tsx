"use client";

import type { MouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import { ChoiceGroup } from "@/shared/ui/primitives/ChoiceGroup";
import { Input } from "@/shared/ui/primitives/Input";
import type { FieldName, OnboardingField } from "../logic/useOnboarding";
import { useProfileEditor } from "../logic/useProfileEditor";
import type { Goals, Profile } from "../types";

export interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  goals: Goals | null;
}

/** Fields long enough (or multi-row enough) to want the full panel width. */
const FULL_WIDTH: ReadonlySet<FieldName> = new Set([
  "displayName",
  "gender",
  "focus",
  "daysPerWeek",
]);

/** Net horizontal drag past which swipe-right commits to a close (design.md D3). */
const SWIPE_CLOSE_THRESHOLD = 80;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Every clause excludes tabindex="-1" so the trap's first/last exactly match
// what native Tab would actually reach — important for the roving-tabindex
// radios inside `ChoiceGroup`, which give every non-selected option an
// explicit tabindex="-1".
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]",
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(", ");

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

/**
 * Renders one field via the OnboardingForm field→atom mapping (design.md
 * D3), with a single deliberate deviation: `daysPerWeek` uses `ChoiceGroup`'s
 * two-column `"grid"` layout instead of onboarding's `CountStepper`, per
 * D3's explicit "two-column row" call — same 1–7 options, no model change.
 */
function Field({
  field,
  onChange,
}: {
  field: OnboardingField;
  onChange: (value: string) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <Input
          label={field.label}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          label={field.label}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          placeholder={field.placeholder}
          suffix={field.suffix}
        />
      );
    case "choice": {
      const options = field.options ?? [];
      if (field.name === "daysPerWeek") {
        return (
          <ChoiceGroup
            label={field.label}
            options={options}
            value={field.value}
            onChange={onChange}
            required={field.required}
            error={field.error}
            layout="grid"
          />
        );
      }
      return (
        <ChoiceGroup
          label={field.label}
          options={options}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          layout={options.length <= 2 ? "segmented" : "stack"}
        />
      );
    }
    default:
      return null;
  }
}

/**
 * Post-onboarding edit surface (design.md D3, D6) — a right-slide drawer on
 * BOTH viewports (unlike `ActivityDrawer`, which flips to a centered modal at
 * `sm+`), holding all 8 onboarding fields at once. Mount lifecycle mirrors
 * `ActivityDrawer`: stay mounted through the exit animation, unmount on
 * `animationend`, skip the wait under
 * `prefers-reduced-motion`.
 *
 * Owns its seam call internally (`useProfileEditor(profile, goals)`) — the
 * hook itself is always "mounted" (called unconditionally, before the
 * `!mounted` early return), so its draft survives a close/reopen cycle; the
 * `false→true` open transition below calls `reset()` so a reopened drawer
 * always shows the last SAVED values, discarding any prior unsaved edits
 * (design.md D1).
 *
 * Focus handling doesn't take a trigger ref as a prop — the drawer's props
 * are fixed to `{ open, onClose, profile, goals }` (design.md D3) — instead
 * it captures `document.activeElement` at the moment it mounts (the trigger
 * the user just activated) and restores focus there on every discard path.
 */
export function ProfileDrawer({
  open,
  onClose,
  profile,
  goals,
}: ProfileDrawerProps) {
  const editor = useProfileEditor(profile, goals);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragHorizontalRef = useRef(false);

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

  // Re-seed the draft from the saved records on every false→true transition
  // (design.md D1) — a reopened drawer never shows a discarded edit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: editor.reset is re-created every render (not memoized) but is stable in intent; re-subscribing is harmless and the guard below keeps it a no-op except on the real open transition.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      editor.reset();
    }
    wasOpenRef.current = open;
  }, [open]);

  // Capture the trigger and move focus into the panel the moment it mounts.
  useEffect(() => {
    if (mounted && !closing) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      closeButtonRef.current?.focus();
    }
  }, [mounted, closing]);

  // Body scroll-lock for the whole time the panel is in the DOM, including
  // the exit animation (design.md §4.3).
  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  const dismiss = useCallback(() => {
    onClose();
    triggerRef.current?.focus();
  }, [onClose]);

  // Esc dismisses; Tab is trapped inside the panel's focusable descendants.
  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mounted, dismiss]);

  if (!mounted) {
    return null;
  }

  const animClass = closing ? "anim-slide-exit" : "anim-slide";

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      dismiss();
    }
  }

  async function handleSave() {
    if (editor.phase === "saving") return;
    const saved = await editor.save();
    if (saved) {
      dismiss();
      return;
    }
    // All 8 fields sit in one long scrollable panel (design.md D3) — a
    // blocked Save can surface an error well above or below the current
    // scroll position. Wait a frame for React to commit the freshly
    // surfaced field errors, then bring the first one into view and focus
    // it, so "invalid" is never just an off-screen detail.
    requestAnimationFrame(() => {
      const errorText =
        panelRef.current?.querySelector<HTMLElement>('[role="alert"]');
      const fieldWrapper = errorText?.parentElement;
      const focusable = fieldWrapper?.querySelector<HTMLElement>(
        'input, [role="radio"][tabindex="0"]',
      );
      focusable?.focus();
      // jsdom (unit tests) has no `scrollIntoView` implementation at all.
      (fieldWrapper ?? errorText)?.scrollIntoView?.({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }

  function onTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    dragHorizontalRef.current = false;
    setDragging(true);
  }

  function onTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
      dragHorizontalRef.current = true;
      setDragX(dx);
    }
  }

  function onTouchEnd() {
    setDragging(false);
    const dx = dragX;
    setDragX(0);
    dragStartRef.current = null;
    if (dragHorizontalRef.current && dx > SWIPE_CLOSE_THRESHOLD) {
      dismiss();
    }
    dragHorizontalRef.current = false;
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: decorative dismiss-on-tap scrim, not a focusable control — keyboard users already have two equivalent dismiss paths (Esc, the close button below).
    // biome-ignore lint/a11y/noStaticElementInteractions: same scrim — click-to-dismiss is pointer-only by design.
    <div
      data-testid="profile-drawer-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[var(--z-overlay)] flex justify-end bg-[rgba(0,0,0,0.6)]"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        onAnimationEnd={() => {
          if (closing) {
            setMounted(false);
            setClosing(false);
          }
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragX > 0 ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : undefined,
        }}
        className={`${animClass} z-[var(--z-modal)] flex h-dvh w-full flex-col gap-[var(--space-7)] overflow-y-auto bg-elevated-surface p-[var(--space-6)] shadow-[var(--elevation-2)] sm:w-[420px] sm:border-l sm:border-border`}
      >
        <div className="flex shrink-0 items-center justify-between gap-[var(--space-4)]">
          <h2 id="profile-drawer-title" className="text-title-1">
            Edit your data
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-6)]">
          {editor.fields.map((field) => (
            <div
              key={field.name}
              className={FULL_WIDTH.has(field.name) ? "col-span-2" : ""}
            >
              <Field
                field={field}
                onChange={(value) => editor.setField(field.name, value)}
              />
            </div>
          ))}
        </div>

        {editor.phase === "error" && editor.saveError && (
          <p role="alert" className="text-caption text-danger-text">
            Couldn't save your details. Tap Save to try again.
          </p>
        )}

        <div className="flex flex-1 flex-col justify-end gap-[var(--space-5)]">
          <Button size="lg" fullWidth onClick={() => void handleSave()}>
            {editor.phase === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
