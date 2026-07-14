"use client";

import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRoutineEdit } from "@/modules/routine-generation";
import { Button } from "@/shared/ui/primitives/Button";
import { EditIndicator } from "./EditIndicator";

/**
 * The floating, bottom-docked edit surface (edit-routine design.md §F). Rises
 * from the bottom on open, lowers on close, docked in the same slot the old
 * build `Composer` used. Unlike the removed "Replace your routine?" scrim,
 * this is NOT a modal: no backdrop, no `aria-modal`, no focus trap — the
 * routine behind it stays visible, stationary, and fully interactive
 * (`role="region"`, a labelled complementary group). Mount lifecycle mirrors
 * `calendar/ui/ActivityDrawer.tsx`: stay mounted through the exit animation,
 * unmount on `animationend`, unmount immediately under reduced motion. The
 * field/submit guard reuses `Composer`'s `canSubmit` recipe.
 *
 * Editor visibility (`open`) is owned by `RoutineHomeScreen` (design.md §E —
 * it's local UI state, not part of the `useRoutineEdit` seam). This
 * component owns the seam call itself: submit the instruction, lock the
 * field while in flight, and on success tell the parent to close + return
 * `useRoutineEdit`'s status to idle.
 */
export interface RoutineEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus returns here on close — the button lives in `RoutineSummary`, not here. */
  editButtonRef: RefObject<HTMLButtonElement | null>;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
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

export function RoutineEditor({
  open,
  onOpenChange,
  editButtonRef,
}: RoutineEditorProps) {
  const { status, errorMessage, submit, reset } = useRoutineEdit();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === "editing";
  const canSubmit = text.trim() !== "" && !busy;

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

  // Move focus into the field the moment it actually mounts.
  useEffect(() => {
    if (mounted && !closing) {
      textareaRef.current?.focus();
    }
  }, [mounted, closing]);

  function dismiss() {
    onOpenChange(false);
    editButtonRef.current?.focus();
    reset();
  }

  // Esc dismisses (design.md §F) — no focus trap, no Tab interception: the
  // routine behind stays in the normal tab order.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dismiss closes over onOpenChange/editButtonRef/reset, all stable per render intent; re-subscribing each render is harmless.
  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mounted]);

  // On success (design.md §E): close first — playing the exit animation via
  // the mount lifecycle above — then return the seam to idle and clear the
  // field for next time.
  useEffect(() => {
    if (status !== "success") return;
    onOpenChange(false);
    editButtonRef.current?.focus();
    reset();
    setText("");
  }, [status, onOpenChange, editButtonRef, reset]);

  if (!mounted) {
    return null;
  }

  const animClass = closing ? "anim-rise-exit" : "anim-rise";

  function handleSubmit() {
    if (!canSubmit) return;
    void submit(text.trim());
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex justify-center pb-[max(env(safe-area-inset-bottom),var(--space-6))] pl-[max(env(safe-area-inset-left),var(--space-5))] pr-[max(env(safe-area-inset-right),var(--space-5))] sm:pl-[max(env(safe-area-inset-left),var(--space-7))] sm:pr-[max(env(safe-area-inset-right),var(--space-7))]">
      <section
        aria-labelledby="routine-editor-heading"
        onAnimationEnd={() => {
          if (closing) {
            setMounted(false);
            setClosing(false);
          }
        }}
        className={`${animClass} flex w-full max-w-[560px] flex-col gap-[var(--space-4)] border border-border bg-elevated-surface p-[var(--space-5)] shadow-[var(--elevation-2)]`}
      >
        <div className="flex items-center justify-between gap-[var(--space-4)]">
          <h3 id="routine-editor-heading" className="text-title-3">
            Edit your routine
          </h3>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close editor"
            className="anim-press flex h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          aria-label="Improve your routine"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={2}
          placeholder="e.g. swap dumbbells for machines on leg day…"
          style={{ boxShadow: "none" }}
          className="text-body min-h-[calc(var(--space-6)*2)] w-full resize-none border border-border bg-transparent px-[var(--space-4)] py-[var(--space-3)] text-text placeholder:text-text-muted transition-colors focus:border-text focus:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:opacity-40"
        />

        {busy && <EditIndicator />}

        {status === "error" && errorMessage && (
          <p role="alert" className="text-caption text-danger-text">
            {errorMessage}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          fullWidth
        >
          Apply edit
        </Button>
      </section>
    </div>
  );
}
