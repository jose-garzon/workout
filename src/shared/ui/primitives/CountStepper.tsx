"use client";

export interface CountStepperOption {
  value: string;
  label: string;
}

export interface CountStepperProps {
  label: string;
  /** Ordered options this control steps through, e.g. '1'..'7'. */
  options: CountStepperOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  error?: string | null;
  required?: boolean;
}

/**
 * Compact −/+ stepper for a `kind: 'choice'` field with many sequential
 * options — design.md §3.1 flags a 7-segment control (training days/week)
 * as too tight to hit reliably on a phone. Steps through `options` in array
 * order rather than assuming a numeric range, so it stays generic to
 * whatever the logic layer hands it; the displayed value is always
 * `option.label`, never a value derived in this component (design.md §3.1 —
 * the designer never hard-codes labels).
 */
export function CountStepper({
  label,
  options,
  value,
  onChange,
  id,
  error,
  required = false,
}: CountStepperProps) {
  const groupId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const labelId = `${groupId}-label`;
  const errorId = error ? `${groupId}-error` : undefined;
  const index = options.findIndex((option) => option.value === value);
  const current = index >= 0 ? options[index] : null;
  const atMin = index === 0;
  const atMax = index === options.length - 1;

  const step = (delta: 1 | -1) => {
    if (index === -1) {
      const seed = options[delta > 0 ? 0 : options.length - 1];
      if (seed) onChange(seed.value);
      return;
    }
    const next = options[index + delta];
    if (next) onChange(next.value);
  };

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <span id={labelId} className="text-body-strong">
        {label}
        {required && (
          <span aria-hidden="true" className="text-accent-text">
            {" "}
            *
          </span>
        )}
      </span>
      <div
        className={[
          "flex h-[var(--control-height-lg)] border",
          error ? "border-danger" : "border-border",
        ].join(" ")}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={index !== -1 && atMin}
          onClick={() => step(-1)}
          className="anim-press text-title-2 flex w-[var(--control-height-lg)] items-center justify-center text-text disabled:pointer-events-none disabled:opacity-30"
        >
          −
        </button>
        <span
          role="status"
          aria-labelledby={labelId}
          className="text-display-brand num-tabular flex flex-1 items-center justify-center"
        >
          {current?.label ?? "—"}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={index !== -1 && atMax}
          onClick={() => step(1)}
          className="anim-press text-title-2 flex w-[var(--control-height-lg)] items-center justify-center text-text disabled:pointer-events-none disabled:opacity-30"
        >
          +
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
