"use client";

import { type KeyboardEvent, useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";

/**
 * The prompt composer (spec `routine-generation`) — home's primary action,
 * pinned to the bottom. A roomy multi-line field with the weight of a serious
 * AI app, not a search box. Enter submits; Shift+Enter inserts a newline. Empty
 * or whitespace-only prompts cannot be submitted; the field is locked while a
 * generation is in flight.
 */
export interface ComposerProps {
  onSubmit: (prompt: string) => void;
  /** True while a generation is in flight — locks the field + button. */
  busy: boolean;
  placeholder?: string;
}

export function Composer({ onSubmit, busy, placeholder }: ComposerProps) {
  const [text, setText] = useState("");
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

  return (
    <div className="flex flex-col gap-[var(--space-3)] border border-border bg-surface p-[var(--space-4)] focus-within:border-text">
      <textarea
        aria-label="Describe the routine you want"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
        rows={3}
        placeholder={
          placeholder ?? "Describe your split, days, and priorities…"
        }
        className="text-body min-h-[calc(var(--space-6)*3)] w-full resize-none bg-transparent text-text placeholder:text-text-muted focus:outline-none disabled:opacity-40"
      />
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={!canSubmit}
          aria-label="Build routine"
        >
          Build routine
        </Button>
      </div>
    </div>
  );
}
