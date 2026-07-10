import type { CSSProperties } from "react";

export type LogoSize = "sm" | "md" | "lg";

/** Mark height per usage site — width follows the viewBox's aspect ratio. */
const MARK_HEIGHT_REM: Record<LogoSize, number> = {
  sm: 1.5, // 24px — header, beside the screen title
  md: 2, // 32px — general reuse
  lg: 5, // 80px — welcome-screen hero
};

/** viewBox "0 0 104 64" — width/height, used to derive the mark's aspect ratio. */
const VIEWBOX_ASPECT = 104 / 64;

export interface LogoProps {
  size?: LogoSize;
  /** Adds the "workout-pal" wordmark in Anton (`display-brand`) below the mark. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The workout-pal mark: a "WP" monogram built entirely from straight
 * strokes (`stroke-linejoin="miter"`, `stroke-linecap="butt"` — mitered,
 * square-cut joins, the stroke equivalent of the shape system's zero
 * border-radius, design-system.md §3.4) in the full-saturation accent —
 * no barbell/weight-plate imagery, just bold geometric letterforms
 * (`stroke-accent`, thick relative to the mark's height for a strong,
 * confident read at both header and hero scale).
 *
 * Motion: a one-shot "draw-on" — each letter's stroke animates from fully
 * retracted (`stroke-dashoffset` at full length, via a normalized
 * `pathLength` so no hand-measured path length is needed) to fully drawn,
 * the P starting a beat after the W. The fully-drawn state
 * (`stroke-dashoffset: 0`) is the glyph's actual resting CSS, not just the
 * animation's last keyframe, so `prefers-reduced-motion: reduce` can
 * disable the animation outright (`animation: none`, tokens/globals.css)
 * and the mark simply appears already fully drawn — no separate static
 * fallback to keep in sync. Never looping (design-system.md §1 principle
 * 8, "silence is a valid state").
 *
 * Color note: this is a deliberate, scoped exception to "one
 * full-saturation accent fill per screen" (design-system.md §2) — the
 * brand mark is identity chrome, not a second tappable/selected surface
 * competing with a primary CTA. See design-system.md §2's addendum and the
 * frontend-dev-designer memory (`project-logo-component.md`) for the
 * reasoning.
 *
 * Decorative: the screen that renders this always also carries an
 * accessible "workout-pal" as a visible `<h1>` via `AppShell`, so both the
 * mark and the wordmark span are `aria-hidden`.
 */
export function Logo({
  size = "md",
  withWordmark = false,
  className,
}: LogoProps) {
  const heightRem = MARK_HEIGHT_REM[size];
  const markStyle: CSSProperties = {
    height: `${heightRem}rem`,
    width: `${heightRem * VIEWBOX_ASPECT}rem`,
  };

  return (
    <span
      className={[
        "inline-flex flex-col items-center",
        withWordmark ? "gap-[var(--space-4)]" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox="0 0 104 64"
        style={markStyle}
        aria-hidden="true"
        className="shrink-0 overflow-visible stroke-accent"
      >
        <g
          className="anim-logo-draw"
          fill="none"
          strokeWidth="9"
          strokeLinejoin="miter"
          strokeLinecap="butt"
        >
          {/* W */}
          <path
            className="wp-logo-glyph"
            pathLength="100"
            d="M4,6 L16,58 L30,20 L44,58 L56,6"
          />
          {/* P — stem + a squared-off (not curved) bowl */}
          <path
            className="wp-logo-glyph wp-logo-glyph--p"
            pathLength="100"
            d="M70,58 L70,6 L98,6 L98,32 L70,32"
          />
        </g>
      </svg>
      {withWordmark && (
        <span aria-hidden="true" className="text-display-brand text-text">
          workout-pal
        </span>
      )}
    </span>
  );
}
