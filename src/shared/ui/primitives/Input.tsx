"use client";

import type { ChangeEvent } from "react";

export type InputType = "text" | "number";
export type InputSize = "md" | "lg";

export interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: InputType;
  id?: string;
  required?: boolean;
  error?: string | null;
  placeholder?: string;
  /** e.g. 'kg' | 'lb' | 'cm' | 'in' — rendered inside the field, right-aligned. */
  suffix?: string;
  autoComplete?: string;
  /**
   * `md` (default, 56px) — every ordinary field. `lg` (64px) is the named
   * design-system.md exception (§2 "Component sizing") for "the single
   * most-used input in the app, hit mid-set, often imprecisely" — workout
   * mode's weight field is the one real consumer. `lg` also renders the
   * value in `display` (Barlow 800, tabular-nums, 48px), matching §3.2's
   * explicit call-out that "any live/in-session weight-or-reps number" uses
   * the same live-numeral treatment as the rest-timer countdown, not just a
   * bigger label weight.
   */
  size?: InputSize;
  /**
   * Locks the field against edits without hiding the value — e.g. workout
   * mode's weight field while a set's stopwatch is running. Same
   * `opacity-40` + `pointer-events-none` dimming `Button` uses for its
   * `disabled` state (design-system.md consistency), applied to the whole
   * control (border + value + suffix) so a locked field reads unmistakably
   * inert, not just non-interactive.
   */
  disabled?: boolean;
}

const SIZE_HEIGHT: Record<InputSize, string> = {
  md: "h-[var(--control-height-md)]",
  lg: "h-[var(--control-height-lg)]",
};

const SIZE_VALUE_TEXT: Record<InputSize, string> = {
  md: "text-body",
  lg: "text-display",
};

const SIZE_SUFFIX_TEXT: Record<InputSize, string> = {
  md: "text-body-strong",
  lg: "text-title-3",
};

/**
 * Text/numeric input atom (design-system.md §2 "Component sizing" — 56px
 * default footprint, the same as a default button) reused by every feature.
 * Numeric entry uses `inputMode="decimal"` on a plain text input rather than
 * the native `type="number"` spinner: browser spin buttons are rounded
 * platform chrome that fights the system's sharp-rectangle language
 * (design-system.md §3.4), so this keeps the square footprint while still
 * surfacing a numeric keyboard on mobile. Values are always carried as
 * strings, matching the field-descriptor seam (design.md §3.1).
 */
export function Input({
  label,
  value,
  onChange,
  type = "text",
  id,
  required = false,
  error,
  placeholder,
  suffix,
  autoComplete,
  size = "md",
  disabled = false,
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = error ? `${inputId}-error` : undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <label htmlFor={inputId} className="text-body-strong">
        {label}
        {required && (
          <span aria-hidden="true" className="text-accent-text">
            {" "}
            *
          </span>
        )}
      </label>
      <div
        className={[
          "flex border bg-transparent transition-colors",
          SIZE_HEIGHT[size],
          "focus-within:[box-shadow:var(--focus-ring)]",
          error ? "border-danger" : "border-border focus-within:border-text",
          disabled ? "pointer-events-none opacity-40" : "",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="text"
          inputMode={type === "number" ? "decimal" : undefined}
          value={value}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          // The ring is drawn on the wrapper (focus-within, above) so it
          // wraps the WHOLE control — including the suffix chip — as one
          // clean rectangle, instead of the global `:focus-visible` rule
          // outlining just this bare <input>'s inset bounds.
          style={{ boxShadow: "none" }}
          className={`${SIZE_VALUE_TEXT[size]} min-w-0 flex-1 bg-transparent px-[var(--control-padding-inline-md)] text-text placeholder:text-text-muted focus:outline-none`}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className={`${SIZE_SUFFIX_TEXT[size]} flex items-center pr-[var(--control-padding-inline-md)] text-text-muted`}
          >
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
