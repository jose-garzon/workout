"use client";

import { type KeyboardEvent, useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";

/**
 * The prompt composer (spec `routine-generation`) — home's primary action,
 * pinned to the bottom. A roomy multi-line field with the weight of a serious
 * AI app, not a search box. Enter submits; Shift+Enter inserts a newline. Empty
 * or whitespace-only prompts cannot be submitted; the field is locked while a
 * generation is in flight.
 *
 * Focus ring: drawn ONCE on the wrapper via `focus-within` + the shared
 * `--focus-ring` token, the same recipe `Input` uses, so it wraps the whole
 * control (textarea + send button) as one rectangle. The textarea and the
 * inner `Button` both null out their own `:focus-visible` box-shadow inline
 * (highest specificity, beats the global rule) so a second ring never stacks
 * on top when either one is the actual focused element.
 */
export interface ComposerProps {
  onSubmit: (prompt: string) => void;
  /** True while a generation is in flight — locks the field + button. */
  busy: boolean;
  placeholder?: string;
  /**
   * Seeds the field's starting text (e.g. the empty state's example prompt).
   * Read once, on mount, into local state — this stays an uncontrolled field
   * the user types into freely afterward. To apply a NEW prefill to an
   * already-mounted Composer, remount it with a changed `key` (see
   * `RoutineHomeScreen`) rather than relying on this prop to react to
   * updates.
   */
  initialValue?: string;
  /** Focuses (and places the caret at the end of) the field once on mount —
   * used only right after a prefill lands, never on the very first paint. */
  focusOnMount?: boolean;
}

export function Composer({
  onSubmit,
  busy,
  placeholder,
  initialValue = "",
  focusOnMount = false,
}: ComposerProps) {
  const [text, setText] = useState(initialValue);
  const canSubmit = text.trim() !== "" && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  // A callback ref (not useEffect) so this fires exactly once per mounted
  // node, with no dependency array to keep in sync — a fresh prefill always
  // arrives via a new component instance (a changed `key`), never a prop
  // update on a stable one.
  const focusIfNeeded = (el: HTMLTextAreaElement | null) => {
    if (el && focusOnMount) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-3)] border border-border bg-surface p-[var(--space-4)] transition-colors focus-within:border-text focus-within:[box-shadow:var(--focus-ring)]">
      <textarea
        ref={focusIfNeeded}
        aria-label="Describe the routine you want"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
        rows={3}
        placeholder={
          placeholder ?? "Describe your split, days, and priorities…"
        }
        // The ring lives on the wrapper (focus-within, above) so it wraps
        // the WHOLE control, not just this textarea's own inset bounds.
        style={{ boxShadow: "none" }}
        className="text-body min-h-[calc(var(--space-6)*3)] w-full resize-none bg-transparent text-text placeholder:text-text-muted focus:outline-none disabled:opacity-40"
      />
      <Button
        onClick={submit}
        disabled={!canSubmit}
        size="lg"
        fullWidth
        style={{ boxShadow: "none" }}
      >
        Build my routine
      </Button>
    </div>
  );
}
