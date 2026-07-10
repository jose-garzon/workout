export interface StepperProps {
  /** 1-based current step. */
  current: number;
  total: number;
  /** Optional short heading for the current step, e.g. "About you". */
  label?: string;
}

/**
 * "Step N of M" progress tracker (design.md §7 D9) — a reusable atom, not
 * onboarding-specific, so other multi-step flows (Feature B) can reuse it.
 *
 * Deliberately neutral ink, never `accent`: the strict "one full-saturation
 * accent fill per screen" rule (design-system.md §2 "Color usage") is
 * already spent on the form's primary Continue/Finish button, so the filled
 * segment here uses plain `text` ink instead of a second yellow block.
 */
export function Stepper({ current, total, label }: StepperProps) {
  const steps = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex gap-[var(--space-2)]" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step}
            className={`h-1 flex-1 ${step < current ? "bg-text" : "bg-border"}`}
          />
        ))}
      </div>
      {/* The visible text below is the accessible name — no extra ARIA
          wrapper needed on the group; the decorative bar above is the only
          part that's aria-hidden. */}
      <p className="text-micro text-text-muted">
        Step {current} of {total}
        {label ? ` · ${label}` : ""}
      </p>
    </div>
  );
}
