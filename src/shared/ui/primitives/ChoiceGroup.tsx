"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";

export interface ChoiceOption {
  value: string;
  label: string;
}

export type ChoiceGroupLayout = "segmented" | "stack" | "grid";

export interface ChoiceGroupProps {
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  error?: string | null;
  required?: boolean;
  /** "segmented" — equal-width horizontal toggle (e.g. a 2-option field).
   *  "stack" — vertical list of full-width rows (e.g. a 4-option field).
   *  "grid" — two-column grid of bordered cells (e.g. a 7-option field too
   *  long for "segmented" and too tall for "stack" in a compact space —
   *  edit-profile design.md D3's `daysPerWeek` row). */
  layout?: ChoiceGroupLayout;
}

/**
 * Single-select control for an `OnboardingField` of `kind: 'choice'`
 * (design.md §3.1) — a `role="radiogroup"` of buttons with full
 * roving-tabindex keyboard support (design-system.md §2 "Accessibility":
 * full keyboard operability everywhere).
 *
 * The selected option is marked with `accent-wash` + `accent-text`, never a
 * full `accent` fill — design-system.md §2 "Color usage" reserves the one
 * full-saturation accent fill per screen for the primary CTA, so a second
 * loud yellow block here would break that rule the moment this control sits
 * on the same screen as a primary Continue/Finish button.
 */
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  id,
  error,
  required = false,
  layout = "segmented",
}: ChoiceGroupProps) {
  const groupId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const labelId = `${groupId}-label`;
  const errorId = error ? `${groupId}-error` : undefined;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);

  const selectAt = (index: number, focusIt: boolean) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    if (focusIt) refs.current[index]?.focus();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const forwardKey =
      layout === "segmented" || layout === "grid" ? "ArrowRight" : "ArrowDown";
    const backwardKey =
      layout === "segmented" || layout === "grid" ? "ArrowLeft" : "ArrowUp";
    if (event.key === forwardKey) {
      event.preventDefault();
      selectAt((index + 1) % options.length, true);
    } else if (event.key === backwardKey) {
      event.preventDefault();
      selectAt((index - 1 + options.length) % options.length, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectAt(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      selectAt(options.length - 1, true);
    }
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
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required}
        aria-describedby={errorId}
        className={
          layout === "segmented"
            ? `flex h-[var(--control-height-md)] border ${error ? "border-danger" : "border-border"}`
            : layout === "grid"
              ? "grid grid-cols-2 gap-[var(--space-3)]"
              : "flex flex-col gap-[var(--space-3)]"
        }
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          const tabbable = selectedIndex === -1 ? index === 0 : checked;
          return (
            // biome-ignore lint/a11y/useSemanticElements: native <input type="radio"> can't carry this sharp-rectangle segmented layout or the roving-tabindex nav below — WAI-ARIA APG "Radio Group" custom-widget pattern.
            <button
              key={option.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => selectAt(index, false)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={
                layout === "segmented"
                  ? [
                      "text-body-strong anim-press flex-1",
                      checked
                        ? "bg-accent-wash text-accent-text"
                        : "bg-transparent text-text hover:bg-surface",
                      index < options.length - 1
                        ? "border-r border-border"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : layout === "grid"
                    ? [
                        "text-body-strong anim-press flex h-[var(--control-height-md)] items-center justify-center border",
                        checked
                          ? "border-accent-text bg-accent-wash text-accent-text"
                          : `${error ? "border-danger" : "border-border"} bg-transparent text-text hover:bg-surface`,
                      ].join(" ")
                    : [
                        "text-body-strong anim-press flex h-[var(--control-height-md)] items-center gap-[var(--space-3)] border px-[var(--control-padding-inline-md)] text-left",
                        checked
                          ? "border-accent-text bg-accent-wash text-accent-text"
                          : `${error ? "border-danger" : "border-border"} bg-transparent text-text hover:bg-surface`,
                      ].join(" ")
              }
            >
              {layout === "stack" && (
                <span
                  aria-hidden="true"
                  className={`h-[10px] w-[10px] shrink-0 border ${
                    checked
                      ? "border-accent-text bg-accent-text"
                      : "border-text-muted bg-transparent"
                  }`}
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
