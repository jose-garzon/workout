"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — the one primitive every feature reuses (design-system.md §2
 * "Component sizing", §3.4 shape). Sharp rectangle, zero radius, three
 * heights on the control-height scale, and the two-layer focus ring is
 * inherited globally from `:focus-visible` (tokens/globals.css) — no extra
 * work needed here.
 *
 * - `primary` — the ONE full-saturation accent fill per screen (usually the
 *   single primary CTA, `size="lg"`). Near-black `on-accent` text, never
 *   white (design-system.md §3.1 — white on this accent fails at 1.12:1).
 * - `secondary` — outline in `border`, transparent fill, for every other
 *   action on the same screen (keeps "one accent per screen" strict).
 */

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-[var(--control-height-sm)] px-[var(--control-padding-inline-md)]",
  md: "h-[var(--control-height-md)] px-[var(--control-padding-inline-md)]",
  lg: "h-[var(--control-height-lg)] px-[var(--control-padding-inline-lg)]",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent border border-transparent hover:opacity-90",
  secondary: "bg-transparent text-text border border-border hover:bg-surface",
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "text-body-strong anim-press inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius)] transition-opacity",
        "disabled:pointer-events-none disabled:opacity-40",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? "w-full" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
