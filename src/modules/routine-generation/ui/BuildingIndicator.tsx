"use client";

/**
 * The in-flight building indicator (spec `routine-generation`) — shown between
 * the identity header and the composer while the model works. Three bars that
 * rise and fall (the sanctioned generation-only loop, design-system.md §"four
 * states"), paired with a specific progressing message — never an anonymous
 * spinner. Freezes to a static resting state under `prefers-reduced-motion`.
 */
export function BuildingIndicator() {
  return (
    <div
      className="anim-fade flex items-center gap-[var(--space-4)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)]"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="anim-build-bars flex h-[var(--space-6)] items-end gap-[var(--space-1)]"
      >
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
        <span
          className="block w-[var(--space-2)] bg-accent"
          style={{ height: "100%" }}
        />
      </div>
      <p className="text-body-strong">Building your routine…</p>
    </div>
  );
}
