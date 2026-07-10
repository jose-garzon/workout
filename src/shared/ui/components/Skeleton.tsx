/**
 * A bounded, static loading skeleton (design-system.md §2 "The four states" —
 * Loading: mirrors the final layout's shape, no spinners for local reads;
 * §8 "Silence is a valid state" — no infinite shimmer). Sized to roughly
 * match `ComingSoon` so there is no layout shift once real content swaps in.
 */
export function Skeleton() {
  return (
    <div
      className="flex flex-col gap-[var(--space-3)] border border-border bg-surface p-[var(--space-6)]"
      aria-hidden="true"
    >
      <div className="h-[1.0625rem] w-2/3 bg-border" />
      <div className="h-[0.875rem] w-full bg-border" />
      <div className="h-[0.875rem] w-4/5 bg-border" />
    </div>
  );
}
