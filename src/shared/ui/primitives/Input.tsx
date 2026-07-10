"use client";

import type { ChangeEvent } from "react";

export type InputType = "text" | "number";

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
}

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
          "flex h-[var(--control-height-md)] border bg-transparent transition-colors",
          "focus-within:[box-shadow:var(--focus-ring)]",
          error ? "border-danger" : "border-border focus-within:border-text",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="text"
          inputMode={type === "number" ? "decimal" : undefined}
          value={value}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          // The ring is drawn on the wrapper (focus-within, above) so it
          // wraps the WHOLE control — including the suffix chip — as one
          // clean rectangle, instead of the global `:focus-visible` rule
          // outlining just this bare <input>'s inset bounds.
          style={{ boxShadow: "none" }}
          className="text-body min-w-0 flex-1 bg-transparent px-[var(--control-padding-inline-md)] text-text placeholder:text-text-muted focus:outline-none"
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="text-body-strong flex items-center pr-[var(--control-padding-inline-md)] text-text-muted"
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
